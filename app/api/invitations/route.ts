import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logActivity } from '@/lib/activity'
import { requireEventPermission } from '@/lib/auth/access'
import { buildInvitation } from '@/lib/guests/csv'

const bodySchema = z.object({
  event_id: z.string().uuid(),
  guest_ids: z.array(z.string().uuid()).min(1).max(200),
  send: z.boolean().optional(),
})

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return { status: 'queued' as const }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.INVITE_FROM_EMAIL ?? 'Celebrate AI <invites@example.com>', to, subject, html }),
  })
  return { status: response.ok ? 'sent' as const : 'failed' as const }
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid invitation request.' }, { status: 400 })
  const access = await requireEventPermission(parsed.data.event_id, 'guest.write')
  if (access.error) return access.error
  const { data: guests } = await access.supabase.from('guests').select('id,full_name,email').eq('event_id', parsed.data.event_id).in('id', parsed.data.guest_ids)
  const origin = new URL(request.url).origin
  const created = []
  for (const guest of guests ?? []) {
    const token = crypto.randomUUID().replace(/-/g, '')
    const invite = buildInvitation(access.event!.name, guest.full_name, token, origin)
    let status: 'draft' | 'queued' | 'sent' | 'failed' = parsed.data.send ? 'queued' : 'draft'
    if (parsed.data.send && guest.email) {
      const sent = await sendEmail(guest.email, invite.subject, invite.preview_html)
      status = sent.status
    }
    const { data } = await access.supabase.from('invitations').insert({
      event_id: parsed.data.event_id,
      guest_id: guest.id,
      owner_id: access.user!.id,
      token,
      subject: invite.subject,
      preview_html: invite.preview_html,
      status,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    }).select('id,token,status,guest_id').single()
    if (data) created.push({ ...data, url: invite.url })
  }
  await logActivity(access.supabase, { eventId: parsed.data.event_id, user: access.user, action: 'created', entityType: 'invitation', summary: `Prepared ${created.length} invitations` })
  return NextResponse.json({ invitations: created })
}
