export const dynamic = 'force-dynamic'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 50) || 'workspace'
  )
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { full_name, workspace_name } = await req.json()
    if (!full_name?.trim() || !workspace_name?.trim()) {
      return new Response(JSON.stringify({ error: 'full_name and workspace_name are required' }), { status: 400 })
    }

    // Generate a unique slug
    const baseSlug = slugify(workspace_name.trim())
    let slug = baseSlug
    for (let i = 1; i <= 10; i++) {
      const { data: existing } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (!existing) break
      slug = `${baseSlug}-${i}`
    }

    // Create workspace
    const { data: workspace, error: wsError } = await supabaseAdmin
      .from('workspaces')
      .insert({ name: workspace_name.trim(), slug, created_by: user.id })
      .select()
      .single()

    if (wsError) return new Response(JSON.stringify({ error: wsError.message }), { status: 500 })

    // Add creator as admin member
    const { error: memberError } = await supabaseAdmin
      .from('workspace_members')
      .insert({ workspace_id: workspace.id, user_id: user.id, role: 'admin' })

    if (memberError) return new Response(JSON.stringify({ error: memberError.message }), { status: 500 })

    // Upsert profile with name and workspace
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        full_name: full_name.trim(),
        last_workspace_id: workspace.id,
      })

    if (profileError) return new Response(JSON.stringify({ error: profileError.message }), { status: 500 })

    return new Response(JSON.stringify({ workspace }), { status: 200 })
  } catch (err: any) {
    console.error('Onboarding error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}
