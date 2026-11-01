import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logActivity } from '@/lib/activity'
import { requireEventPermission } from '@/lib/auth/access'
import { calculateBudgetMetrics } from '@/lib/budget/calculations'

const currency = z.string().regex(/^[A-Z]{3}$/)
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create_budget'), event_id: z.string().uuid(), total_minor: z.number().int().nonnegative(), currency }),
  z.object({ action: z.literal('category'), event_id: z.string().uuid(), budget_id: z.string().uuid(), name: z.string().trim().min(1).max(80), allocation_minor: z.number().int().nonnegative() }),
  z.object({ action: z.literal('item'), event_id: z.string().uuid(), budget_id: z.string().uuid(), category_id: z.string().uuid(), label: z.string().trim().min(1).max(120), planned_minor: z.number().int().nonnegative(), vendor_commitment_minor: z.number().int().nonnegative().default(0), vendor_name: z.string().trim().max(120).optional() }),
  z.object({ action: z.literal('expense'), event_id: z.string().uuid(), budget_id: z.string().uuid(), category_id: z.string().uuid(), budget_item_id: z.string().uuid().nullable().optional(), description: z.string().trim().min(1).max(160), amount_minor: z.number().int().nonnegative(), currency, vendor_name: z.string().trim().max(120).optional(), notes: z.string().trim().max(1000).optional(), expense_date: z.string().optional(), idempotency_key: z.string().min(8).max(100) }),
  z.object({ action: z.literal('payment'), event_id: z.string().uuid(), expense_id: z.string().uuid(), amount_minor: z.number().int().positive(), paid_at: z.string(), method: z.enum(['cash', 'card', 'bank_transfer', 'upi', 'other']), reference: z.string().trim().max(120).optional(), idempotency_key: z.string().min(8).max(100) }),
  z.object({ action: z.literal('refund'), event_id: z.string().uuid(), payment_id: z.string().uuid(), amount_minor: z.number().int().positive(), note: z.string().trim().max(300).optional() }),
])

async function loadBudget(eventId: string) {
  const access = await requireEventPermission(eventId, 'event.read')
  if (access.error) return { access, payload: access.error }
  const { data: budget, error } = await access.supabase.from('event_budgets').select('*').eq('event_id', eventId).maybeSingle()
  if (error) return { access, payload: NextResponse.json({ error: 'Unable to load budget' }, { status: 500 }) }
  if (!budget) return { access, payload: NextResponse.json({ budget: null, metrics: null, categories: [], items: [], expenses: [], payments: [] }) }
  const [categories, items, expenses] = await Promise.all([
    access.supabase.from('budget_categories').select('*').eq('budget_id', budget.id).order('name'),
    access.supabase.from('budget_items').select('*').eq('budget_id', budget.id).order('created_at'),
    access.supabase.from('expenses').select('*').eq('budget_id', budget.id).order('expense_date', { ascending: false }),
  ])
  const expenseIds = (expenses.data ?? []).map((row) => row.id)
  const payments = expenseIds.length
    ? await access.supabase.from('payments').select('*').in('expense_id', expenseIds)
    : { data: [] as Array<Record<string, unknown>> }
  const values = { categories: categories.data ?? [], items: items.data ?? [], expenses: expenses.data ?? [], payments: payments.data ?? [] }
  return { access, payload: NextResponse.json({ budget, ...values, metrics: calculateBudgetMetrics({ totalMinor: budget.total_minor, ...values }) }) }
}

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get('event_id')
  if (!eventId) return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
  const { payload } = await loadBudget(eventId)
  return payload ?? NextResponse.json({ error: 'Unable to load budget' }, { status: 500 })
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
  const input = parsed.data
  const access = await requireEventPermission(input.event_id, 'budget.write')
  if (access.error) return access.error
  const userId = access.user!.id

  if (input.action === 'create_budget') {
    const result = await access.supabase.from('event_budgets').insert({ event_id: input.event_id, owner_id: userId, total_minor: input.total_minor, currency: input.currency }).select().single()
    if (!result.error) await logActivity(access.supabase, { eventId: input.event_id, user: access.user, action: 'created', entityType: 'budget', entityId: result.data.id, summary: 'Created event budget' })
    return save(result)
  }
  if (input.action === 'category') {
    return save(await access.supabase.from('budget_categories').insert({ budget_id: input.budget_id, owner_id: userId, name: input.name, allocation_minor: input.allocation_minor }).select().single())
  }
  if (input.action === 'item') {
    return save(await access.supabase.from('budget_items').insert({ budget_id: input.budget_id, category_id: input.category_id, owner_id: userId, label: input.label, planned_minor: input.planned_minor, vendor_commitment_minor: input.vendor_commitment_minor, vendor_name: input.vendor_name ?? null }).select().single())
  }
  if (input.action === 'expense') {
    const result = await access.supabase.from('expenses').insert({
      budget_id: input.budget_id,
      category_id: input.category_id,
      budget_item_id: input.budget_item_id ?? null,
      owner_id: userId,
      description: input.description,
      amount_minor: input.amount_minor,
      currency: input.currency,
      vendor_name: input.vendor_name ?? null,
      notes: input.notes ?? null,
      expense_date: input.expense_date ?? new Date().toISOString().slice(0, 10),
      idempotency_key: input.idempotency_key,
    }).select().single()
    return save(result)
  }
  if (input.action === 'refund') {
    const { data: payment } = await access.supabase.from('payments').select('id,owner_id,amount_minor').eq('id', input.payment_id).single()
    if (!payment || input.amount_minor > payment.amount_minor) return NextResponse.json({ error: 'Refund exceeds payment' }, { status: 400 })
    const { data, error } = await access.supabase.from('payment_history').insert({ payment_id: payment.id, owner_id: userId, action: 'refunded', amount_minor: input.amount_minor, note: input.note ?? null }).select().single()
    return error ? NextResponse.json({ error: 'Unable to record refund' }, { status: 400 }) : NextResponse.json({ data }, { status: 201 })
  }
  const result = await access.supabase.rpc('record_payment', {
    p_expense_id: input.expense_id,
    p_owner_id: userId,
    p_amount_minor: input.amount_minor,
    p_paid_at: input.paid_at,
    p_method: input.method,
    p_reference: input.reference ?? null,
    p_idempotency_key: input.idempotency_key,
  })
  return save(result)
}

async function save(query: { data: unknown; error: { code?: string } | null }) {
  if (query.error) return NextResponse.json({ error: query.error.code === '23505' ? 'Duplicate request' : 'Unable to save budget record' }, { status: query.error.code === '23505' ? 409 : 400 })
  return NextResponse.json({ data: query.data }, { status: 201 })
}
