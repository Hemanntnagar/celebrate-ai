import Link from 'next/link'
import { CalendarDays, MapPin, Sparkles, Users } from 'lucide-react'
import { formatDate, formatMoney } from '@/lib/money'
import { createClient } from '@/lib/supabase/server'

export default async function EventOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: event } = await supabase.from('events').select('*').eq('id', id).single()
  const [{ data: budget }, { data: tasks }, { data: guests }, { data: rsvps }, { data: bookings }, { data: plan }, { data: preferences }] = await Promise.all([
    supabase.from('event_budgets').select('total_minor,currency').eq('event_id', id).maybeSingle(),
    supabase.from('tasks').select('id,status').eq('event_id', id),
    supabase.from('guests').select('id,plus_ones').eq('event_id', id),
    supabase.from('rsvps').select('status,party_size').eq('event_id', id),
    supabase.from('vendor_bookings').select('id,status').eq('event_id', id),
    supabase.from('event_plans').select('version,status').eq('event_id', id).order('version', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('event_preferences').select('preferences').eq('event_id', id).maybeSingle(),
  ])
  const prefs = (preferences?.preferences ?? {}) as Record<string, string>
  const done = tasks?.filter((task) => task.status === 'done').length ?? 0
  const yes = rsvps?.filter((row) => row.status === 'yes').reduce((sum, row) => sum + row.party_size, 0) ?? 0

  return (
    <>
      <div className="detail-grid">
        <div className="detail-card"><CalendarDays /><span>Date</span><strong>{formatDate(event?.start_date, { month: 'long', day: 'numeric', year: 'numeric' })}</strong></div>
        <div className="detail-card"><MapPin /><span>Location</span><strong>{event?.location}</strong></div>
        <div className="detail-card"><Users /><span>Expected guests</span><strong>{event?.guest_count} people</strong></div>
      </div>
      <section className="metric-grid">
        <article><span>Budget</span><strong>{budget ? formatMoney(budget.total_minor, budget.currency) : 'Not set'}</strong></article>
        <article><span>Tasks complete</span><strong>{done}/{tasks?.length ?? 0}</strong></article>
        <article><span>RSVP yes</span><strong>{yes}</strong></article>
        <article><span>Vendors booked</span><strong>{bookings?.filter((row) => row.status === 'booked' || row.status === 'completed').length ?? 0}</strong></article>
      </section>
      <div className="workspace-split">
        <section className="budget-card">
          <p className="eyebrow">Latest plan</p>
          <h2>{plan ? `Version ${plan.version}` : 'No plan yet'}</h2>
          <p className="muted">{plan ? `Status: ${plan.status}` : 'Ask the planner for a reviewable proposal, then apply the pieces you want.'}</p>
          <Link className="primary-button inline-button" href={`/dashboard/events/${id}/plan`}>Open planner</Link>
        </section>
        <section className="budget-card">
          <p className="eyebrow">Preferences</p>
          <h2>{prefs.vibe || event?.theme || 'Still taking shape'}</h2>
          <p className="muted">{prefs.mustHaves || 'Add colors, must-haves, and access notes so planning stays consistent.'}</p>
          <Link className="text-link" href={`/dashboard/events/${id}/settings`}>Edit preferences</Link>
        </section>
      </div>
      <section className="next-step">
        <div className="sparkle"><Sparkles /></div>
        <div>
          <p className="eyebrow">Keep going</p>
          <h3>{guests?.length ? `${guests.length} guests on the list` : 'Invite the people who matter'}</h3>
          <p>Budget, vendors, tasks, and RSVPs all stay attached to this event.</p>
        </div>
      </section>
    </>
  )
}
