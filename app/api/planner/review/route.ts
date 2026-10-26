import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { reviewSchema } from '@/lib/planner/schema'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const parsed = reviewSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'The proposal is invalid.' }, { status: 400 })
  const { data: draft } = await supabase.from('event_plans').select('id,event_id,version,plan').eq('id', parsed.data.planId).eq('owner_id', user.id).eq('status', 'draft').single()
  if (!draft) return NextResponse.json({ error: 'Draft proposal not found.' }, { status: 404 })
  const { error } = await supabase.from('event_plans').update({ plan: parsed.data.plan, user_edits: parsed.data.plan, status: 'approved', approved_at: new Date().toISOString() }).eq('id', draft.id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: 'Could not approve proposal.' }, { status: 500 })
  await supabase.from('event_plans').update({ status: 'superseded' }).eq('event_id', draft.event_id).eq('owner_id', user.id).eq('status', 'approved').neq('id', draft.id)
  return NextResponse.json({ ok: true, version: draft.version })
}
