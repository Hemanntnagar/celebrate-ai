import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity'
import { requireEventPermission } from '@/lib/auth/access'
import { applyApprovedPlan } from '@/lib/planner/apply'
import { reviewSchema, withAmounts } from '@/lib/planner/schema'

export async function POST(request: Request) {
  const parsed = reviewSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'The proposal is invalid.' }, { status: 400 })
  const { data: draftLookup } = await (await import('@/lib/supabase/server')).createClient().then((supabase) =>
    supabase.from('event_plans').select('id,event_id,version,plan,status').eq('id', parsed.data.planId).single(),
  )
  if (!draftLookup) return NextResponse.json({ error: 'Draft proposal not found.' }, { status: 404 })
  const access = await requireEventPermission(draftLookup.event_id, 'plan.approve')
  if (access.error) return access.error
  const { data: draft } = await access.supabase.from('event_plans').select('id,event_id,version,plan,status').eq('id', parsed.data.planId).eq('status', 'draft').single()
  if (!draft) return NextResponse.json({ error: 'Draft proposal not found.' }, { status: 404 })

  let plan
  try {
    plan = withAmounts(parsed.data.plan, access.event!.budget)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid budget allocations.' }, { status: 400 })
  }

  const { error } = await access.supabase.from('event_plans').update({
    plan,
    user_edits: parsed.data.plan,
    status: parsed.data.apply ? 'applied' : 'approved',
    approved_at: new Date().toISOString(),
    applied_at: parsed.data.apply ? new Date().toISOString() : null,
  }).eq('id', draft.id)
  if (error) return NextResponse.json({ error: 'Could not approve proposal.' }, { status: 500 })
  await access.supabase.from('event_plans').update({ status: 'superseded' }).eq('event_id', draft.event_id).neq('id', draft.id).in('status', ['approved', 'applied'])

  let applied = null
  if (parsed.data.apply) {
    applied = await applyApprovedPlan(access.supabase, {
      eventId: access.event!.id,
      ownerId: access.event!.owner_id,
      startDate: access.event!.start_date,
      budget: access.event!.budget,
      currency: access.event!.currency,
      plan,
    })
  }

  await logActivity(access.supabase, {
    eventId: draft.event_id,
    user: access.user,
    action: parsed.data.apply ? 'applied' : 'approved',
    entityType: 'plan',
    entityId: draft.id,
    summary: parsed.data.apply ? `Applied plan version ${draft.version}` : `Approved plan version ${draft.version}`,
  })
  return NextResponse.json({ ok: true, version: draft.version, applied })
}
