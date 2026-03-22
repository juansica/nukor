import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  const { data: areas, error } = await supabaseAdmin
    .from('areas')
    .select('*, collections(id), entries(id)')
    .eq('workspace_id', DEFAULT_WORKSPACE_ID)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(areas)
}

export async function POST(req: Request) {
  try {
    const { name, description, color, created_by } = await req.json()
    const { data: area, error } = await supabaseAdmin
      .from('areas')
      .insert({
        name,
        description,
        color,
        created_by,
        workspace_id: DEFAULT_WORKSPACE_ID
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(area)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
