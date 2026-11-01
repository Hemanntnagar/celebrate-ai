import { describe, expect, it } from 'vitest'
import { allocationTotals } from './apply'
import { planSchema } from './schema'

const plan = planSchema.parse({
  concept: 'A garden evening for close family and friends.',
  theme: 'Warm garden',
  summary: 'Keep the evening intimate, outdoor, and easy to host without overspending.',
  suggestions: { decoration: ['Lanterns'], catering: ['Family-style dinner'], entertainment: ['Acoustic duo'], activities: ['Toasts'] },
  budget: { allocations: [{ category: 'Venue', percentage: 40, note: 'Garden room' }, { category: 'Food', percentage: 60, note: 'Dinner' }], assumptions: ['Guest count holds'] },
  tasks: [{ title: 'Book venue', milestone: 'Venue', due_offset_days: 30 }],
  vendors: [{ category: 'Catering', criteria: ['Seasonal menu'], availability: 'unverified', pricing: 'unverified' }],
  risks: [{ risk: 'Rain', mitigation: 'Clear tent', severity: 'medium' }],
  questions: ['Any must-play songs?'],
})

describe('plan allocations', () => {
  it('requires allocations to total 100', () => {
    expect(allocationTotals(plan).valid).toBe(true)
    expect(allocationTotals({ ...plan, budget: { ...plan.budget, allocations: [{ category: 'Venue', percentage: 30, note: 'Too low' }] } }).valid).toBe(false)
  })
})
