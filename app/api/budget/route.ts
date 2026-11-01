import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { calculateBudgetMetrics } from '@/lib/budget/calculations'

const currency = z.string().regex(/^[A-Z]{3}$/)
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create_budget'), event_id: z.string().uuid(), total_minor: z.number().int().nonnegative(), currency }),
  z.object({ action: z.literal('category'), budget_id: z.string().uuid(), name: z.string().trim().min(1).max(80), allocation_minor: z.number().int().nonnegative() }),
  z.object({ action: z.literal('item'), budget_id: z.string().uuid(), category_id: z.string().uuid(), label: z.string().trim().min(1).max(120), planned_minor: z.number().int().nonnegative(), vendor_commitment_minor: z.number().int().nonnegative().default(0), vendor_name: z.string().trim().max(120).optional() }),
  z.object({ action: z.literal('expense'), budget_id: z.string().uuid(), category_id: z.string().uuid(), budget_item_id: z.string().uuid().nullable().optional(), description: z.string().trim().min(1).max(160), amount_minor: z.number().int().nonnegative(), currency, vendor_name: z.string().trim().max(120).optional(), notes: z.string().trim().max(1000).optional(), idempotency_key: z.string().min(8).max(100) }),
  z.object({ action: z.literal('payment'), expense_id: z.string().uuid(), amount_minor: z.number().int().positive(), paid_at: z.string(), method: z.enum(['cash','card','bank_transfer','upi','other']), reference: z.string().trim().max(120).optional(), idempotency_key: z.string().min(8).max(100) }),
  z.object({ action: z.literal('refund'), payment_id: z.string().uuid(), amount_minor: z.number().int().positive(), note: z.string().trim().max(300).optional() }),
])

async function owner() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); return { supabase, user } }

export async function GET(request: Request) {
  const { supabase, user } = await owner(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const eventId = new URL(request.url).searchParams.get('event_id'); if (!eventId) return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
  const { data: budget, error } = await supabase.from('event_budgets').select('*').eq('event_id', eventId).eq('owner_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Unable to load budget' }, { status: 500 })
  if (!budget) return NextResponse.json({ budget: null, metrics: null, categories: [], items: [], expenses: [], payments: [] })
  const [categories, items, expenses, payments] = await Promise.all([
    supabase.from('budget_categories').select('*').eq('budget_id', budget.id).eq('owner_id', user.id).order('name'),
    supabase.from('budget_items').select('*').eq('budget_id', budget.id).eq('owner_id', user.id).order('created_at'),
    supabase.from('expenses').select('*').eq('budget_id', budget.id).eq('owner_id', user.id).order('expense_date', { ascending: false }),
    supabase.from('payments').select('*').eq('owner_id', user.id),
  ])
  const values = { categories: categories.data ?? [], items: items.data ?? [], expenses: expenses.data ?? [], payments: payments.data ?? [] }
  return NextResponse.json({ budget, ...values, metrics: calculateBudgetMetrics({ totalMinor: budget.total_minor, ...values }) })
}

export async function POST(request: Request) {
  const { supabase, user } = await owner(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = bodySchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
  const input = parsed.data
  if (input.action === 'create_budget') return insert(supabase.from('event_budgets').insert({ event_id: input.event_id, owner_id: user.id, total_minor: input.total_minor, currency: input.currency }).select().single())
  if (input.action === 'category') return insert(supabase.from('budget_categories').insert({ ...input, action: undefined, owner_id: user.id }).select().single())
  if (input.action === 'item') return insert(supabase.from('budget_items').insert({ ...input, action: undefined, owner_id: user.id }).select().single())
  if (input.action === 'expense') return insert(supabase.from('expenses').insert({ ...input, action: undefined, owner_id: user.id, budget_item_id: input.budget_item_id ?? null }).select().single())
  if (input.action === 'refund') {
    const { data: payment } = await supabase.from('payments').select('id,owner_id,amount_minor').eq('id', input.payment_id).eq('owner_id', user.id).single()
    if (!payment || input.amount_minor > payment.amount_minor) return NextResponse.json({ error: 'Refund exceeds payment' }, { status: 400 })
    const { data, error } = await supabase.from('payment_history').insert({ payment_id: payment.id, owner_id: user.id, action: 'refunded', amount_minor: input.amount_minor, note: input.note ?? null }).select().single()
    return error ? NextResponse.json({ error: 'Unable to record refund' }, { status: 400 }) : NextResponse.json({ data }, { status: 201 })
  }
  const result = await supabase.rpc('record_payment', { p_expense_id: input.expense_id, p_owner_id: user.id, p_amount_minor: input.amount_minor, p_paid_at: input.paid_at, p_method: input.method, p_reference: input.reference ?? null, p_idempotency_key: input.idempotency_key })
  return insert(result)
}

async function insert(query: any) { const { data, error } = await query; if (error) return NextResponse.json({ error: error.code === '23505' ? 'Duplicate request' : 'Unable to save budget record' }, { status: error.code === '23505' ? 409 : 400 }); return NextResponse.json({ data }, { status: 201 }) }
