import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Celebrate AI · Plan what matters',
  description: 'A calmer, more thoughtful way to plan your next celebration.',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f8f6f1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
