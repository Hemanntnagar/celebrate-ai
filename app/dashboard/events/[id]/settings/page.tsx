'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

const fields = [
  ['vibe', 'Vibe'],
  ['colors', 'Colors'],
  ['mustHaves', 'Must-haves'],
  ['avoid', 'Please avoid'],
  ['dietary', 'Dietary notes'],
  ['accessibility', 'Accessibility'],
  ['music', 'Music'],
] as const

export default function EventSettingsPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [prefs, setPrefs] = useState<Record<string, string>>({})
  const [event, setEvent] = useState({ name: '', location: '', guest_count: '', theme: '', status: 'planning', start_date: '', end_date: '' })
  const [status, setStatus] = useState('')

  useEffect(() => {
    fetch(`/api/events/${params.id}`).then((response) => response.json()).then((data) => {
      if (data.event) setEvent({
        name: data.event.name,
        location: data.event.location,
        guest_count: String(data.event.guest_count),
        theme: data.event.theme ?? '',
        status: data.event.status,
        start_date: data.event.start_date,
        end_date: data.event.end_date,
      })
      setPrefs(data.preferences ?? {})
    })
  }, [params.id])

  async function save(eventSubmit: React.FormEvent) {
    eventSubmit.preventDefault()
    const response = await fetch(`/api/events/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...event, guest_count: Number(event.guest_count), preferences: prefs }),
    })
    setStatus(response.ok ? 'Saved.' : 'Could not save changes.')
    if (response.ok) router.refresh()
  }

  async function remove() {
    if (!confirm('Delete this event and all of its records?')) return
    const response = await fetch(`/api/events/${params.id}`, { method: 'DELETE' })
    if (response.ok) router.push('/dashboard/events')
    else setStatus('Only the owner can delete this event.')
  }

  return (
    <form className="stack-form" onSubmit={save}>
      <section className="budget-card">
        <p className="eyebrow">Event details</p>
        <h2>Keep the facts current</h2>
        <div className="form-grid">
          <label className="wide">Name<input value={event.name} onChange={(e) => setEvent({ ...event, name: e.target.value })} /></label>
          <label>Start date<input type="date" value={event.start_date} onChange={(e) => setEvent({ ...event, start_date: e.target.value })} /></label>
          <label>End date<input type="date" value={event.end_date} onChange={(e) => setEvent({ ...event, end_date: e.target.value })} /></label>
          <label className="wide">Location<input value={event.location} onChange={(e) => setEvent({ ...event, location: e.target.value })} /></label>
          <label>Guest count<input type="number" min="1" value={event.guest_count} onChange={(e) => setEvent({ ...event, guest_count: e.target.value })} /></label>
          <label>Status
            <select value={event.status} onChange={(e) => setEvent({ ...event, status: e.target.value })}>
              {['planning', 'confirmed', 'in_progress', 'completed', 'cancelled'].map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="wide">Theme<input value={event.theme} onChange={(e) => setEvent({ ...event, theme: e.target.value })} /></label>
        </div>
      </section>
      <section className="budget-card">
        <p className="eyebrow">Preferences</p>
        <h2>Guide every later decision</h2>
        <div className="form-grid">
          {fields.map(([key, label]) => (
            <label key={key} className="wide">{label}<input value={prefs[key] ?? ''} onChange={(e) => setPrefs({ ...prefs, [key]: e.target.value })} /></label>
          ))}
        </div>
      </section>
      {status && <p className="planner-status" role="status">{status}</p>}
      <div className="wizard-actions">
        <button type="button" className="secondary-button" onClick={remove}>Delete event</button>
        <button className="primary-button">Save changes</button>
      </div>
    </form>
  )
}
