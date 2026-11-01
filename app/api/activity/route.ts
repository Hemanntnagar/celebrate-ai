import { NextResponse } from 'next/server'
import { requireEventPermission } from '@/lib/auth/access'

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get('event_id')
  if (!eventId) return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
  const access = await requireEventPermission(eventId, 'event.read')
  if (access.error) return access.error
  const { data } = await access.supabase.from('activity_log').select('*').eq('event_id', eventId).order('created_at', { ascending: false }).limit(40)
  return NextResponse.json({ activity: data ?? [] })
}
