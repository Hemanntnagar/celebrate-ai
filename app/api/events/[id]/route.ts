import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity'
import { requireEventPermission } from '@/lib/auth/access'
import { eventUpdateSchema } from '@/lib/events/schema'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await requireEventPermission(id, 'event.read')
  if (access.error) return access.error
  const { data: preferences } = await access.supabase.from('event_preferences').select('preferences').eq('event_id', id).maybeSingle()
  return NextResponse.json({ event: access.event, role: access.role, preferences: preferences?.preferences ?? {} })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await requireEventPermission(id, 'event.update')
  if (access.error) return access.error
  const parsed = eventUpdateSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Please check the event details.' }, { status: 400 })
  const { preferences, ...event } = parsed.data
  if (event.start_date && event.end_date && event.end_date < event.start_date) {
    return NextResponse.json({ error: 'End date must be on or after the start date.' }, { status: 400 })
  }
  if (Object.keys(event).length) {
    const { error } = await access.supabase.from('events').update({ ...event, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return NextResponse.json({ error: 'Could not update event.' }, { status: 500 })
  }
  if (preferences) {
    await access.supabase.from('event_preferences').upsert({ event_id: id, preferences, updated_at: new Date().toISOString() })
  }
  await logActivity(access.supabase, { eventId: id, user: access.user, action: 'updated', entityType: 'event', entityId: id, summary: 'Updated event details' })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await requireEventPermission(id, 'event.delete')
  if (access.error) return access.error
  const { error } = await access.supabase.from('events').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Could not delete event.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
