import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET — fetch all conversations for the current user
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const { data: conversations } = await supabaseAdmin
    .from('conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  return new Response(JSON.stringify({ conversations }), { status: 200 })
}

// DELETE — delete a conversation and its messages
export async function DELETE(request: Request) {
  const { id } = await request.json()
  await supabaseAdmin.from('messages').delete().eq('conversation_id', id)
  await supabaseAdmin.from('conversations').delete().eq('id', id)
  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
