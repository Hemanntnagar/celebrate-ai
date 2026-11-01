'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, LayoutDashboard, LogOut, Plus, Settings, Building2 } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { NotificationBell } from '@/components/notification-bell'

const items = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/events', label: 'My events', icon: CalendarDays },
  { href: '/dashboard/vendors', label: 'Vendors', icon: Building2 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export function DashboardShell({ children, name }: { children: React.ReactNode; name?: string }) {
  const pathname = usePathname()
  const kicker = pathname.includes('/events/new')
    ? 'New event'
    : pathname.includes('/events/')
      ? 'Event workspace'
      : pathname.includes('/events')
        ? 'Your events'
        : 'Good things ahead'

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <BrandLogo href="/dashboard" variant="sidebar" />
        <nav aria-label="Primary">
          {items.map(({ href, label, icon: Icon }) => (
            <Link className={pathname === href || (href !== '/dashboard' && pathname.startsWith(href)) ? 'nav-link active' : 'nav-link'} href={href} key={href}>
              <Icon />{label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/dashboard/events/new" className="new-event-link"><Plus />New event</Link>
          <form action="/api/auth/signout" method="post">
            <button className="nav-link"><LogOut />Sign out</button>
          </form>
        </div>
      </aside>
      <main className="app-main" id="main-content">
        <header className="topbar">
          <div>
            <BrandLogo href="/dashboard" variant="mobile" />
            <p className="topbar-kicker">{kicker}</p>
          </div>
          <div className="user-pill">
            <NotificationBell />
            <span className="avatar">{(name?.[0] ?? 'A').toUpperCase()}</span>
            <span>{name || 'Your workspace'}</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}
