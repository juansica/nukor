import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import OverviewClient from '@/components/dashboard/OverviewClient'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function OverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  let profile: { full_name: string | null; last_workspace_id: string | null; system_role: string | null } | null = null

  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('full_name, last_workspace_id, system_role')
      .eq('id', user.id)
      .maybeSingle()
    profile = data
  } catch {
    // system_role column may not exist yet — treat as no access
  }

  if (!profile?.last_workspace_id) redirect('/onboarding')

  const userName =
    profile.full_name ||
    (user.user_metadata?.full_name as string) ||
    user.email?.split('@')[0] ||
    'Usuario'

  let workspaceName = 'Mi workspace'
  try {
    const { data: ws } = await supabaseAdmin
      .from('workspaces')
      .select('name')
      .eq('id', profile.last_workspace_id)
      .maybeSingle()
    if (ws?.name) workspaceName = ws.name
  } catch {}

  return (
    <OverviewClient
      userName={userName}
      userEmail={user.email ?? ''}
      workspaceName={workspaceName}
      workspaceId={profile.last_workspace_id}
      systemRole={profile.system_role ?? null}
    />
  )
}
