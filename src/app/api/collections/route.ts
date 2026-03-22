import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const areaId = searchParams.get('areaId')

    let query = supabaseAdmin
      .from('collections')
      .select('*, entries(id)')
      .eq('workspace_id', DEFAULT_WORKSPACE_ID)

    if (areaId) {
      query = query.eq('area_id', areaId)
    }

    const { data: collections, error } = await query.order('name')

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    return new Response(JSON.stringify({ collections }), { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { name, description, area_id } = await req.json()
    if (!name || !area_id) {
      return new Response(JSON.stringify({ error: 'Name and areaId are required' }), { status: 400 })
    }

    const { data: collection, error } = await supabaseAdmin
      .from('collections')
      .insert({
        name,
        description: description ?? null,
        area_id,
        created_by: user.id,
        workspace_id: DEFAULT_WORKSPACE_ID
      })
      .select()
      .single()

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    return new Response(JSON.stringify({ collection }), { status: 201 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}
