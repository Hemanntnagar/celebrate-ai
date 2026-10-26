import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const eventSchema = z.object({ name: z.string().trim().min(2).max(100), event_type: z.enum(['wedding','birthday','anniversary','festival','community']), start_date: z.string(), end_date: z.string(), location: z.string().trim().min(2).max(160), guest_count: z.coerce.number().int().positive().max(100000), budget: z.coerce.number().nonnegative().nullable().optional(), currency: z.string().length(3), theme: z.string().trim().max(100).nullable().optional(), preferences: z.record(z.string(), z.unknown()).optional() })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const parsed = eventSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Please check the event details.' }, { status: 400 })
  const { preferences, ...event } = parsed.data
  const { data, error } = await supabase.from('events').insert({ ...event, owner_id: user.id }).select('id').single()
  if (error) return NextResponse.json({ error: 'Could not create event.' }, { status: 500 })
  if (preferences) await supabase.from('event_preferences').insert({ event_id: data.id, preferences })
  return NextResponse.json({ id: data.id })
}
