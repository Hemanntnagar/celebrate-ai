export type BudgetCategory = { id: string; name: string; allocation_minor: number }
export type BudgetItem = { id: string; category_id: string; planned_minor: number; vendor_commitment_minor: number }
export type Expense = { id: string; category_id: string; amount_minor: number }
export type Payment = { id: string; expense_id: string; amount_minor: number }

export function sumMinor(values: number[]) {
  return values.reduce((sum, value) => sum + Math.trunc(value), 0)
}

export function calculateBudgetMetrics(input: {
  totalMinor: number
  categories: BudgetCategory[]
  items: BudgetItem[]
  expenses: Expense[]
  payments: Payment[]
}) {
  const paidByExpense = new Map<string, number>()
  for (const payment of input.payments) paidByExpense.set(payment.expense_id, (paidByExpense.get(payment.expense_id) ?? 0) + payment.amount_minor)
  const plannedMinor = sumMinor(input.items.map((item) => item.planned_minor))
  const committedMinor = sumMinor(input.items.map((item) => item.vendor_commitment_minor))
  const actualMinor = sumMinor(input.expenses.map((expense) => expense.amount_minor))
  const paidMinor = sumMinor([...paidByExpense.values()])
  const outstandingMinor = Math.max(0, actualMinor - paidMinor)
  const remainingMinor = input.totalMinor - actualMinor
  const utilizationPercent = input.totalMinor === 0 ? 0 : Math.round((actualMinor / input.totalMinor) * 10000) / 100
  const byCategory = input.categories.map((category) => {
    const planned = sumMinor(input.items.filter((item) => item.category_id === category.id).map((item) => item.planned_minor))
    const committed = sumMinor(input.items.filter((item) => item.category_id === category.id).map((item) => item.vendor_commitment_minor))
    const actual = sumMinor(input.expenses.filter((expense) => expense.category_id === category.id).map((expense) => expense.amount_minor))
    return { ...category, planned_minor: planned, committed_minor: committed, actual_minor: actual, remaining_minor: category.allocation_minor - actual, overspent: actual > category.allocation_minor }
  })
  return { total_minor: input.totalMinor, planned_minor: plannedMinor, committed_minor: committedMinor, actual_minor: actualMinor, paid_minor: paidMinor, outstanding_minor: outstandingMinor, remaining_minor: remainingMinor, utilization_percent: utilizationPercent, overspent: remainingMinor < 0, by_category: byCategory }
}
