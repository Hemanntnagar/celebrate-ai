'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter(); const supabase = createClient(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  async function submit(e: React.FormEvent) { e.preventDefault(); setLoading(true); setError(''); const result = mode === 'login' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback` } }); setLoading(false); if (result.error) { setError(result.error.message.includes('confirm') ? 'Check your email to confirm your account.' : 'Unable to authenticate with those details.'); return } router.push(mode === 'signup' ? '/signup/success' : '/dashboard'); router.refresh() }
  return <form onSubmit={submit} className="flex flex-col gap-4">{mode === 'signup' && <label>Full name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Alex Morgan" /></label>}<label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></label><label>Password<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button></form>
}
