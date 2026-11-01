import type { SupabaseClient } from '@supabase/supabase-js'
import { toMinor } from '@/lib/money'
import type { GeneratedPlan } from '@/lib/planner/schema'

export function allocationTotals(plan: GeneratedPlan) {
  const total = plan.budget.allocations.reduce((sum, item) => sum + item.percentage, 0)
  return { total, valid: Math.abs(total - 100) <= 0.01 }
}

export async function applyApprovedPlan(
  supabase: SupabaseClient,
  input: { eventId: string; ownerId: string; startDate: string; budget: number | null; currency: string; plan: GeneratedPlan },
) {
  const created = { categories: 0, tasks: 0, budget: false }
  const { data: existingBudget } = await supabase.from('event_budgets').select('id').eq('event_id', input.eventId).maybeSingle()
  let budgetId = existingBudget?.id as string | undefined

  if (!budgetId && input.budget != null) {
    const inserted = await supabase
      .from('event_budgets')
      .insert({ event_id: input.eventId, owner_id: input.ownerId, total_minor: toMinor(input.budget), currency: input.currency })
      .select('id')
      .single()
    budgetId = inserted.data?.id
    created.budget = Boolean(budgetId)
  }

  if (budgetId) {
    const { data: current } = await supabase.from('budget_categories').select('name').eq('budget_id', budgetId)
    const existing = new Set((current ?? []).map((row) => row.name.toLowerCase()))
    const rows = input.plan.budget.allocations
      .filter((item) => !existing.has(item.category.toLowerCase()))
      .map((item) => ({
        budget_id: budgetId,
        owner_id: input.ownerId,
        name: item.category,
        allocation_minor: input.budget == null ? 0 : toMinor((input.budget * item.percentage) / 100),
      }))
    if (rows.length) {
      await supabase.from('budget_categories').insert(rows)
      created.categories = rows.length
    }
  }

  const start = new Date(`${input.startDate}T00:00:00`)
  const taskRows = input.plan.tasks.map((task) => {
    const due = new Date(start)
    due.setDate(due.getDate() - task.due_offset_days)
    const year = due.getFullYear()
    const month = String(due.getMonth() + 1).padStart(2, '0')
    const day = String(due.getDate()).padStart(2, '0')
    return {
      event_id: input.eventId,
      owner_id: input.ownerId,
      title: task.title,
      milestone: task.milestone,
      due_date: `${year}-${month}-${day}`,
      status: 'todo',
      priority: 'medium',
    }
  })
  if (taskRows.length) {
    await supabase.from('tasks').insert(taskRows)
    created.tasks = taskRows.length
  }

  return created
}
