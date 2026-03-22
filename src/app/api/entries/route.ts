export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { title, content, workspace_id, area_id, collection_id } = await request.json()

    if (!title || !content) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: entry, error: insertError } = await supabaseAdmin
      .from('entries')
      .insert({
        title,
        content,
        workspace_id: workspace_id || '00000000-0000-0000-0000-000000000001',
        area_id: area_id ?? null,
        collection_id: collection_id ?? null,
        created_by: user.id,
        is_published: true,
      })
      .select()
      .single()

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500 })
    }

    // Generate and save embedding (non-fatal if it fails)
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: `${title}\n\n${content}`,
      })

      const embedding = embeddingResponse.data[0].embedding

      const { error: embeddingError } = await supabaseAdmin
        .from('entries')
        .update({ embedding: JSON.stringify(embedding) })
        .eq('id', entry.id)

      if (embeddingError) {
        console.error('Failed to save embedding:', embeddingError)
      } else {
        console.log('Embedding generated successfully for entry:', entry.id)
      }
    } catch (embeddingError) {
      console.error('Embedding generation failed:', embeddingError)
    }

    return new Response(JSON.stringify({ entry }), { status: 201 })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}
