'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type Guest = { id: string; full_name: string; email?: string; household?: string; dietary?: string; plus_ones: number }
type Invitation = { id: string; guest_id: string; status: string; token: string }
type Rsvp = { guest_id: string; status: string; party_size: number }
type Table = { id: string; name: string; capacity: number }
type Seat = { table_id: string; guest_id: string }

export default function GuestsPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [guests, setGuests] = useState<Guest[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [rsvps, setRsvps] = useState<Rsvp[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [seats, setSeats] = useState<Seat[]>([])
  const [form, setForm] = useState({ full_name: '', email: '', household: '', dietary: '', plus_ones: '0' })
  const [csv, setCsv] = useState('full_name,email,household,dietary,plus_ones\n')
  const [preview, setPreview] = useState<Invitation | null>(null)
  const [message, setMessage] = useState('')
  const [table, setTable] = useState({ name: 'Table 1', capacity: '8' })

  async function load() {
    const response = await fetch(`/api/guests?event_id=${eventId}`)
    const data = await response.json()
    setGuests(data.guests ?? [])
    setInvitations(data.invitations ?? [])
    setRsvps(data.rsvps ?? [])
    setTables(data.tables ?? [])
    setSeats(data.seats ?? [])
  }
  useEffect(() => { load() }, [eventId])

  async function post(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await response.json()
    setMessage(response.ok ? 'Saved.' : data.error ?? 'Could not save.')
    if (data.invitations?.[0]) setPreview(data.invitations[0])
    await load()
    return data
  }

  const counts = useMemo(() => ({
    yes: rsvps.filter((row) => row.status === 'yes').reduce((sum, row) => sum + row.party_size, 0),
    no: rsvps.filter((row) => row.status === 'no').length,
    maybe: rsvps.filter((row) => row.status === 'maybe').length,
  }), [rsvps])

  return (
    <div className="stack">
      <section className="metric-grid">
        <article><span>Guests</span><strong>{guests.length}</strong></article>
        <article><span>Yes</span><strong>{counts.yes}</strong></article>
        <article><span>Maybe</span><strong>{counts.maybe}</strong></article>
        <article><span>No</span><strong>{counts.no}</strong></article>
      </section>
      <section className="workspace-split">
        <form className="budget-card stack-form" onSubmit={(e) => { e.preventDefault(); post('/api/guests', { action: 'create', event_id: eventId, guest: { ...form, plus_ones: Number(form.plus_ones) || 0 } }) }}>
          <h2>Add a guest</h2>
          <input required placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Household" value={form.household} onChange={(e) => setForm({ ...form, household: e.target.value })} />
          <input placeholder="Dietary notes" value={form.dietary} onChange={(e) => setForm({ ...form, dietary: e.target.value })} />
          <input type="number" min="0" placeholder="Plus ones" value={form.plus_ones} onChange={(e) => setForm({ ...form, plus_ones: e.target.value })} />
          <button className="primary-button">Add guest</button>
        </form>
        <form className="budget-card stack-form" onSubmit={(e) => { e.preventDefault(); post('/api/guests', { action: 'import', event_id: eventId, csv }) }}>
          <h2>CSV import</h2>
          <textarea rows={7} value={csv} onChange={(e) => setCsv(e.target.value)} aria-label="Guest CSV" />
          <button className="secondary-button">Import guests</button>
        </form>
      </section>
      <section className="budget-card">
        <div className="card-heading">
          <h2>Guest list</h2>
          <button className="primary-button" onClick={() => post('/api/invitations', { event_id: eventId, guest_ids: guests.map((guest) => guest.id), send: true })}>Invite all</button>
        </div>
        <div className="table-list">
          {guests.map((guest) => {
            const invite = invitations.find((item) => item.guest_id === guest.id)
            const rsvp = rsvps.find((item) => item.guest_id === guest.id)
            return (
              <article className="table-row" key={guest.id}>
                <div>
                  <strong>{guest.full_name}</strong>
                  <span>{guest.email || 'No email'} · {guest.household || 'Household unset'}</span>
                </div>
                <span>{rsvp ? `${rsvp.status} (${rsvp.party_size})` : invite?.status ?? 'Not invited'}</span>
                <button className="secondary-button" onClick={() => post('/api/invitations', { event_id: eventId, guest_ids: [guest.id], send: true })}>Invite</button>
                {invite && <button className="text-link" onClick={() => setPreview(invite)}>Preview</button>}
              </article>
            )
          })}
        </div>
      </section>
      {preview && (
        <section className="budget-card">
          <p className="eyebrow">Invitation preview</p>
          <h2>Shareable RSVP link</h2>
          <p className="muted">{typeof window !== 'undefined' ? `${window.location.origin}/invite/${preview.token}` : preview.token}</p>
        </section>
      )}
      <section className="workspace-split">
        <form className="budget-card stack-form" onSubmit={(e) => { e.preventDefault(); post('/api/guests', { action: 'table', event_id: eventId, name: table.name, capacity: Number(table.capacity) }) }}>
          <h2>Seating</h2>
          <input value={table.name} onChange={(e) => setTable({ ...table, name: e.target.value })} />
          <input type="number" min="1" value={table.capacity} onChange={(e) => setTable({ ...table, capacity: e.target.value })} />
          <button className="secondary-button">Add table</button>
        </form>
        <div className="budget-card">
          <h2>Tables</h2>
          {tables.map((row) => (
            <div className="table-row" key={row.id}>
              <div>
                <strong>{row.name}</strong>
                <span>{seats.filter((seat) => seat.table_id === row.id).length}/{row.capacity} seated</span>
              </div>
              <select defaultValue="" onChange={(e) => { if (e.target.value) post('/api/guests', { action: 'seat', event_id: eventId, table_id: row.id, guest_id: e.target.value }) }}>
                <option value="">Seat guest</option>
                {guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.full_name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </section>
      {message && <p className="planner-status" role="status">{message}</p>}
    </div>
  )
}
