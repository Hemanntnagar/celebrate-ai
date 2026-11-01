'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Invite = {
  event?: { name: string; start_date: string; location: string; theme?: string }
  guest?: { full_name: string; dietary?: string; plus_ones?: number }
  rsvp?: { status: string; party_size: number }
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [form, setForm] = useState({ status: 'yes', party_size: '1', meal_choice: '', message: '' })
  const [status, setStatus] = useState('Loading invitation…')

  useEffect(() => {
    fetch(`/api/rsvp/${token}`).then(async (response) => {
      const data = await response.json()
      if (!response.ok) setStatus(data.error)
      else {
        setInvite(data)
        setForm((current) => ({ ...current, party_size: String(data.guest?.plus_ones ? data.guest.plus_ones + 1 : 1) }))
        setStatus('')
      }
    })
  }, [token])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const response = await fetch(`/api/rsvp/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, party_size: Number(form.party_size) }),
    })
    setStatus(response.ok ? 'Thank you. Your RSVP is saved.' : 'Could not save your RSVP.')
  }

  if (!invite?.event) {
    return <main className="center-page"><div className="success-card"><h1>Invitation</h1><p className="muted">{status}</p></div></main>
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="brand-mark">Celebrate<span>AI</span></div>
        <div>
          <p className="eyebrow">You are invited</p>
          <h1>{invite.event.name}</h1>
          <p className="muted">{invite.event.location} · {invite.event.start_date}</p>
        </div>
        <div className="visual-note">{invite.event.theme || 'Please RSVP when you can.'}</div>
      </section>
      <section className="auth-card">
        <div>
          <p className="eyebrow">Hello {invite.guest?.full_name}</p>
          <h2>Will you join us?</h2>
        </div>
        <form onSubmit={submit} className="stack-form">
          <label>Response
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="yes">Joyfully yes</option>
              <option value="maybe">Maybe</option>
              <option value="no">Regretfully no</option>
            </select>
          </label>
          <label>Party size<input type="number" min="1" max="20" value={form.party_size} onChange={(e) => setForm({ ...form, party_size: e.target.value })} /></label>
          <label>Meal choice<input value={form.meal_choice} onChange={(e) => setForm({ ...form, meal_choice: e.target.value })} /></label>
          <label>Note<textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
          {status && <p className="planner-status" role="status">{status}</p>}
          <button className="primary-button">Send RSVP</button>
        </form>
      </section>
    </main>
  )
}
