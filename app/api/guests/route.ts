import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logActivity } from '@/lib/activity'
import { requireEventPermission } from '@/lib/auth/access'
import { parseGuestCsv } from '@/lib/guests/csv'

const guestSchema = z.object({
  full_name: z.string().trim().min(1).max(160),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  household: z.string().max(120).optional(),
  dietary: z.string().max(200).optional(),
  plus_ones: z.number().int().min(0).max(20).default(0),
  notes: z.string().max(500).optional(),
  group_id: z.string().uuid().nullable().optional(),
})

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), event_id: z.string().uuid(), guest: guestSchema }),
  z.object({ action: z.literal('update'), event_id: z.string().uuid(), guest_id: z.string().uuid(), guest: guestSchema.partial() }),
  z.object({ action: z.literal('delete'), event_id: z.string().uuid(), guest_id: z.string().uuid() }),
  z.object({ action: z.literal('import'), event_id: z.string().uuid(), csv: z.string().min(3).max(200000) }),
  z.object({ action: z.literal('group'), event_id: z.string().uuid(), name: z.string().trim().min(1).max(80) }),
  z.object({ action: z.literal('table'), event_id: z.string().uuid(), name: z.string().trim().min(1).max(80), capacity: z.number().int().positive().max(40) }),
  z.object({ action: z.literal('seat'), event_id: z.string().uuid(), table_id: z.string().uuid(), guest_id: z.string().uuid() }),
])

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get('event_id')
  if (!eventId) return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
  const access = await requireEventPermission(eventId, 'event.read')
  if (access.error) return access.error
  const [guests, groups, invitations, rsvps, tables, seats] = await Promise.all([
    access.supabase.from('guests').select('*').eq('event_id', eventId).order('full_name'),
    access.supabase.from('guest_groups').select('*').eq('event_id', eventId),
    access.supabase.from('invitations').select('*').eq('event_id', eventId),
    access.supabase.from('rsvps').select('*').eq('event_id', eventId),
    access.supabase.from('seating_tables').select('*').eq('event_id', eventId),
    access.supabase.from('seating_assignments').select('*'),
  ])
  return NextResponse.json({
    guests: guests.data ?? [],
    groups: groups.data ?? [],
    invitations: invitations.data ?? [],
    rsvps: rsvps.data ?? [],
    tables: tables.data ?? [],
    seats: seats.data ?? [],
  })
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
  const input = parsed.data
  const access = await requireEventPermission(input.event_id, 'guest.write')
  if (access.error) return access.error
  const userId = access.user!.id

  if (input.action === 'create') {
    const { data, error } = await access.supabase.from('guests').insert({ event_id: input.event_id, owner_id: userId, ...input.guest, email: input.guest.email || null }).select().single()
    if (error) return NextResponse.json({ error: 'Could not add guest.' }, { status: 400 })
    return NextResponse.json({ data }, { status: 201 })
  }
  if (input.action === 'update') {
    const { data, error } = await access.supabase.from('guests').update(input.guest).eq('id', input.guest_id).eq('event_id', input.event_id).select().single()
    if (error) return NextResponse.json({ error: 'Could not update guest.' }, { status: 400 })
    return NextResponse.json({ data })
  }
  if (input.action === 'delete') {
    const { error } = await access.supabase.from('guests').delete().eq('id', input.guest_id).eq('event_id', input.event_id)
    if (error) return NextResponse.json({ error: 'Could not remove guest.' }, { status: 400 })
    return NextResponse.json({ ok: true })
  }
  if (input.action === 'import') {
    const parsedCsv = parseGuestCsv(input.csv)
    if (!parsedCsv.guests.length) return NextResponse.json({ error: parsedCsv.errors[0] ?? 'No guests found.' }, { status: 400 })
    const rows = parsedCsv.guests.map((guest) => ({ event_id: input.event_id, owner_id: userId, ...guest, email: guest.email || null }))
    const { data, error } = await access.supabase.from('guests').insert(rows).select('id')
    if (error) return NextResponse.json({ error: 'Could not import guests.' }, { status: 400 })
    await logActivity(access.supabase, { eventId: input.event_id, user: access.user, action: 'imported', entityType: 'guest', summary: `Imported ${data.length} guests` })
    return NextResponse.json({ imported: data.length, errors: parsedCsv.errors })
  }
  if (input.action === 'group') {
    const { data, error } = await access.supabase.from('guest_groups').insert({ event_id: input.event_id, owner_id: userId, name: input.name }).select().single()
    return error ? NextResponse.json({ error: 'Could not create group.' }, { status: 400 }) : NextResponse.json({ data }, { status: 201 })
  }
  if (input.action === 'table') {
    const { data, error } = await access.supabase.from('seating_tables').insert({ event_id: input.event_id, owner_id: userId, name: input.name, capacity: input.capacity }).select().single()
    return error ? NextResponse.json({ error: 'Could not create table.' }, { status: 400 }) : NextResponse.json({ data }, { status: 201 })
  }
  const { data: table } = await access.supabase.from('seating_tables').select('id,capacity').eq('id', input.table_id).eq('event_id', input.event_id).single()
  if (!table) return NextResponse.json({ error: 'Table not found.' }, { status: 404 })
  const { count } = await access.supabase.from('seating_assignments').select('id', { count: 'exact', head: true }).eq('table_id', input.table_id)
  if ((count ?? 0) >= table.capacity) return NextResponse.json({ error: 'That table is full.' }, { status: 409 })
  const { data, error } = await access.supabase.from('seating_assignments').upsert({ table_id: input.table_id, guest_id: input.guest_id }, { onConflict: 'guest_id' }).select().single()
  return error ? NextResponse.json({ error: 'Could not seat guest.' }, { status: 400 }) : NextResponse.json({ data }, { status: 201 })
}
