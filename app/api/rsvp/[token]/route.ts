import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const rsvpSchema = z.object({
  status: z.enum(['yes', 'no', 'maybe']),
  party_size: z.coerce.number().int().min(1).max(20).default(1),
  meal_choice: z.string().max(80).optional(),
  message: z.string().max(400).optional(),
})

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_invite', { p_token: token })
  if (error || !data) return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const parsed = rsvpSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Please complete your RSVP.' }, { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('submit_rsvp', {
    p_token: token,
    p_status: parsed.data.status,
    p_party_size: parsed.data.party_size,
    p_meal_choice: parsed.data.meal_choice ?? null,
    p_message: parsed.data.message ?? null,
  })
  if (error) return NextResponse.json({ error: 'Could not save RSVP.' }, { status: 400 })
  return NextResponse.json({ rsvp: data })
}
