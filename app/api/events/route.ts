import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/access'
import { eventSchema } from '@/lib/events/schema'

export async function GET() {
  const { supabase, user } = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { data, error } = await supabase.from('events').select('*').order('start_date', { ascending: true })
  if (error) return NextResponse.json({ error: 'Could not load events.' }, { status: 500 })
  return NextResponse.json({ events: data ?? [] })
}

export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const parsed = eventSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Please check the event details.' }, { status: 400 })
  const { preferences, ...event } = parsed.data
  if (event.end_date < event.start_date) return NextResponse.json({ error: 'End date must be on or after the start date.' }, { status: 400 })
  const { data, error } = await supabase.from('events').insert({ ...event, owner_id: user.id }).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'Could not create event.' }, { status: 500 })
  if (preferences) await supabase.from('event_preferences').upsert({ event_id: data.id, preferences, updated_at: new Date().toISOString() })
  return NextResponse.json({ id: data.id })
}
