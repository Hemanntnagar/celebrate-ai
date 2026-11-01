import { NextResponse } from 'next/server'
import { notify } from '@/lib/activity'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503 })
  const today = new Date().toISOString().slice(0, 10)
  const soon = new Date()
  soon.setDate(soon.getDate() + 3)
  const soonDate = soon.toISOString().slice(0, 10)

  const { data: dueTasks } = await supabase.from('tasks').select('id,event_id,owner_id,title,due_date').neq('status', 'done').gte('due_date', today).lte('due_date', soonDate)
  const { data: jobs } = await supabase.from('scheduled_jobs').select('*').eq('status', 'pending').lte('run_at', new Date().toISOString()).limit(50)
  let reminders = 0

  for (const task of dueTasks ?? []) {
    await notify(supabase, { eventId: task.event_id, userId: task.owner_id, title: 'Task due soon', body: `${task.title} is due ${task.due_date}.`, kind: 'reminder' })
    reminders += 1
  }

  for (const job of jobs ?? []) {
    await supabase.from('scheduled_jobs').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('id', job.id)
    if (job.payload && typeof job.payload === 'object' && 'user_id' in job.payload) {
      await notify(supabase, {
        eventId: job.event_id ?? undefined,
        userId: String((job.payload as { user_id: string }).user_id),
        title: 'Scheduled reminder',
        body: String((job.payload as { body?: string }).body ?? job.kind),
        kind: job.kind,
      })
      reminders += 1
    }
  }

  return NextResponse.json({ ok: true, reminders })
}
