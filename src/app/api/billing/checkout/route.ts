export const dynamic = 'force-dynamic'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { createCheckoutUrl } from '@/lib/lemonsqueezy'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { plan } = await req.json()
    if (plan !== 'pro') {
      return Response.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('last_workspace_id, full_name')
      .eq('id', user.id)
      .maybeSingle()

    const workspaceId = profile?.last_workspace_id
    if (!workspaceId) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const variantId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID!
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const checkoutUrl = await createCheckoutUrl({
      variantId,
      userEmail: user.email!,
      workspaceId,
      successUrl: `${baseUrl}/dashboard/settings?tab=plan&upgraded=true`,
    })

    return Response.json({ checkoutUrl })
  } catch (err: any) {
    console.error('[billing/checkout]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
