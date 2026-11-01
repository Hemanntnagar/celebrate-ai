import type { SupabaseClient, User } from '@supabase/supabase-js'

export async function logActivity(
  supabase: SupabaseClient,
  input: {
    eventId: string
    user: User | null
    action: string
    entityType: string
    entityId?: string
    summary: string
  },
) {
  await supabase.from('activity_log').insert({
    event_id: input.eventId,
    actor_id: input.user?.id ?? null,
    actor_name: (input.user?.user_metadata?.full_name as string | undefined) ?? input.user?.email ?? 'Someone',
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    summary: input.summary,
  })
}

export async function notify(
  supabase: SupabaseClient,
  input: { eventId?: string; userId: string; title: string; body: string; kind: string },
) {
  await supabase.from('notifications').insert({
    event_id: input.eventId ?? null,
    user_id: input.userId,
    title: input.title,
    body: input.body,
    kind: input.kind,
  })
}
