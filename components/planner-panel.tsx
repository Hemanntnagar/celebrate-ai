'use client'

import { useEffect, useState } from 'react'

type Proposal = { id: string; version: number; plan: Record<string, any>; status?: string }

export function PlannerPanel({ eventId }: { eventId: string }) {
  const [message, setMessage] = useState('Help me create a complete plan for this celebration.')
  const [sessionId, setSessionId] = useState<string>()
  const [proposal, setProposal] = useState<Proposal>()
  const [history, setHistory] = useState<Proposal[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/planner?event_id=${eventId}`)
      .then((response) => response.json())
      .then((data) => setHistory(data.plans ?? []))
      .catch(() => undefined)
  }, [eventId])

  async function generate() {
    setBusy(true)
    setStatus('Generating a reviewable proposal…')
    try {
      const response = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-event-id': eventId },
        body: JSON.stringify({ sessionId, message }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setSessionId(data.sessionId)
      setProposal(data.plan)
      setStatus('Review every section before approving. Nothing is applied until you say so.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function approve(apply: boolean) {
    if (!proposal) return
    setBusy(true)
    const response = await fetch('/api/planner/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: proposal.id, plan: proposal.plan, apply }),
    })
    const data = await response.json()
    setStatus(response.ok
      ? apply
        ? `Applied version ${data.version}. Budget categories and tasks were created from the approved plan.`
        : `Approved version ${data.version}. You can apply it when you are ready.`
      : data.error)
    setBusy(false)
  }

  const plan = proposal?.plan

  return (
    <section className="planner-panel">
      <div className="planner-header">
        <div>
          <p className="eyebrow">Celebrate AI planner</p>
          <h2>Make the thoughtful decisions easier.</h2>
          <p className="muted">Ask for a concept, budget, timeline, vendors, or revisions. Every proposal stays a draft until you approve it.</p>
        </div>
        <span className="ai-status">OpenAI assisted</span>
      </div>
      <div className="planner-compose">
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} aria-label="Planning request" rows={3} />
        <button className="primary-button" disabled={busy || message.trim().length < 2} onClick={generate}>{busy ? 'Working…' : 'Generate proposal'}</button>
      </div>
      {status && <p className="planner-status" role="status">{status}</p>}
      {history.length > 0 && (
        <p className="muted">Previous versions: {history.map((item) => `v${item.version} (${item.status})`).join(' · ')}</p>
      )}
      {plan && (
        <div className="proposal-review">
          <div className="proposal-title">
            <div>
              <p className="eyebrow">Draft version {proposal.version}</p>
              <h3>{plan.concept}</h3>
            </div>
            <div className="proposal-actions">
              <button className="secondary-button" disabled={busy} onClick={() => approve(false)}>Approve only</button>
              <button className="primary-button" disabled={busy} onClick={() => approve(true)}>Approve and apply</button>
            </div>
          </div>
          <label>Theme<input value={plan.theme} onChange={(event) => setProposal({ ...proposal, plan: { ...plan, theme: event.target.value } })} /></label>
          <label>Summary<textarea rows={3} value={plan.summary} onChange={(event) => setProposal({ ...proposal, plan: { ...plan, summary: event.target.value } })} /></label>
          <div className="proposal-columns">
            <div>
              <h4>Suggestions</h4>
              <p><b>Decor:</b> {plan.suggestions.decoration.join(' · ')}</p>
              <p><b>Catering:</b> {plan.suggestions.catering.join(' · ')}</p>
              <p><b>Entertainment:</b> {plan.suggestions.entertainment.join(' · ')}</p>
              <p><b>Activities:</b> {plan.suggestions.activities.join(' · ')}</p>
            </div>
            <div>
              <h4>Budget proposal</h4>
              {plan.budget.allocations.map((item: { category: string; percentage: number; amount: number | null }) => (
                <p key={item.category}><b>{item.category}:</b> {item.percentage}% {item.amount === null ? '(amount unverified)' : `(${item.amount.toLocaleString()} event currency)`}</p>
              ))}
            </div>
          </div>
          <div className="proposal-columns">
            <div>
              <h4>Milestones</h4>
              {plan.tasks.map((task: { title: string; milestone: string; due_offset_days: number }) => (
                <p key={task.title}><b>{task.milestone}:</b> {task.title} ({task.due_offset_days} days before)</p>
              ))}
            </div>
            <div>
              <h4>Vendor criteria</h4>
              {plan.vendors.map((vendor: { category: string; criteria: string[] }) => (
                <p key={vendor.category}><b>{vendor.category}:</b> {vendor.criteria.join(', ')} <em>availability and pricing unverified</em></p>
              ))}
            </div>
          </div>
          <div>
            <h4>Risks and questions</h4>
            {plan.risks.map((risk: { risk: string; mitigation: string; severity: string }) => (
              <p key={risk.risk}><b>{risk.severity}:</b> {risk.risk} — {risk.mitigation}</p>
            ))}
            {plan.questions.map((question: string) => <p key={question}>Question: {question}</p>)}
          </div>
        </div>
      )}
    </section>
  )
}
