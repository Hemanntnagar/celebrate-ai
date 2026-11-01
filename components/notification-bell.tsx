'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'

type Note = { id: string; title: string; body: string; read_at: string | null }

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])

  async function load() {
    const response = await fetch('/api/notifications')
    if (!response.ok) return
    const data = await response.json()
    setNotes(data.notifications ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  const unread = notes.filter((note) => !note.read_at).length

  async function markAll() {
    await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) })
    load()
  }

  return (
    <div className="notice-wrap">
      <button className="notice-button" aria-label={`Notifications, ${unread} unread`} onClick={() => setOpen((value) => !value)}>
        <Bell />
        {unread > 0 && <span className="notice-count">{unread}</span>}
      </button>
      {open && (
        <div className="notice-panel" role="dialog" aria-label="Notifications">
          <div className="card-heading">
            <strong>Notifications</strong>
            <button className="text-link" onClick={markAll}>Mark all read</button>
          </div>
          {notes.length ? notes.map((note) => (
            <article key={note.id} className={note.read_at ? 'notice-item' : 'notice-item unread'}>
              <strong>{note.title}</strong>
              <p>{note.body}</p>
            </article>
          )) : <p className="muted">No notifications yet.</p>}
        </div>
      )}
    </div>
  )
}
