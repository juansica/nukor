export const dynamic = 'force-dynamic'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { ragie } from '@/lib/ragie'

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
      .from('profiles')
      .select('last_workspace_id')
      .eq('id', user.id)
      .maybeSingle()

    const workspaceId = profile?.last_workspace_id
    if (!workspaceId) {
      return Response.json({ documents: [] })
    }

    const iterator = ragie.documents.list({
      partition: `workspace-${workspaceId}`,
    })

    const documents: any[] = []
    for await (const page of iterator) {
      documents.push(...(page.result?.documents ?? []))
      if (documents.length >= 50) break // cap at 50
    }

    return Response.json({ documents })
  } catch (err) {
    console.error('[documents] list error:', err)
    return Response.json({ documents: [] })
  }
}
