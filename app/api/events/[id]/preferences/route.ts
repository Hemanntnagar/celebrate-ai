import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity'
import { requireEventPermission } from '@/lib/auth/access'
import { preferencesSchema } from '@/lib/events/schema'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await requireEventPermission(id, 'event.read')
  if (access.error) return access.error
  const { data } = await access.supabase.from('event_preferences').select('preferences').eq('event_id', id).maybeSingle()
  return NextResponse.json({ preferences: data?.preferences ?? {} })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await requireEventPermission(id, 'preferences.update')
  if (access.error) return access.error
  const parsed = preferencesSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Preferences are invalid.' }, { status: 400 })
  const { error } = await access.supabase.from('event_preferences').upsert({ event_id: id, preferences: parsed.data, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: 'Could not save preferences.' }, { status: 500 })
  await logActivity(access.supabase, { eventId: id, user: access.user, action: 'updated', entityType: 'preferences', entityId: id, summary: 'Updated event preferences' })
  return NextResponse.json({ ok: true, preferences: parsed.data })
}
