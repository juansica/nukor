import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { ragie } from '@/lib/ragie'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { connectionId } = await request.json()
    if (!connectionId) {
      return Response.json({ error: 'Missing connectionId' }, { status: 400 })
    }

    // Verify this connection belongs to the user's workspace
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('last_workspace_id')
      .eq('id', user.id)
      .maybeSingle()

    const workspaceId = profile?.last_workspace_id
    if (!workspaceId) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 })
    }

    let conn
    try {
      conn = await ragie.connections.get({ connectionId })
    } catch {
      return Response.json({ error: 'Connection not found' }, { status: 404 })
    }
    if (conn.partition !== `workspace-${workspaceId}`) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    await ragie.connections.sync({ connectionId })

    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
