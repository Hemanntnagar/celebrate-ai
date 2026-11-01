import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { LAST_EVENT_COOKIE } from '@/lib/workspace'

export default async function BudgetRedirect() {
  const last = (await cookies()).get(LAST_EVENT_COOKIE)?.value
  redirect(last ? `/dashboard/events/${last}/budget` : '/dashboard/events')
}
