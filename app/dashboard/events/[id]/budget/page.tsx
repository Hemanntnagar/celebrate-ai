'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatMoney, toMinor } from '@/lib/money'

type BudgetData = {
  budget: { id: string; total_minor: number; currency: string } | null
  categories: Array<{ id: string; name: string; allocation_minor: number }>
  items: Array<{ id: string; category_id: string; label: string; planned_minor: number; vendor_commitment_minor: number }>
  expenses: Array<{ id: string; category_id: string; description: string; amount_minor: number; vendor_name?: string }>
  payments: Array<{ id: string; expense_id: string; amount_minor: number }>
  metrics: any
}

export default function BudgetPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [data, setData] = useState<BudgetData | null>(null)
  const [message, setMessage] = useState('')
  const [total, setTotal] = useState('10000')
  const [category, setCategory] = useState({ name: 'Venue', allocation: '2500' })
  const [expense, setExpense] = useState({ category_id: '', description: '', amount: '', vendor_name: '' })
  const [payment, setPayment] = useState({ expense_id: '', amount: '', method: 'upi', paid_at: new Date().toISOString().slice(0, 10) })

  async function load() {
    const response = await fetch(`/api/budget?event_id=${eventId}`)
    setData(await response.json())
  }
  useEffect(() => { load() }, [eventId])

  async function post(body: Record<string, unknown>) {
    const response = await fetch('/api/budget', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const payload = await response.json()
    setMessage(response.ok ? 'Saved.' : payload.error ?? 'Could not save.')
    await load()
  }

  const currency = data?.budget?.currency ?? 'USD'
  const metrics = data?.metrics
  const bars = useMemo(() => data?.categories?.map((categoryRow) => {
    const row = metrics?.by_category?.find((item: { id: string }) => item.id === categoryRow.id)
    return { ...categoryRow, actual: row?.actual_minor ?? 0, overspent: row?.overspent }
  }) ?? [], [data, metrics])

  return (
    <div className="budget-page">
      {!data?.budget && (
        <section className="budget-empty">
          <h2>Set the financial baseline</h2>
          <p className="muted">Amounts are stored in minor units. Create a budget, then allocate categories and record expenses once.</p>
          <label>Total budget<input type="number" min="0" value={total} onChange={(e) => setTotal(e.target.value)} /></label>
          <button className="primary-button" onClick={() => post({ action: 'create_budget', event_id: eventId, total_minor: toMinor(Number(total) || 0), currency: 'USD' })}>Create budget</button>
        </section>
      )}
      {metrics && data?.budget && (
        <>
          <section className="budget-metrics">
            <article><span>Total budget</span><strong>{formatMoney(metrics.total_minor, currency)}</strong></article>
            <article><span>Actual spend</span><strong>{formatMoney(metrics.actual_minor, currency)}</strong></article>
            <article><span>Outstanding</span><strong>{formatMoney(metrics.outstanding_minor, currency)}</strong></article>
            <article className={metrics.overspent ? 'warning' : ''}><span>{metrics.overspent ? 'Over budget' : 'Remaining'}</span><strong>{formatMoney(metrics.remaining_minor, currency)}</strong></article>
          </section>
          <section className="budget-grid">
            <div className="budget-card">
              <p className="eyebrow">Utilization {metrics.utilization_percent}%</p>
              <h2>Category ledger</h2>
              {bars.map((row) => (
                <div className="budget-bar" key={row.id}>
                  <div><span>{row.name}</span><b>{formatMoney(row.actual, currency)} / {formatMoney(row.allocation_minor, currency)}</b></div>
                  <div className="bar-track"><i style={{ width: `${Math.min(100, row.allocation_minor ? (row.actual / row.allocation_minor) * 100 : 0)}%`, background: row.overspent ? 'var(--terracotta)' : undefined }} /></div>
                </div>
              ))}
              <div className="stack-form compact">
                <input placeholder="Category" value={category.name} onChange={(e) => setCategory({ ...category, name: e.target.value })} />
                <input type="number" placeholder="Allocation" value={category.allocation} onChange={(e) => setCategory({ ...category, allocation: e.target.value })} />
                <button className="secondary-button" onClick={() => post({ action: 'category', event_id: eventId, budget_id: data.budget!.id, name: category.name, allocation_minor: toMinor(Number(category.allocation) || 0) })}>Add category</button>
              </div>
            </div>
            <div className="budget-card">
              <p className="eyebrow">Reconciliation</p>
              <h2>{data.expenses.length} expenses</h2>
              <p className="muted">Planned {formatMoney(metrics.planned_minor, currency)} · committed {formatMoney(metrics.committed_minor, currency)}</p>
              <p className="muted">Paid {formatMoney(metrics.paid_minor, currency)} · unpaid {formatMoney(metrics.outstanding_minor, currency)}</p>
              <div className="chart-row" aria-hidden="true">
                {bars.map((row) => <span key={row.id} style={{ flex: Math.max(row.actual, 1) }} title={row.name} />)}
              </div>
            </div>
          </section>
          <section className="workspace-split">
            <form className="budget-card stack-form" onSubmit={(e) => { e.preventDefault(); post({ action: 'expense', event_id: eventId, budget_id: data.budget!.id, category_id: expense.category_id, description: expense.description, amount_minor: toMinor(Number(expense.amount) || 0), currency, vendor_name: expense.vendor_name, idempotency_key: crypto.randomUUID() }) }}>
              <h2>Add expense</h2>
              <select required value={expense.category_id} onChange={(e) => setExpense({ ...expense, category_id: e.target.value })}>
                <option value="">Category</option>
                {data.categories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
              <input required placeholder="Description" value={expense.description} onChange={(e) => setExpense({ ...expense, description: e.target.value })} />
              <input required type="number" min="0" placeholder="Amount" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} />
              <input placeholder="Vendor" value={expense.vendor_name} onChange={(e) => setExpense({ ...expense, vendor_name: e.target.value })} />
              <button className="primary-button">Record expense</button>
            </form>
            <form className="budget-card stack-form" onSubmit={(e) => { e.preventDefault(); post({ action: 'payment', event_id: eventId, expense_id: payment.expense_id, amount_minor: toMinor(Number(payment.amount) || 0), paid_at: payment.paid_at, method: payment.method, idempotency_key: crypto.randomUUID() }) }}>
              <h2>Record payment</h2>
              <select required value={payment.expense_id} onChange={(e) => setPayment({ ...payment, expense_id: e.target.value })}>
                <option value="">Expense</option>
                {data.expenses.map((row) => <option key={row.id} value={row.id}>{row.description} · {formatMoney(row.amount_minor, currency)}</option>)}
              </select>
              <input required type="number" min="0" placeholder="Amount" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
              <input type="date" value={payment.paid_at} onChange={(e) => setPayment({ ...payment, paid_at: e.target.value })} />
              <select value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
                {['cash', 'card', 'bank_transfer', 'upi', 'other'].map((method) => <option key={method}>{method}</option>)}
              </select>
              <button className="primary-button">Record payment</button>
            </form>
          </section>
          <section className="budget-card">
            <h2>Expense ledger</h2>
            <div className="table-list">
              {data.expenses.map((row) => (
                <div className="table-row" key={row.id}>
                  <strong>{row.description}</strong>
                  <span>{row.vendor_name || '—'}</span>
                  <b>{formatMoney(row.amount_minor, currency)}</b>
                </div>
              ))}
              {!data.expenses.length && <p className="muted">No expenses yet.</p>}
            </div>
          </section>
        </>
      )}
      {message && <p className="planner-status" role="status">{message}</p>}
    </div>
  )
}
