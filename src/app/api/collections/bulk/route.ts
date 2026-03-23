export const dynamic = 'force-dynamic'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

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

    const { action, ids } = await req.json() as { action: 'enable' | 'disable' | 'delete'; ids: string[] }
    if (!action || !Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: 'action and ids are required' }, { status: 400 })
    }

    // Verify all collections belong to the user's workspace
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('last_workspace_id')
      .eq('id', user.id)
      .maybeSingle()

    const workspaceId = profile?.last_workspace_id
    if (!workspaceId) return Response.json({ error: 'Workspace not found' }, { status: 404 })

    const { data: owned, error: ownerErr } = await supabaseAdmin
      .from('collections')
      .select('id')
      .in('id', ids)
      .eq('workspace_id', workspaceId)

    if (ownerErr || !owned || owned.length !== ids.length) {
      return Response.json({ error: 'One or more collections not found' }, { status: 404 })
    }

    if (action === 'delete') {
      // Delete entries first, then collections
      await supabaseAdmin.from('entries').delete().in('collection_id', ids)
      const { error } = await supabaseAdmin.from('collections').delete().in('id', ids)
      if (error) return Response.json({ error: 'Failed to delete' }, { status: 500 })
      return Response.json({ success: true, deleted: ids.length })
    }

    if (action === 'enable' || action === 'disable') {
      const { error } = await supabaseAdmin
        .from('collections')
        .update({ enabled: action === 'enable' })
        .in('id', ids)
      if (error) {
        // Column may not exist yet
        console.error('[collections/bulk] update error:', error)
        return Response.json({ error: 'enabled column may not exist. Run: ALTER TABLE collections ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;' }, { status: 500 })
      }
      return Response.json({ success: true, updated: ids.length })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[collections/bulk]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
