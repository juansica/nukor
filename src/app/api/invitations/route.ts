export const dynamic = 'force-dynamic'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { email, role, workspace_id } = await request.json()
    if (!email || !workspace_id) {
      return new Response(JSON.stringify({ error: 'email and workspace_id are required' }), { status: 400 })
    }

    const token = crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data, error } = await supabaseAdmin
      .from('invitations')
      .insert({
        email,
        role: role || 'editor',
        workspace_id,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('[invitations] insert error:', error)
      return new Response(JSON.stringify({ error: 'Failed to create invitation' }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true, invitation: data }), { status: 201 })
  } catch {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
