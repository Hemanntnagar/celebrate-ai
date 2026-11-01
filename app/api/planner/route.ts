import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { requireEventPermission } from '@/lib/auth/access'
import { messageSchema, planSchema, withAmounts } from '@/lib/planner/schema'

const recentRequests = new Map<string, number>()

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get('event_id') ?? request.headers.get('x-event-id')
  if (!eventId) return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
  const access = await requireEventPermission(eventId, 'event.read')
  if (access.error) return access.error
  const { data: plans } = await access.supabase.from('event_plans').select('id,version,status,plan,created_at,approved_at,applied_at').eq('event_id', eventId).order('version', { ascending: false }).limit(8)
  return NextResponse.json({ plans: plans ?? [] })
}

export async function POST(request: Request) {
  const eventId = request.headers.get('x-event-id') ?? new URL(request.url).searchParams.get('event_id')
  if (!eventId) return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
  const access = await requireEventPermission(eventId, 'plan.generate')
  if (access.error) return access.error
  const parsed = messageSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Please provide a planning message.' }, { status: 400 })
  const last = recentRequests.get(access.user!.id) ?? 0
  if (Date.now() - last < 4000) return NextResponse.json({ error: 'Please wait a moment before sending another request.' }, { status: 429 })
  recentRequests.set(access.user!.id, Date.now())

  const event = access.event!
  let sessionId = parsed.data.sessionId
  if (sessionId) {
    const { data: session } = await access.supabase.from('planning_sessions').select('id').eq('id', sessionId).eq('event_id', event.id).single()
    if (!session) return NextResponse.json({ error: 'Planning session not found.' }, { status: 404 })
  } else {
    const { data: session, error } = await access.supabase.from('planning_sessions').insert({ owner_id: access.user!.id, event_id: event.id }).select('id').single()
    if (error || !session) return NextResponse.json({ error: 'Could not start planning session.' }, { status: 500 })
    sessionId = session.id
  }

  const { data: preferences } = await access.supabase.from('event_preferences').select('preferences').eq('event_id', event.id).maybeSingle()
  const { data: history } = await access.supabase.from('planning_messages').select('role,content').eq('session_id', sessionId).order('created_at', { ascending: true }).limit(12)
  await access.supabase.from('planning_messages').insert({ session_id: sessionId, owner_id: access.user!.id, role: 'user', content: parsed.data.message })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'AI planning is not configured. Add OPENAI_API_KEY to enable generation.', sessionId }, { status: 503 })
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 20000 })
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are Celebrate AI, an event planning expert. Return ONLY valid JSON matching this shape: {"concept":string,"theme":string,"summary":string,"suggestions":{"decoration":string[],"catering":string[],"entertainment":string[],"activities":string[]},"budget":{"allocations":[{"category":string,"percentage":number,"note":string}],"assumptions":string[]},"tasks":[{"title":string,"milestone":string,"due_offset_days":number}],"vendors":[{"category":string,"criteria":string[],"availability":"unverified","pricing":"unverified"}],"risks":[{"risk":string,"mitigation":string,"severity":"low"|"medium"|"high"}],"questions":string[]}. Budget allocation percentages MUST total exactly 100. Label vendor availability and pricing exactly unverified. Never invent confirmed vendors, prices, or bookings. Event context: ${JSON.stringify(event)}. Saved preferences: ${JSON.stringify(preferences?.preferences ?? {})}`,
        },
        ...(history ?? []).filter((item) => item.role === 'user' || item.role === 'assistant').map((item) => ({
          role: item.role as 'user' | 'assistant',
          content: item.content,
        })),
        { role: 'user', content: parsed.data.message },
      ],
    })
    const candidate = planSchema.parse(JSON.parse(completion.choices[0]?.message?.content ?? '{}'))
    const plan = withAmounts(candidate, event.budget)
    const { data: latest } = await access.supabase.from('event_plans').select('version').eq('event_id', event.id).order('version', { ascending: false }).limit(1).maybeSingle()
    const { data: saved, error } = await access.supabase
      .from('event_plans')
      .insert({ event_id: event.id, owner_id: access.user!.id, session_id: sessionId, version: (latest?.version ?? 0) + 1, plan, status: 'draft' })
      .select('id,version,plan,status')
      .single()
    if (error) throw error
    await access.supabase.from('planning_messages').insert({ session_id: sessionId, owner_id: access.user!.id, role: 'assistant', content: JSON.stringify(plan) })
    return NextResponse.json({ sessionId, plan: saved })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error && error.message.includes('Budget') ? error.message : 'The planner could not produce a valid proposal. Please try again.',
      sessionId,
    }, { status: 502 })
  }
}
