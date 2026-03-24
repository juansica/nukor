export const dynamic = 'force-dynamic'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getCustomerPortalUrl } from '@/lib/lemonsqueezy'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles').select('last_workspace_id').eq('id', user.id).maybeSingle()
    const workspaceId = profile?.last_workspace_id
    if (!workspaceId) return Response.json({ error: 'Workspace not found' }, { status: 404 })

    const { data: ws } = await supabaseAdmin
      .from('workspaces')
      .select('plan, ls_subscription_id, ls_customer_id, subscription_status, current_period_end')
      .eq('id', workspaceId)
      .maybeSingle()

    const plan = ws?.plan ?? 'free'
    const status = ws?.subscription_status ?? null
    const currentPeriodEnd = ws?.current_period_end ?? null

    // Fetch portal URL for Pro users
    let portalUrl: string | null = null
    if (ws?.ls_customer_id) {
      try {
        portalUrl = await getCustomerPortalUrl(ws.ls_customer_id)
      } catch {
        // Non-fatal — portal URL is best-effort
      }
    }

    return Response.json({ plan, status, currentPeriodEnd, portalUrl })
  } catch (err: any) {
    console.error('[billing/subscription]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
