import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const currency = z.string().regex(/^[A-Z]{3}$/)
const status = z.enum(['suggested','contacted','quote_received','negotiating','booked','completed','cancelled'])
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('vendor'), name: z.string().trim().min(1).max(160), category: z.string().trim().min(1).max(80), contact_name: z.string().trim().max(120).optional(), email: z.string().email().optional().or(z.literal('')), phone: z.string().trim().max(40).optional(), website: z.string().url().optional().or(z.literal('')), service_description: z.string().trim().max(1000).optional(), notes: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal('quote'), vendor_id: z.string().uuid(), event_id: z.string().uuid(), amount_minor: z.number().int().nonnegative(), currency, included_services: z.string().trim().min(1).max(3000), terms: z.string().trim().max(2000).optional(), availability: z.string().trim().max(1000).optional(), valid_until: z.string().optional() }),
  z.object({ action: z.literal('booking'), vendor_id: z.string().uuid(), event_id: z.string().uuid(), quote_id: z.string().uuid().nullable().optional(), budget_id: z.string().uuid().nullable().optional(), commitment_minor: z.number().int().nonnegative(), currency, payment_schedule: z.array(z.object({ label: z.string().trim().min(1).max(80), amount_minor: z.number().int().positive(), due_date: z.string() })).default([]), notes: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal('status'), booking_id: z.string().uuid(), to_status: status, note: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal('file'), booking_id: z.string().uuid(), storage_path: z.string().trim().min(1).max(500), file_name: z.string().trim().min(1).max(200), content_type: z.string().trim().min(1).max(120) }),
])
const transitions: Record<string, string[]> = { suggested: ['contacted','cancelled'], contacted: ['quote_received','negotiating','cancelled'], quote_received: ['negotiating','booked','cancelled'], negotiating: ['booked','cancelled'], booked: ['completed','cancelled'], completed: [], cancelled: [] }

async function auth() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); return { supabase, user } }
export async function GET(request: Request) {
  const { supabase, user } = await auth(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const eventId = new URL(request.url).searchParams.get('event_id')
  const vendors = await supabase.from('vendors').select('*').eq('owner_id', user.id).order('name')
  if (!eventId) return NextResponse.json({ vendors: vendors.data ?? [] })
  const [quotes, bookings] = await Promise.all([
    supabase.from('vendor_quotes').select('*').eq('event_id', eventId).eq('owner_id', user.id).order('amount_minor'),
    supabase.from('vendor_bookings').select('*').eq('event_id', eventId).eq('owner_id', user.id).order('created_at', { ascending: false }),
  ])
  if (vendors.error || quotes.error || bookings.error) return NextResponse.json({ error: 'Unable to load vendor data' }, { status: 500 })
  return NextResponse.json({ vendors: vendors.data ?? [], quotes: quotes.data ?? [], bookings: bookings.data ?? [] })
}
export async function POST(request: Request) {
  const { supabase, user } = await auth(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = bodySchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
  const input = parsed.data
  if (input.action === 'vendor') return save(supabase.from('vendors').insert({ ...input, action: undefined, owner_id: user.id, email: input.email || null, website: input.website || null }).select().single())
  if (input.action === 'quote') return save(supabase.from('vendor_quotes').insert({ ...input, action: undefined, owner_id: user.id, terms: input.terms ?? null, availability: input.availability ?? null, valid_until: input.valid_until ?? null }).select().single())
  if (input.action === 'booking') {
    const result = await supabase.from('vendor_bookings').insert({ ...input, action: undefined, owner_id: user.id, quote_id: input.quote_id ?? null, budget_id: input.budget_id ?? null }).select().single()
    if (!result.error && result.data) await supabase.from('vendor_booking_history').insert({ booking_id: result.data.id, owner_id: user.id, to_status: 'suggested', note: 'Booking created' })
    return save(result)
  }
  if (input.action === 'file') return save(supabase.from('vendor_files').insert({ ...input, action: undefined, owner_id: user.id }).select().single())
  const booking = await supabase.from('vendor_bookings').select('id,status').eq('id', input.booking_id).eq('owner_id', user.id).single()
  if (booking.error || !booking.data) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (!transitions[booking.data.status]?.includes(input.to_status)) return NextResponse.json({ error: `Cannot move booking from ${booking.data.status} to ${input.to_status}` }, { status: 409 })
  const updated = await supabase.from('vendor_bookings').update({ status: input.to_status, updated_at: new Date().toISOString() }).eq('id', input.booking_id).eq('owner_id', user.id).select().single()
  if (!updated.error) await supabase.from('vendor_booking_history').insert({ booking_id: input.booking_id, owner_id: user.id, from_status: booking.data.status, to_status: input.to_status, note: input.note ?? null })
  return save(updated)
}
async function save(query: any) { const { data, error } = await query; if (error) return NextResponse.json({ error: error.code === '23523' ? 'Invalid related record' : 'Unable to save vendor record' }, { status: error.code === '23505' ? 409 : 400 }); return NextResponse.json({ data }, { status: 201 }) }
