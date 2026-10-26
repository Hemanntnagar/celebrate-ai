import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { messageSchema, planSchema } from '@/lib/planner/schema'

const recentRequests = new Map<string, number>()
const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

function withAmounts(plan: any, budget: number | null) {
  const total = plan.budget.allocations.reduce((sum: number, item: any) => sum + item.percentage, 0)
  if (Math.abs(total - 100) > 0.01) throw new Error('Budget allocations must total 100%.')
  return { ...plan, budget: { ...plan.budget, allocations: plan.budget.allocations.map((item: any) => ({ ...item, amount: budget === null ? null : Math.round(budget * item.percentage) / 100 })) } }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const parsed = messageSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Please provide a planning message.' }, { status: 400 })
  const last = recentRequests.get(user.id) ?? 0
  if (Date.now() - last < 4000) return NextResponse.json({ error: 'Please wait a moment before sending another request.' }, { status: 429 })
  recentRequests.set(user.id, Date.now())
  const { data: event } = await supabase.from('events').select('id,name,event_type,start_date,end_date,location,guest_count,budget,currency,theme').eq('id', request.headers.get('x-event-id') ?? '').eq('owner_id', user.id).single()
  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  let sessionId = parsed.data.sessionId
  if (sessionId) { const { data: session } = await supabase.from('planning_sessions').select('id').eq('id', sessionId).eq('event_id', event.id).eq('owner_id', user.id).single(); if (!session) return NextResponse.json({ error: 'Planning session not found.' }, { status: 404 }) }
  else { const { data: session, error } = await supabase.from('planning_sessions').insert({ owner_id: user.id, event_id: event.id }).select('id').single(); if (error || !session) return NextResponse.json({ error: 'Could not start planning session.' }, { status: 500 }); sessionId = session.id }
  const { data: preferences } = await supabase.from('event_preferences').select('preferences').eq('event_id', event.id).single()
  const { data: history } = await supabase.from('planning_messages').select('role,content').eq('session_id', sessionId).order('created_at', { ascending: true }).limit(12)
  await supabase.from('planning_messages').insert({ session_id: sessionId, owner_id: user.id, role: 'user', content: parsed.data.message })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'AI planning is not configured. Add OPENAI_API_KEY to enable generation.', sessionId }, { status: 503 })
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 20000, maxRetries: 2 })
  try {
    const completion = await client.chat.completions.create({ model, temperature: 0.4, response_format: { type: 'json_object' }, messages: [
      { role: 'system', content: `You are Celebrate AI, an event planning expert. Return ONLY valid JSON matching the requested plan shape. Generate practical ideas, label all vendor pricing and availability exactly unverified, and ask clarifying questions. Budget allocation percentages MUST total exactly 100. Never invent confirmed vendors, prices, or availability. Event context: ${JSON.stringify(event)}. Saved preferences: ${JSON.stringify(preferences?.preferences ?? {})}` },
      ...(history ?? []).filter((item) => item.role === 'user' || item.role === 'assistant').map((item) => ({ role: item.role as 'user' | 'assistant', content: item.content })),
      { role: 'user', content: parsed.data.message },
    ] })
    const raw = completion.choices[0]?.message?.content
    const candidate = planSchema.parse(JSON.parse(raw ?? '{}'))
    const plan = withAmounts(candidate, event.budget)
    const { data: latest } = await supabase.from('event_plans').select('version').eq('event_id', event.id).order('version', { ascending: false }).limit(1).maybeSingle()
    const { data: saved, error } = await supabase.from('event_plans').insert({ event_id: event.id, owner_id: user.id, session_id: sessionId, version: (latest?.version ?? 0) + 1, plan, status: 'draft' }).select('id,version,plan').single()
    if (error) throw error
    await supabase.from('planning_messages').insert({ session_id: sessionId, owner_id: user.id, role: 'assistant', content: JSON.stringify(plan) })
    return NextResponse.json({ sessionId, plan: saved })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message.includes('Budget') ? error.message : 'The planner could not produce a valid proposal. Please try again.', sessionId }, { status: 502 })
  }
}
