import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logActivity, notify } from '@/lib/activity'
import { requireEventPermission } from '@/lib/auth/access'
import { assessScheduleImpact, hasCycle } from '@/lib/tasks/impact'

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), event_id: z.string().uuid(), title: z.string().trim().min(2).max(160), description: z.string().max(1000).optional(), due_date: z.string().optional(), milestone: z.string().max(80).optional(), priority: z.enum(['low', 'medium', 'high']).default('medium') }),
  z.object({ action: z.literal('update'), event_id: z.string().uuid(), task_id: z.string().uuid(), title: z.string().trim().min(2).max(160).optional(), description: z.string().max(1000).optional(), due_date: z.string().nullable().optional(), status: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(), priority: z.enum(['low', 'medium', 'high']).optional(), milestone: z.string().max(80).optional() }),
  z.object({ action: z.literal('delete'), event_id: z.string().uuid(), task_id: z.string().uuid() }),
  z.object({ action: z.literal('assign'), event_id: z.string().uuid(), task_id: z.string().uuid(), assignee_email: z.string().email(), user_id: z.string().uuid().optional() }),
  z.object({ action: z.literal('depend'), event_id: z.string().uuid(), task_id: z.string().uuid(), depends_on_id: z.string().uuid() }),
])

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get('event_id')
  if (!eventId) return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
  const access = await requireEventPermission(eventId, 'event.read')
  if (access.error) return access.error
  const [tasks, assignments, dependencies] = await Promise.all([
    access.supabase.from('tasks').select('*').eq('event_id', eventId).order('due_date', { nullsFirst: false }),
    access.supabase.from('task_assignments').select('*').eq('event_id', eventId),
    access.supabase.from('task_dependencies').select('*').eq('event_id', eventId),
  ])
  return NextResponse.json({ tasks: tasks.data ?? [], assignments: assignments.data ?? [], dependencies: dependencies.data ?? [] })
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
  const input = parsed.data
  const access = await requireEventPermission(input.event_id, 'task.write')
  if (access.error) return access.error

  if (input.action === 'create') {
    const { data, error } = await access.supabase.from('tasks').insert({
      event_id: input.event_id,
      owner_id: access.user!.id,
      title: input.title,
      description: input.description ?? null,
      due_date: input.due_date ?? null,
      milestone: input.milestone ?? null,
      priority: input.priority,
    }).select().single()
    if (error) return NextResponse.json({ error: 'Could not create task.' }, { status: 400 })
    await logActivity(access.supabase, { eventId: input.event_id, user: access.user, action: 'created', entityType: 'task', entityId: data.id, summary: `Created task ${input.title}` })
    return NextResponse.json({ data }, { status: 201 })
  }

  if (input.action === 'delete') {
    const { error } = await access.supabase.from('tasks').delete().eq('id', input.task_id).eq('event_id', input.event_id)
    if (error) return NextResponse.json({ error: 'Could not delete task.' }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (input.action === 'assign') {
    const { data, error } = await access.supabase.from('task_assignments').insert({
      event_id: input.event_id,
      task_id: input.task_id,
      assignee_email: input.assignee_email,
      user_id: input.user_id ?? null,
    }).select().single()
    if (error) return NextResponse.json({ error: 'Could not assign task.' }, { status: 400 })
    if (input.user_id) await notify(access.supabase, { eventId: input.event_id, userId: input.user_id, title: 'Task assigned', body: `You were assigned a task for ${access.event!.name}.`, kind: 'task' })
    return NextResponse.json({ data }, { status: 201 })
  }

  if (input.action === 'depend') {
    const { data: existing } = await access.supabase.from('task_dependencies').select('task_id,depends_on_id').eq('event_id', input.event_id)
    if (hasCycle(existing ?? [], { task_id: input.task_id, depends_on_id: input.depends_on_id })) {
      return NextResponse.json({ error: 'That dependency would create a cycle.' }, { status: 409 })
    }
    const { data, error } = await access.supabase.from('task_dependencies').insert({ event_id: input.event_id, task_id: input.task_id, depends_on_id: input.depends_on_id }).select().single()
    if (error) return NextResponse.json({ error: 'Could not save dependency.' }, { status: 400 })
    return NextResponse.json({ data }, { status: 201 })
  }

  const { data: current } = await access.supabase.from('tasks').select('*').eq('id', input.task_id).eq('event_id', input.event_id).single()
  if (!current) return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
  const patch = {
    title: input.title ?? current.title,
    description: input.description ?? current.description,
    due_date: input.due_date === undefined ? current.due_date : input.due_date,
    status: input.status ?? current.status,
    priority: input.priority ?? current.priority,
    milestone: input.milestone ?? current.milestone,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await access.supabase.from('tasks').update(patch).eq('id', input.task_id).select().single()
  if (error) return NextResponse.json({ error: 'Could not update task.' }, { status: 400 })
  let impact = null
  if (input.due_date && input.due_date !== current.due_date) {
    const [{ data: tasks }, { data: dependencies }] = await Promise.all([
      access.supabase.from('tasks').select('id,title,due_date').eq('event_id', input.event_id),
      access.supabase.from('task_dependencies').select('task_id,depends_on_id').eq('event_id', input.event_id),
    ])
    impact = assessScheduleImpact(tasks ?? [], dependencies ?? [], input.task_id, input.due_date)
  }
  return NextResponse.json({ data, impact })
}
