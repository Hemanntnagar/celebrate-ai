'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatMoney, toMinor } from '@/lib/money'

type Vendor = { id: string; name: string; category: string; verification_status: string; service_description?: string }
type Quote = { id: string; vendor_id: string; amount_minor: number; currency: string; included_services: string; availability?: string; verification_status: string }
type Booking = { id: string; vendor_id: string; status: string; commitment_minor: number; currency: string; payment_schedule?: Array<{ label: string; amount_minor: number; due_date: string }> }
type Contract = { id: string; booking_id: string; title: string }

const statuses = ['suggested', 'contacted', 'quote_received', 'negotiating', 'booked', 'completed', 'cancelled']

export default function EventVendorsPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [message, setMessage] = useState('')
  const [vendor, setVendor] = useState({ name: '', category: 'Catering', service_description: '' })
  const [quote, setQuote] = useState({ vendor_id: '', amount: '', included_services: '', availability: '' })
  const [booking, setBooking] = useState({ vendor_id: '', quote_id: '', commitment: '', due_date: '', label: 'Deposit' })

  async function load() {
    const response = await fetch(`/api/vendors?event_id=${eventId}`)
    const data = await response.json()
    setVendors(data.vendors ?? [])
    setQuotes(data.quotes ?? [])
    setBookings(data.bookings ?? [])
    setContracts(data.contracts ?? [])
  }
  useEffect(() => { load() }, [eventId])

  async function post(body: Record<string, unknown>) {
    const response = await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await response.json()
    setMessage(response.ok ? 'Saved.' : data.error ?? 'Could not save.')
    await load()
  }

  const comparison = useMemo(() => [...quotes].sort((a, b) => a.amount_minor - b.amount_minor), [quotes])

  return (
    <div className="stack">
      <section className="workspace-split">
        <form className="budget-card stack-form" onSubmit={(e) => { e.preventDefault(); post({ action: 'vendor', ...vendor }) }}>
          <p className="eyebrow">Directory</p>
          <h2>Add a trusted vendor</h2>
          <input required placeholder="Vendor name" value={vendor.name} onChange={(e) => setVendor({ ...vendor, name: e.target.value })} />
          <input required placeholder="Category" value={vendor.category} onChange={(e) => setVendor({ ...vendor, category: e.target.value })} />
          <textarea placeholder="Services or notes" value={vendor.service_description} onChange={(e) => setVendor({ ...vendor, service_description: e.target.value })} />
          <button className="primary-button">Save vendor</button>
        </form>
        <form className="budget-card stack-form" onSubmit={(e) => { e.preventDefault(); post({ action: 'quote', event_id: eventId, vendor_id: quote.vendor_id, amount_minor: toMinor(Number(quote.amount) || 0), currency: 'USD', included_services: quote.included_services, availability: quote.availability }) }}>
          <p className="eyebrow">Quotation</p>
          <h2>Compare only what you entered</h2>
          <select required value={quote.vendor_id} onChange={(e) => setQuote({ ...quote, vendor_id: e.target.value })}>
            <option value="">Vendor</option>
            {vendors.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <input required type="number" placeholder="Amount" value={quote.amount} onChange={(e) => setQuote({ ...quote, amount: e.target.value })} />
          <input required placeholder="Included services" value={quote.included_services} onChange={(e) => setQuote({ ...quote, included_services: e.target.value })} />
          <input placeholder="Availability" value={quote.availability} onChange={(e) => setQuote({ ...quote, availability: e.target.value })} />
          <button className="primary-button">Add quote</button>
        </form>
      </section>
      <section className="budget-card">
        <p className="eyebrow">Comparison</p>
        <h2>{comparison.length} quotes</h2>
        <div className="quote-grid">
          {comparison.map((row) => (
            <article className="quote-card" key={row.id}>
              <strong>{vendors.find((vendorRow) => vendorRow.id === row.vendor_id)?.name ?? 'Vendor'}</strong>
              <b>{formatMoney(row.amount_minor, row.currency)}</b>
              <span>{row.included_services}</span>
              <small>{row.availability || 'Availability not supplied'} · {row.verification_status === 'verified' ? 'Verified' : 'User-entered'}</small>
            </article>
          ))}
          {!comparison.length && <p className="muted">Add quotes to compare side by side.</p>}
        </div>
      </section>
      <form className="budget-card stack-form" onSubmit={(e) => { e.preventDefault(); post({ action: 'booking', event_id: eventId, vendor_id: booking.vendor_id, quote_id: booking.quote_id || null, commitment_minor: toMinor(Number(booking.commitment) || 0), currency: 'USD', payment_schedule: booking.due_date ? [{ label: booking.label, amount_minor: toMinor(Number(booking.commitment) || 0), due_date: booking.due_date }] : [] }) }}>
        <p className="eyebrow">Booking pipeline</p>
        <h2>Reserve with a payment schedule</h2>
        <div className="form-grid">
          <label>Vendor
            <select required value={booking.vendor_id} onChange={(e) => setBooking({ ...booking, vendor_id: e.target.value })}>
              <option value="">Choose</option>
              {vendors.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
          <label>Quote
            <select value={booking.quote_id} onChange={(e) => setBooking({ ...booking, quote_id: e.target.value })}>
              <option value="">None</option>
              {quotes.map((row) => <option key={row.id} value={row.id}>{formatMoney(row.amount_minor, row.currency)}</option>)}
            </select>
          </label>
          <label>Commitment<input type="number" required value={booking.commitment} onChange={(e) => setBooking({ ...booking, commitment: e.target.value })} /></label>
          <label>First payment due<input type="date" value={booking.due_date} onChange={(e) => setBooking({ ...booking, due_date: e.target.value })} /></label>
        </div>
        <button className="primary-button">Create booking</button>
      </form>
      <section className="booking-list">
        {bookings.map((row) => (
          <div className="booking-row" key={row.id}>
            <div>
              <strong>{vendors.find((vendorRow) => vendorRow.id === row.vendor_id)?.name ?? 'Vendor'}</strong>
              <span>{formatMoney(row.commitment_minor, row.currency)}</span>
              {(row.payment_schedule ?? []).map((item) => <small key={item.label}>{item.label} due {item.due_date}</small>)}
              {contracts.filter((item) => item.booking_id === row.id).map((item) => <small key={item.id}>Contract: {item.title}</small>)}
            </div>
            <select value={row.status} onChange={(e) => post({ action: 'status', event_id: eventId, booking_id: row.id, to_status: e.target.value })}>
              {statuses.map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
            </select>
            <button className="secondary-button" onClick={() => post({ action: 'contract', event_id: eventId, booking_id: row.id, title: 'Service agreement' })}>Add contract</button>
          </div>
        ))}
      </section>
      {message && <p className="form-message">{message}</p>}
    </div>
  )
}
