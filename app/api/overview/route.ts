import { NextResponse } from 'next/server'
import { requireEventPermission } from '@/lib/auth/access'
import { calculateBudgetMetrics } from '@/lib/budget/calculations'

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get('event_id')
  if (!eventId) return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
  const access = await requireEventPermission(eventId, 'event.read')
  if (access.error) return access.error
  const [budget, tasks, guests, rsvps, bookings, plans, preferences] = await Promise.all([
    access.supabase.from('event_budgets').select('*').eq('event_id', eventId).maybeSingle(),
    access.supabase.from('tasks').select('id,status,due_date').eq('event_id', eventId),
    access.supabase.from('guests').select('id,plus_ones').eq('event_id', eventId),
    access.supabase.from('rsvps').select('status,party_size').eq('event_id', eventId),
    access.supabase.from('vendor_bookings').select('id,status').eq('event_id', eventId),
    access.supabase.from('event_plans').select('id,version,status').eq('event_id', eventId).order('version', { ascending: false }).limit(1),
    access.supabase.from('event_preferences').select('preferences').eq('event_id', eventId).maybeSingle(),
  ])
  let metrics = null
  if (budget.data) {
    const [categories, items, expenses] = await Promise.all([
      access.supabase.from('budget_categories').select('*').eq('budget_id', budget.data.id),
      access.supabase.from('budget_items').select('*').eq('budget_id', budget.data.id),
      access.supabase.from('expenses').select('*').eq('budget_id', budget.data.id),
    ])
    const expenseIds = (expenses.data ?? []).map((row) => row.id)
    const payments = expenseIds.length ? await access.supabase.from('payments').select('*').in('expense_id', expenseIds) : { data: [] }
    metrics = calculateBudgetMetrics({ totalMinor: budget.data.total_minor, categories: categories.data ?? [], items: items.data ?? [], expenses: expenses.data ?? [], payments: payments.data ?? [] })
  }
  return NextResponse.json({
    event: access.event,
    role: access.role,
    preferences: preferences.data?.preferences ?? {},
    latestPlan: plans.data?.[0] ?? null,
    budget: budget.data,
    metrics,
    tasks: {
      total: tasks.data?.length ?? 0,
      done: tasks.data?.filter((task) => task.status === 'done').length ?? 0,
      open: tasks.data?.filter((task) => task.status !== 'done').length ?? 0,
    },
    guests: {
      total: guests.data?.length ?? 0,
      seats: (guests.data ?? []).reduce((sum, guest) => sum + 1 + (guest.plus_ones ?? 0), 0),
      yes: rsvps.data?.filter((row) => row.status === 'yes').reduce((sum, row) => sum + row.party_size, 0) ?? 0,
      no: rsvps.data?.filter((row) => row.status === 'no').length ?? 0,
      maybe: rsvps.data?.filter((row) => row.status === 'maybe').length ?? 0,
    },
    vendors: {
      total: bookings.data?.length ?? 0,
      booked: bookings.data?.filter((row) => row.status === 'booked' || row.status === 'completed').length ?? 0,
    },
  })
}
