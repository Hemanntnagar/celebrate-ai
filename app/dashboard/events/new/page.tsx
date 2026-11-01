import { DashboardShell } from '@/components/dashboard-shell'
import { EventWizard } from '@/components/event-wizard'
import { createClient } from '@/lib/supabase/server'
export default async function NewEventPage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();return <DashboardShell name={user?.user_metadata?.full_name}><div className="page-content"><EventWizard/></div></DashboardShell>}
