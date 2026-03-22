import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'

export async function GET(req: Request) {
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(collections)
}

export async function POST(req: Request) {
  try {
    const { name, description, area_id, created_by } = await req.json()
    const { data: collection, error } = await supabaseAdmin
      .from('collections')
      .insert({
        name,
        description,
        area_id,
        created_by,
        workspace_id: DEFAULT_WORKSPACE_ID
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(collection)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
