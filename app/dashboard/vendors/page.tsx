'use client'

import { useEffect, useMemo, useState } from 'react'
import { Building2, Plus, RefreshCw, Search } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard-shell'

type Vendor = { id: string; name: string; category: string; contact_name?: string; email?: string; service_description?: string; verification_status: string }

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ name: '', category: 'Catering', service_description: '' })
  const [message, setMessage] = useState('')

  async function load() {
    const response = await fetch('/api/vendors')
    const data = await response.json()
    setVendors(data.vendors ?? [])
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => vendors.filter((vendor) => `${vendor.name} ${vendor.category}`.toLowerCase().includes(query.toLowerCase())), [vendors, query])

  async function addVendor(event: React.FormEvent) {
    event.preventDefault()
    const response = await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'vendor', ...form }) })
    setMessage(response.ok ? 'Vendor saved as user-entered information.' : 'Could not save vendor.')
    setForm({ name: '', category: 'Catering', service_description: '' })
    load()
  }

  return (
    <DashboardShell>
      <main className="dashboard-content vendor-page">
        <div className="budget-heading">
          <div>
            <p className="eyebrow">Vendor directory</p>
            <h1>Trusted contacts</h1>
            <p className="muted">Keep a reusable shortlist. Event quotes and bookings live on each event workspace.</p>
          </div>
          <Building2 />
        </div>
        <section className="vendor-toolbar">
          <label className="search-field"><Search /><input placeholder="Search vendors" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          <button className="secondary-button" onClick={load}><RefreshCw /> Refresh</button>
        </section>
        <div className="vendor-layout">
          <section className="vendor-card">
            <h2>{filtered.length} vendors</h2>
            <div className="vendor-list">
              {filtered.map((vendor) => (
                <article className="vendor-row" key={vendor.id}>
                  <div>
                    <strong>{vendor.name}</strong>
                    <span>{vendor.category} · {vendor.verification_status === 'verified' ? 'Verified' : 'User-entered'}</span>
                    <p>{vendor.service_description || 'No service description yet.'}</p>
                  </div>
                  <small>{vendor.contact_name || vendor.email || 'No contact added'}</small>
                </article>
              ))}
              {!filtered.length && <p className="muted">Add your first vendor to start building a shortlist.</p>}
            </div>
          </section>
          <form className="vendor-card vendor-form" onSubmit={addVendor}>
            <h2>Add vendor</h2>
            <input required placeholder="Vendor name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input required placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <textarea placeholder="Services, terms, or contact notes" value={form.service_description} onChange={(e) => setForm({ ...form, service_description: e.target.value })} />
            <button className="primary-button"><Plus /> Save vendor</button>
          </form>
        </div>
        {message && <p className="form-message">{message}</p>}
      </main>
    </DashboardShell>
  )
}
