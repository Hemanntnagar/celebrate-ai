'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatDate } from '@/lib/money'

type Task = { id: string; title: string; status: string; priority: string; due_date: string | null; milestone?: string }
type Assignment = { task_id: string; assignee_email: string }
type Dependency = { task_id: string; depends_on_id: string }

export default function TasksPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [tasks, setTasks] = useState<Task[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [dependencies, setDependencies] = useState<Dependency[]>([])
  const [form, setForm] = useState({ title: '', due_date: '', milestone: '', priority: 'medium' })
  const [assign, setAssign] = useState({ task_id: '', assignee_email: '' })
  const [depend, setDepend] = useState({ task_id: '', depends_on_id: '' })
  const [impact, setImpact] = useState('')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))

  async function load() {
    const response = await fetch(`/api/tasks?event_id=${eventId}`)
    const data = await response.json()
    setTasks(data.tasks ?? [])
    setAssignments(data.assignments ?? [])
    setDependencies(data.dependencies ?? [])
  }
  useEffect(() => { load() }, [eventId])

  async function post(body: Record<string, unknown>) {
    const response = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, event_id: eventId }) })
    const data = await response.json()
    if (data.impact?.affected?.length) setImpact(`${data.impact.affected.length} later tasks may slip if this deadline moves.`)
    else if (!response.ok) setImpact(data.error ?? 'Could not save.')
    else setImpact('')
    await load()
  }

  const days = useMemo(() => {
    const [year, mon] = month.split('-').map(Number)
    const first = new Date(year, mon - 1, 1)
    const blanks = Array.from({ length: first.getDay() }, () => null)
    const count = new Date(year, mon, 0).getDate()
    return [...blanks, ...Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)]
  }, [month])

  return (
    <div className="stack">
      <section className="workspace-split">
        <form className="budget-card stack-form" onSubmit={(e) => { e.preventDefault(); post({ action: 'create', ...form }) }}>
          <p className="eyebrow">New task</p>
          <h2>Keep the timeline honest</h2>
          <input required placeholder="Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input placeholder="Milestone" value={form.milestone} onChange={(e) => setForm({ ...form, milestone: e.target.value })} />
          <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {['low', 'medium', 'high'].map((value) => <option key={value}>{value}</option>)}
          </select>
          <button className="primary-button">Add task</button>
        </form>
        <div className="budget-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Calendar</p>
              <h2>{month}</h2>
            </div>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Calendar month" />
          </div>
          <div className="calendar-grid">
            {days.map((day, index) => (
              <div className="calendar-cell" key={day ?? `blank-${index}`}>
                <span>{day ? Number(day.slice(-2)) : ''}</span>
                {tasks.filter((task) => task.due_date === day).map((task) => <small key={task.id}>{task.title}</small>)}
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="budget-card">
        <h2>Assignments and dependencies</h2>
        <div className="inline-forms">
          <form onSubmit={(e) => { e.preventDefault(); post({ action: 'assign', ...assign }) }}>
            <select required value={assign.task_id} onChange={(e) => setAssign({ ...assign, task_id: e.target.value })}>
              <option value="">Task</option>
              {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
            </select>
            <input required type="email" placeholder="Assignee email" value={assign.assignee_email} onChange={(e) => setAssign({ ...assign, assignee_email: e.target.value })} />
            <button className="secondary-button">Assign</button>
          </form>
          <form onSubmit={(e) => { e.preventDefault(); post({ action: 'depend', ...depend }) }}>
            <select required value={depend.task_id} onChange={(e) => setDepend({ ...depend, task_id: e.target.value })}>
              <option value="">Task</option>
              {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
            </select>
            <select required value={depend.depends_on_id} onChange={(e) => setDepend({ ...depend, depends_on_id: e.target.value })}>
              <option value="">Depends on</option>
              {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
            </select>
            <button className="secondary-button">Link</button>
          </form>
        </div>
        {impact && <p className="planner-status" role="status">{impact}</p>}
      </section>
      <section className="table-list">
        {tasks.map((task) => (
          <article className="table-row" key={task.id}>
            <div>
              <strong>{task.title}</strong>
              <span>{task.milestone || 'Task'} · {formatDate(task.due_date)} · {assignments.filter((item) => item.task_id === task.id).map((item) => item.assignee_email).join(', ') || 'Unassigned'}</span>
            </div>
            <select value={task.status} onChange={(e) => post({ action: 'update', task_id: task.id, status: e.target.value })}>
              {['todo', 'in_progress', 'blocked', 'done'].map((value) => <option key={value}>{value}</option>)}
            </select>
            <input type="date" value={task.due_date ?? ''} onChange={(e) => post({ action: 'update', task_id: task.id, due_date: e.target.value })} />
            <button className="text-link" onClick={() => post({ action: 'delete', task_id: task.id })}>Remove</button>
          </article>
        ))}
        {!tasks.length && <p className="muted">No tasks yet. Generate a plan or add the first milestone.</p>}
      </section>
      {dependencies.length > 0 && <p className="muted">{dependencies.length} dependency links are helping later dates stay honest.</p>}
    </div>
  )
}
