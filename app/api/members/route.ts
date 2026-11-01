import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logActivity, notify } from '@/lib/activity'
import { ROLES } from '@/lib/auth/roles'
import { requireEventPermission } from '@/lib/auth/access'

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('invite'), event_id: z.string().uuid(), email: z.string().email(), role: z.enum(ROLES) }),
  z.object({ action: z.literal('update'), event_id: z.string().uuid(), member_id: z.string().uuid(), role: z.enum(ROLES).optional(), status: z.enum(['invited', 'active', 'revoked']).optional() }),
])

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get('event_id')
  if (!eventId) return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
  const access = await requireEventPermission(eventId, 'event.read')
  if (access.error) return access.error
  const { data } = await access.supabase.from('event_members').select('*').eq('event_id', eventId).order('created_at')
  return NextResponse.json({ members: data ?? [], role: access.role })
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const access = await requireEventPermission(parsed.data.event_id, 'team.manage')
  if (access.error) return access.error
  if (parsed.data.action === 'invite') {
    if (parsed.data.role === 'owner') return NextResponse.json({ error: 'Owner role cannot be assigned this way.' }, { status: 400 })
    const { data: profile } = await access.supabase.from('profiles').select('id').eq('email', parsed.data.email).maybeSingle()
    const { data, error } = await access.supabase.from('event_members').insert({
      event_id: parsed.data.event_id,
      email: parsed.data.email,
      role: parsed.data.role,
      status: profile?.id ? 'active' : 'invited',
      user_id: profile?.id ?? null,
      invited_by: access.user!.id,
    }).select().single()
    if (error) return NextResponse.json({ error: 'Could not invite that person.' }, { status: 400 })
    if (profile?.id) await notify(access.supabase, { eventId: parsed.data.event_id, userId: profile.id, title: 'Added to an event', body: `You now have ${parsed.data.role} access to ${access.event!.name}.`, kind: 'membership' })
    await logActivity(access.supabase, { eventId: parsed.data.event_id, user: access.user, action: 'invited', entityType: 'member', entityId: data.id, summary: `Invited ${parsed.data.email} as ${parsed.data.role}` })
    return NextResponse.json({ data }, { status: 201 })
  }
  if (parsed.data.role === 'owner') return NextResponse.json({ error: 'Owner role cannot be reassigned here.' }, { status: 400 })
  const { data, error } = await access.supabase.from('event_members').update({ role: parsed.data.role, status: parsed.data.status }).eq('id', parsed.data.member_id).eq('event_id', parsed.data.event_id).select().single()
  if (error) return NextResponse.json({ error: 'Could not update member.' }, { status: 400 })
  return NextResponse.json({ data })
}
