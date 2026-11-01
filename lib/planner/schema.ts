import { z } from 'zod'

export const planSchema = z.object({
  concept: z.string().min(10).max(500),
  theme: z.string().min(2).max(120),
  summary: z.string().min(20).max(1000),
  suggestions: z.object({
    decoration: z.array(z.string().min(2)).min(1).max(8),
    catering: z.array(z.string().min(2)).min(1).max(8),
    entertainment: z.array(z.string().min(2)).min(1).max(8),
    activities: z.array(z.string().min(2)).min(1).max(8),
  }),
  budget: z.object({
    allocations: z.array(z.object({ category: z.string().min(2), percentage: z.number().min(0).max(100), note: z.string().min(2) })).min(1).max(10),
    assumptions: z.array(z.string()).max(8),
  }),
  tasks: z.array(z.object({ title: z.string().min(2), milestone: z.string().min(2), due_offset_days: z.number().int().min(0).max(730) })).min(1).max(20),
  vendors: z.array(z.object({ category: z.string().min(2), criteria: z.array(z.string().min(2)).min(1).max(8), availability: z.literal('unverified'), pricing: z.literal('unverified') })).min(1).max(10),
  risks: z.array(z.object({ risk: z.string().min(2), mitigation: z.string().min(2), severity: z.enum(['low', 'medium', 'high']) })).max(10),
  questions: z.array(z.string().min(2)).max(8),
})

export type GeneratedPlan = z.infer<typeof planSchema>
export type EventPlan = GeneratedPlan & {
  budget: GeneratedPlan['budget'] & {
    allocations: Array<GeneratedPlan['budget']['allocations'][number] & { amount: number | null }>
  }
}

export const messageSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().trim().min(2).max(4000),
})

export const reviewSchema = z.object({
  planId: z.string().uuid(),
  plan: planSchema,
  apply: z.boolean().optional(),
})

export function withAmounts(plan: GeneratedPlan, budget: number | null): EventPlan {
  const total = plan.budget.allocations.reduce((sum, item) => sum + item.percentage, 0)
  if (Math.abs(total - 100) > 0.01) throw new Error('Budget allocations must total 100%.')
  return {
    ...plan,
    budget: {
      ...plan.budget,
      allocations: plan.budget.allocations.map((item) => ({
        ...item,
        amount: budget === null ? null : Math.round((budget * item.percentage) / 100),
      })),
    },
  }
}
