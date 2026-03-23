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

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, last_workspace_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.last_workspace_id) redirect('/onboarding')

  // system_role column may not exist yet — fetch separately and ignore errors
  let systemRole: string | null = null
  const { data: roleData, error: roleError } = await supabaseAdmin
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .maybeSingle()
  if (!roleError) systemRole = roleData?.system_role ?? null

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
      systemRole={systemRole}
    />
  )
}
