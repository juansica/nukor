import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { ragie } from '@/lib/ragie'
import { ConnectorSource } from 'ragie/models/components'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_PROVIDERS: string[] = [
  'google_drive', 'notion', 'confluence', 'onedrive',
  'salesforce', 'slack', 'gmail', 'jira',
  'dropbox', 'sharepoint', 'hubspot', 'zendesk',
]

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { provider } = await request.json()

    if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
      return Response.json({ error: 'Invalid provider' }, { status: 400 })
    }

    // Derive workspaceId from server — never trust client-supplied value
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('last_workspace_id')
      .eq('id', user.id)
      .maybeSingle()

    const workspaceId = profile?.last_workspace_id
    if (!workspaceId) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const response = await ragie.connections.createOAuthRedirectUrl({
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?tab=integrations&connected=true`,
      partition: `workspace-${workspaceId}`,
      sourceType: provider as ConnectorSource,
    })

    return Response.json({ authUrl: response.url })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
