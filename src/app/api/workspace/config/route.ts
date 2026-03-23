export const dynamic = 'force-dynamic'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { workspace_id, ai_config } = await request.json()
    if (!workspace_id || !ai_config) {
      return new Response(JSON.stringify({ error: 'workspace_id and ai_config are required' }), { status: 400 })
    }

    // Merge with existing ai_config to preserve keys not being updated
    const { data: existing } = await supabaseAdmin
      .from('workspaces')
      .select('ai_config')
      .eq('id', workspace_id)
      .single()

    const merged = { ...(existing?.ai_config || {}), ...ai_config }

    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .update({ ai_config: merged })
      .eq('id', workspace_id)
      .select('ai_config')
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to update config' }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true, ai_config: data.ai_config }), { status: 200 })
  } catch {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
