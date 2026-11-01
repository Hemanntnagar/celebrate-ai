import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { can, type EventRole, type Permission } from '@/lib/auth/roles'

export type EventRecord = {
  id: string
  owner_id: string
  name: string
  event_type: string
  start_date: string
  end_date: string
  location: string
  guest_count: number
  budget: number | null
  currency: string
  theme: string | null
  status: string
}

export async function getSessionUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function getEventAccess(eventId: string) {
  const { supabase, user } = await getSessionUser()
  if (!user) return { supabase, user: null, event: null, role: null as EventRole | null }
  const { data: event } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle()
  if (!event) return { supabase, user, event: null, role: null as EventRole | null }
  if (event.owner_id === user.id) return { supabase, user, event: event as EventRecord, role: 'owner' as const }
  const { data: membership } = await supabase
    .from('event_members')
    .select('role,status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  return { supabase, user, event: event as EventRecord, role: (membership?.role as EventRole | undefined) ?? null }
}

export async function requireEventPermission(eventId: string, permission: Permission) {
  const access = await getEventAccess(eventId)
  if (!access.user) return { ...access, error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  if (!access.event) return { ...access, error: NextResponse.json({ error: 'Event not found.' }, { status: 404 }) }
  if (!can(access.role, permission)) return { ...access, error: NextResponse.json({ error: 'You do not have permission for this action.' }, { status: 403 }) }
  return { ...access, error: null }
}
