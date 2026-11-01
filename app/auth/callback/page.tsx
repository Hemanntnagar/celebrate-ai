'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type Status = 'loading' | 'success' | 'error'

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('Confirming your email…')

  useEffect(() => {
    let cancelled = false

    async function confirmEmail() {
      try {
        const url = new URL(window.location.href)
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
        const errorDescription =
          url.searchParams.get('error_description') ??
          url.searchParams.get('error') ??
          hashParams.get('error_description') ??
          hashParams.get('error')

        if (errorDescription) {
          if (!cancelled) {
            setStatus('error')
            setMessage(errorDescription.replace(/\+/g, ' '))
          }
          return
        }

        const supabase = createClient()
        const code = url.searchParams.get('code')
        const tokenHash = url.searchParams.get('token_hash') ?? hashParams.get('token_hash')
        const type = (url.searchParams.get('type') ?? hashParams.get('type')) as EmailOtpType | null

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
          if (error) throw error
        } else {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          if (!session) {
            throw new Error('This confirmation link is invalid or has expired.')
          }
        }

        if (!cancelled) {
          setStatus('success')
          setMessage('Your email is confirmed. Your celebration workspace is ready.')
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error')
          setMessage(error instanceof Error ? error.message : 'Unable to confirm your email.')
        }
      }
    }

    void confirmEmail()
    return () => {
      cancelled = true
    }
  }, [])

  const isError = status === 'error'
  const href = status === 'success' ? '/dashboard' : '/login'

  return (
    <main className="center-page">
      <div className="success-card">
        <div className={`success-icon${isError ? ' error' : ''}`}>
          {status === 'loading' ? '…' : isError ? '!' : '✓'}
        </div>
        <p className="eyebrow">
          {status === 'loading' ? 'Just a moment' : isError ? 'Needs another try' : 'You’re in'}
        </p>
        <h1>{status === 'success' ? 'Email confirmed' : isError ? 'Couldn’t confirm' : 'Confirming email'}</h1>
        <p className="muted">{message}</p>
        {status !== 'loading' && (
          <Link className="primary-button inline-button" href={href}>
            {status === 'success' ? 'Continue to Celebrate' : 'Return to sign in'}
          </Link>
        )}
      </div>
    </main>
  )
}
