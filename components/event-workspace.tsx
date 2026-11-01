'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LAST_EVENT_COOKIE, workspaceLinks } from '@/lib/workspace'

export function EventWorkspace({
  eventId,
  name,
  role,
  children,
}: {
  eventId: string
  name: string
  role?: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const base = `/dashboard/events/${eventId}`
  useEffect(() => {
    window.localStorage.setItem(LAST_EVENT_COOKIE, eventId)
    document.cookie = `${LAST_EVENT_COOKIE}=${eventId}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`
  }, [eventId])
  return (
    <div className="page-content workspace">
      <div className="workspace-head">
        <div>
          <p className="eyebrow">Event workspace</p>
          <h1>{name}</h1>
        </div>
        {role && <span className="status-badge">{role}</span>}
      </div>
      <nav className="workspace-nav" aria-label="Event sections">
        {workspaceLinks.map((item) => {
          const href = `${base}${item.href}`
          const active = item.href === '' ? pathname === base : pathname.startsWith(href)
          return (
            <Link key={href} href={href} className={active ? 'workspace-link active' : 'workspace-link'}>
              {item.label}
            </Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}
