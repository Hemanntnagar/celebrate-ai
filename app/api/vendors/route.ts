import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logActivity } from '@/lib/activity'
import { getSessionUser, requireEventPermission } from '@/lib/auth/access'

const currency = z.string().regex(/^[A-Z]{3}$/)
const status = z.enum(['suggested', 'contacted', 'quote_received', 'negotiating', 'booked', 'completed', 'cancelled'])
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('vendor'), name: z.string().trim().min(1).max(160), category: z.string().trim().min(1).max(80), contact_name: z.string().trim().max(120).optional(), email: z.string().email().optional().or(z.literal('')), phone: z.string().trim().max(40).optional(), website: z.string().url().optional().or(z.literal('')), service_description: z.string().trim().max(1000).optional(), notes: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal('quote'), event_id: z.string().uuid(), vendor_id: z.string().uuid(), amount_minor: z.number().int().nonnegative(), currency, included_services: z.string().trim().min(1).max(3000), terms: z.string().trim().max(2000).optional(), availability: z.string().trim().max(1000).optional(), valid_until: z.string().optional() }),
  z.object({ action: z.literal('booking'), event_id: z.string().uuid(), vendor_id: z.string().uuid(), quote_id: z.string().uuid().nullable().optional(), budget_id: z.string().uuid().nullable().optional(), commitment_minor: z.number().int().nonnegative(), currency, payment_schedule: z.array(z.object({ label: z.string().trim().min(1).max(80), amount_minor: z.number().int().positive(), due_date: z.string() })).default([]), notes: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal('status'), event_id: z.string().uuid(), booking_id: z.string().uuid(), to_status: status, note: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal('contract'), event_id: z.string().uuid(), booking_id: z.string().uuid(), title: z.string().trim().min(2).max(160), terms: z.string().trim().max(4000).optional(), signed_at: z.string().optional() }),
  z.object({ action: z.literal('file'), event_id: z.string().uuid(), booking_id: z.string().uuid(), storage_path: z.string().trim().min(1).max(500), file_name: z.string().trim().min(1).max(200), content_type: z.string().trim().min(1).max(120) }),
])
const transitions: Record<string, string[]> = {
  suggested: ['contacted', 'cancelled'],
  contacted: ['quote_received', 'negotiating', 'cancelled'],
  quote_received: ['negotiating', 'booked', 'cancelled'],
  negotiating: ['booked', 'cancelled'],
  booked: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export async function GET(request: Request) {
  const { supabase, user } = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const eventId = new URL(request.url).searchParams.get('event_id')
  const vendors = await supabase.from('vendors').select('*').eq('owner_id', user.id).order('name')
  if (!eventId) return NextResponse.json({ vendors: vendors.data ?? [] })
  const access = await requireEventPermission(eventId, 'event.read')
  if (access.error) return access.error
  const [quotes, bookings, contracts] = await Promise.all([
    access.supabase.from('vendor_quotes').select('*').eq('event_id', eventId).order('amount_minor'),
    access.supabase.from('vendor_bookings').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
    access.supabase.from('vendor_contracts').select('*').eq('owner_id', user.id),
  ])
  return NextResponse.json({ vendors: vendors.data ?? [], quotes: quotes.data ?? [], bookings: bookings.data ?? [], contracts: contracts.data ?? [] })
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
  const input = parsed.data
  if (input.action === 'vendor') {
    const { supabase, user } = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return save(await supabase.from('vendors').insert({
      owner_id: user.id,
      name: input.name,
      category: input.category,
      contact_name: input.contact_name ?? null,
      email: input.email || null,
      phone: input.phone ?? null,
      website: input.website || null,
      service_description: input.service_description ?? null,
      notes: input.notes ?? null,
      verification_status: 'user_entered',
    }).select().single())
  }

  const access = await requireEventPermission(input.event_id, 'vendor.write')
  if (access.error) return access.error
  const userId = access.user!.id

  if (input.action === 'quote') {
    return save(await access.supabase.from('vendor_quotes').insert({
      vendor_id: input.vendor_id,
      event_id: input.event_id,
      owner_id: userId,
      amount_minor: input.amount_minor,
      currency: input.currency,
      included_services: input.included_services,
      terms: input.terms ?? null,
      availability: input.availability ?? null,
      valid_until: input.valid_until ?? null,
      verification_status: 'user_entered',
    }).select().single())
  }
  if (input.action === 'booking') {
    const result = await access.supabase.from('vendor_bookings').insert({
      vendor_id: input.vendor_id,
      event_id: input.event_id,
      quote_id: input.quote_id ?? null,
      budget_id: input.budget_id ?? null,
      owner_id: userId,
      commitment_minor: input.commitment_minor,
      currency: input.currency,
      payment_schedule: input.payment_schedule,
      notes: input.notes ?? null,
    }).select().single()
    if (!result.error && result.data) {
      await access.supabase.from('vendor_booking_history').insert({ booking_id: result.data.id, owner_id: userId, to_status: 'suggested', note: 'Booking created' })
      await logActivity(access.supabase, { eventId: input.event_id, user: access.user, action: 'created', entityType: 'booking', entityId: result.data.id, summary: 'Created a vendor booking' })
    }
    return save(result)
  }
  if (input.action === 'contract') {
    return save(await access.supabase.from('vendor_contracts').insert({ booking_id: input.booking_id, owner_id: userId, title: input.title, terms: input.terms ?? null, signed_at: input.signed_at ?? null }).select().single())
  }
  if (input.action === 'file') {
    return save(await access.supabase.from('vendor_files').insert({ booking_id: input.booking_id, owner_id: userId, storage_path: input.storage_path, file_name: input.file_name, content_type: input.content_type }).select().single())
  }
  const booking = await access.supabase.from('vendor_bookings').select('id,status').eq('id', input.booking_id).eq('event_id', input.event_id).single()
  if (booking.error || !booking.data) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (!transitions[booking.data.status]?.includes(input.to_status)) return NextResponse.json({ error: `Cannot move booking from ${booking.data.status} to ${input.to_status}` }, { status: 409 })
  const updated = await access.supabase.from('vendor_bookings').update({ status: input.to_status, updated_at: new Date().toISOString() }).eq('id', input.booking_id).select().single()
  if (!updated.error) await access.supabase.from('vendor_booking_history').insert({ booking_id: input.booking_id, owner_id: userId, from_status: booking.data.status, to_status: input.to_status, note: input.note ?? null })
  return save(updated)
}

async function save(query: { data: unknown; error: { code?: string } | null }) {
  if (query.error) return NextResponse.json({ error: query.error.code === '23505' ? 'Duplicate request' : 'Unable to save vendor record' }, { status: query.error.code === '23505' ? 409 : 400 })
  return NextResponse.json({ data: query.data }, { status: 201 })
}
