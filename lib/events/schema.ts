import { z } from 'zod'

export const eventTypes = ['wedding', 'birthday', 'anniversary', 'festival', 'community'] as const
export const eventStatuses = ['planning', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const

export const preferencesSchema = z.object({
  vibe: z.string().max(200).optional().default(''),
  colors: z.string().max(120).optional().default(''),
  mustHaves: z.string().max(500).optional().default(''),
  avoid: z.string().max(500).optional().default(''),
  dietary: z.string().max(300).optional().default(''),
  accessibility: z.string().max(300).optional().default(''),
  music: z.string().max(200).optional().default(''),
})

export const eventSchema = z.object({
  name: z.string().trim().min(2).max(100),
  event_type: z.enum(eventTypes),
  start_date: z.string().min(8),
  end_date: z.string().min(8),
  location: z.string().trim().min(2).max(160),
  guest_count: z.coerce.number().int().positive().max(100000),
  budget: z.coerce.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default('USD'),
  theme: z.string().trim().max(100).nullable().optional(),
  status: z.enum(eventStatuses).optional(),
  preferences: preferencesSchema.optional(),
})

export const eventUpdateSchema = eventSchema.partial()
