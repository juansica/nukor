import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data: areas, error } = await supabaseAdmin
      .from('areas')
      .select('*')
      .eq('workspace_id', '00000000-0000-0000-0000-000000000001')
      .order('created_at', { ascending: false })

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    return new Response(JSON.stringify({ areas }), { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { name, description, color } = await request.json()
    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), { status: 400 })
    }

    const { data: area, error } = await supabaseAdmin
      .from('areas')
      .insert({
        name,
        description: description ?? null,
        color: color ?? '#4F46E5',
        workspace_id: '00000000-0000-0000-0000-000000000001',
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    return new Response(JSON.stringify({ area }), { status: 201 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}
