import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import DashboardClient from '@/components/dashboard/DashboardClient'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, last_workspace_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.last_workspace_id) {
    redirect('/onboarding')
  }

  const userName =
    profile.full_name ||
    (user.user_metadata?.full_name as string) ||
    user.email?.split('@')[0] ||
    'Usuario'

  const userEmail = user.email ?? ''

  return (
    <DashboardClient
      userId={user.id}
      userName={userName}
      userEmail={userEmail}
    />
  )
}
