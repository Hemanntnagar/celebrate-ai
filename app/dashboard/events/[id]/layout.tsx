import { notFound } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard-shell'
import { EventWorkspace } from '@/components/event-workspace'
import { getEventAccess } from '@/lib/auth/access'

export const dynamic = 'force-dynamic'

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user, event, role } = await getEventAccess(id)
  if (!event) notFound()
  return (
    <DashboardShell name={user?.user_metadata?.full_name}>
      <EventWorkspace eventId={event.id} name={event.name} role={role}>
        {children}
      </EventWorkspace>
    </DashboardShell>
  )
}
