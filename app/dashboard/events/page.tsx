import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/dashboard-shell'
import { formatDate } from '@/lib/money'

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: events } = await supabase.from('events').select('id,name,event_type,start_date,location,guest_count,status').order('start_date')
  return (
    <DashboardShell name={user?.user_metadata?.full_name}>
      <div className="page-content">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your planning space</p>
            <h1>My events</h1>
          </div>
          <Link href="/dashboard/events/new" className="primary-button inline-button">+ New event</Link>
        </div>
        {events?.length ? (
          <div className="event-list">
            {events.map((event) => (
              <Link href={`/dashboard/events/${event.id}`} className="event-row" key={event.id}>
                <div>
                  <span className="event-type">{event.event_type}</span>
                  <h3>{event.name}</h3>
                </div>
                <div>
                  <strong>{formatDate(event.start_date)}</strong>
                  <span>{event.location} · {event.guest_count} guests</span>
                </div>
                <span className="status-dot">{event.status}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No events yet</h3>
            <p>Create a wedding, birthday, or gathering and we will keep every detail in one workspace.</p>
            <Link href="/dashboard/events/new" className="primary-button inline-button">Create an event</Link>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
