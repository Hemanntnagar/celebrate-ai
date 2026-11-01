'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Member = { id: string; email: string; role: string; status: string }
type Activity = { id: string; summary: string; actor_name?: string; created_at: string }

export default function TeamPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [members, setMembers] = useState<Member[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [form, setForm] = useState({ email: '', role: 'coordinator' })
  const [message, setMessage] = useState('')

  async function load() {
    const [team, feed] = await Promise.all([
      fetch(`/api/members?event_id=${eventId}`).then((response) => response.json()),
      fetch(`/api/activity?event_id=${eventId}`).then((response) => response.json()),
    ])
    setMembers(team.members ?? [])
    setActivity(feed.activity ?? [])
  }
  useEffect(() => { load() }, [eventId])

  async function invite(event: React.FormEvent) {
    event.preventDefault()
    const response = await fetch('/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'invite', event_id: eventId, ...form }) })
    const data = await response.json()
    setMessage(response.ok ? 'Invite sent.' : data.error ?? 'Could not invite.')
    await load()
  }

  return (
    <div className="workspace-split">
      <section className="budget-card">
        <p className="eyebrow">Membership</p>
        <h2>Roles stay narrow on purpose</h2>
        <form className="stack-form" onSubmit={invite}>
          <input required type="email" placeholder="teammate@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="planner">Planner</option>
            <option value="coordinator">Coordinator</option>
            <option value="viewer">Viewer</option>
          </select>
          <button className="primary-button">Invite teammate</button>
        </form>
        <div className="table-list">
          {members.map((member) => (
            <article className="table-row" key={member.id}>
              <div>
                <strong>{member.email}</strong>
                <span>{member.status}</span>
              </div>
              <select value={member.role} disabled={member.role === 'owner'} onChange={(e) => fetch('/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', event_id: eventId, member_id: member.id, role: e.target.value }) }).then(load)}>
                {['owner', 'planner', 'coordinator', 'viewer'].map((role) => <option key={role}>{role}</option>)}
              </select>
            </article>
          ))}
        </div>
        {message && <p className="planner-status" role="status">{message}</p>}
      </section>
      <section className="budget-card">
        <p className="eyebrow">Team activity</p>
        <h2>What changed recently</h2>
        <div className="table-list">
          {activity.map((item) => (
            <article className="table-row" key={item.id}>
              <div>
                <strong>{item.summary}</strong>
                <span>{item.actor_name} · {new Date(item.created_at).toLocaleString()}</span>
              </div>
            </article>
          ))}
          {!activity.length && <p className="muted">Activity will appear as the team plans, budgets, and invites.</p>}
        </div>
      </section>
    </div>
  )
}
