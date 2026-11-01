import Link from 'next/link'
import { cookies } from 'next/headers'
import { ArrowUpRight, CalendarDays, MapPin, Sparkles, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/dashboard-shell'
import { formatDate } from '@/lib/money'
import { LAST_EVENT_COOKIE } from '@/lib/workspace'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: events } = await supabase.from('events').select('id,name,event_type,start_date,location,guest_count,status').order('start_date', { ascending: true })
  const lastId = (await cookies()).get(LAST_EVENT_COOKIE)?.value
  const lastEvent = events?.find((event) => event.id === lastId) ?? events?.[0]
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there'
  const upcoming = events?.filter((event) => event.start_date >= new Date().toISOString().slice(0, 10)).length ?? 0

  return (
    <DashboardShell name={user?.user_metadata?.full_name}>
      <div className="dashboard-content">
        <section className="hero-banner">
          <div>
            <p className="eyebrow">Your celebration space</p>
            <h1>Make it memorable, {firstName}.</h1>
            <p>Keep the big picture close and the details beautifully organized.</p>
          </div>
          <div className="hero-orbit">✦</div>
        </section>
        <section className="metric-grid">
          <article><span>Events</span><strong>{events?.length ?? 0}</strong></article>
          <article><span>Upcoming</span><strong>{upcoming}</strong></article>
          <article><span>Guests planned</span><strong>{events?.reduce((sum, event) => sum + (event.guest_count ?? 0), 0) ?? 0}</strong></article>
          <article><span>Last opened</span><strong>{lastEvent?.name ?? 'None yet'}</strong></article>
        </section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">At a glance</p>
            <h2>Your upcoming moments</h2>
          </div>
          <Link href="/dashboard/events" className="text-link">View all <ArrowUpRight /></Link>
        </div>
        {events?.length ? (
          <div className="event-grid">
            {events.slice(0, 3).map((event) => (
              <Link href={`/dashboard/events/${event.id}`} className="event-card" key={event.id}>
                <div className="event-card-top">
                  <span className="event-type">{event.event_type}</span>
                  <span className="status-dot">{event.status}</span>
                </div>
                <h3>{event.name}</h3>
                <div className="event-meta">
                  <span><CalendarDays />{formatDate(event.start_date)}</span>
                  <span><MapPin />{event.location}</span>
                  <span><Users />{event.guest_count} guests</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <CalendarDays />
            <h3>Your first celebration starts here</h3>
            <p>Turn an idea into a clear, confident plan.</p>
            <Link href="/dashboard/events/new" className="primary-button inline-button">Create an event</Link>
          </div>
        )}
        {lastEvent && (
          <section className="next-step">
            <div className="sparkle"><Sparkles /></div>
            <div>
              <p className="eyebrow">Continue where you left off</p>
              <h3>{lastEvent.name}</h3>
              <p><Link className="text-link" href={`/dashboard/events/${lastEvent.id}`}>Open workspace</Link></p>
            </div>
          </section>
        )}
      </div>
    </DashboardShell>
  )
}
