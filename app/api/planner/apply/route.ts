import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logActivity } from '@/lib/activity'
import { requireEventPermission } from '@/lib/auth/access'
import { applyApprovedPlan } from '@/lib/planner/apply'
import { planSchema } from '@/lib/planner/schema'

const bodySchema = z.object({ planId: z.string().uuid() })

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'planId is required' }, { status: 400 })
  const { supabase } = await (await import('@/lib/auth/access')).getSessionUser()
  const { data: record } = await supabase.from('event_plans').select('id,event_id,version,plan,status').eq('id', parsed.data.planId).in('status', ['approved', 'applied']).single()
  if (!record) return NextResponse.json({ error: 'Approved proposal not found.' }, { status: 404 })
  const access = await requireEventPermission(record.event_id, 'plan.approve')
  if (access.error) return access.error
  const plan = planSchema.parse(record.plan)
  const applied = await applyApprovedPlan(access.supabase, {
    eventId: access.event!.id,
    ownerId: access.event!.owner_id,
    startDate: access.event!.start_date,
    budget: access.event!.budget,
    currency: access.event!.currency,
    plan,
  })
  await access.supabase.from('event_plans').update({ status: 'applied', applied_at: new Date().toISOString() }).eq('id', record.id)
  await logActivity(access.supabase, { eventId: record.event_id, user: access.user, action: 'applied', entityType: 'plan', entityId: record.id, summary: `Applied plan version ${record.version}` })
  return NextResponse.json({ ok: true, applied })
}
