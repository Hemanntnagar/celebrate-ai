import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth/access'

const bodySchema = z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() })

export async function GET() {
  const { supabase, user } = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
  return NextResponse.json({ notifications: data ?? [] })
}

export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const query = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id)
  const { error } = parsed.data.all ? await query : await query.eq('id', parsed.data.id ?? '')
  if (error) return NextResponse.json({ error: 'Could not update notifications.' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
