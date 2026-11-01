import { describe, expect, it } from 'vitest'
import { calculateBudgetMetrics } from './calculations'

describe('calculateBudgetMetrics', () => {
  it('reconciles planned, actual, paid, and remaining amounts', () => {
    const metrics = calculateBudgetMetrics({
      totalMinor: 100000,
      categories: [{ id: 'venue', name: 'Venue', allocation_minor: 60000 }],
      items: [{ id: 'hall', category_id: 'venue', planned_minor: 55000, vendor_commitment_minor: 50000 }],
      expenses: [{ id: 'dep', category_id: 'venue', amount_minor: 20000 }],
      payments: [{ id: 'p1', expense_id: 'dep', amount_minor: 15000 }],
    })
    expect(metrics.planned_minor).toBe(55000)
    expect(metrics.committed_minor).toBe(50000)
    expect(metrics.actual_minor).toBe(20000)
    expect(metrics.paid_minor).toBe(15000)
    expect(metrics.outstanding_minor).toBe(5000)
    expect(metrics.remaining_minor).toBe(80000)
    expect(metrics.overspent).toBe(false)
    expect(metrics.by_category[0]?.overspent).toBe(false)
  })

  it('flags overspend when expenses exceed the budget', () => {
    const metrics = calculateBudgetMetrics({
      totalMinor: 1000,
      categories: [{ id: 'food', name: 'Food', allocation_minor: 400 }],
      items: [],
      expenses: [{ id: 'e1', category_id: 'food', amount_minor: 1200 }],
      payments: [],
    })
    expect(metrics.overspent).toBe(true)
    expect(metrics.by_category[0]?.overspent).toBe(true)
    expect(metrics.utilization_percent).toBe(120)
  })
})
