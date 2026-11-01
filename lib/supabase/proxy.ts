import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv } from '@/lib/supabase/env'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const env = getSupabaseEnv()
  if (!env) return response

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  if (!user && pathname.startsWith('/dashboard')) return NextResponse.redirect(new URL('/login', request.url))
  if (user && (pathname === '/login' || pathname === '/signup')) return NextResponse.redirect(new URL('/dashboard', request.url))
  return response
}
