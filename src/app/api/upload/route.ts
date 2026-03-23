export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { uploadDocument } from '@/lib/ragie'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    const workspaceId = formData.get('workspace_id') as string
    const areaId = formData.get('area_id') as string | null
    const collectionId = formData.get('collection_id') as string | null

    if (!file || !workspaceId) {
      return new Response(JSON.stringify({ error: 'Missing file or workspace_id' }), { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Solo se permiten archivos PDF, Word y Excel' }), { status: 400 })
    }

    if (file.size > 50 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'El archivo no puede superar 50MB' }), { status: 400 })
    }

    const buffer = new Uint8Array(await file.arrayBuffer())

    const ragieDoc = await uploadDocument(buffer, file.name, {
      workspace_id: workspaceId,
      ...(areaId ? { area_id: areaId } : {}),
      ...(collectionId ? { collection_id: collectionId } : {}),
    })

    const { data: entry, error } = await supabaseAdmin
      .from('entries')
      .insert({
        title: file.name,
        content: `Documento subido: ${file.name}`,
        workspace_id: workspaceId,
        area_id: areaId || null,
        collection_id: collectionId || null,
        created_by: user.id,
        is_published: true,
      })
      .select()
      .single()

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

    return new Response(
      JSON.stringify({ success: true, entry, ragie_document_id: ragieDoc.id }),
      { status: 201 }
    )
  } catch (err: any) {
    console.error('Upload error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}
