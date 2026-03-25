import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { canUseFeature, withinPhoneMemberLimit } from '@/lib/plans'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET — list phone members for a workspace
export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    if (!workspaceId) return Response.json({ error: 'Missing workspace_id' }, { status: 400 })

    // Verify membership
    const { data: member } = await supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!member) return Response.json({ error: 'Forbidden' }, { status: 403 })

    const { data: members } = await supabaseAdmin
      .from('phone_members')
      .select('id, phone_number, name, activated, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    return Response.json({ members: members ?? [] })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — add a new phone member and send activation code
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspace_id, phone_number, name } = await request.json()
    if (!workspace_id || !phone_number || !name) {
      return Response.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Normalize to E.164 (strip spaces/dashes, ensure starts with +)
    const normalized = phone_number.replace(/[\s\-\(\)]/g, '')
    if (!/^\+\d{7,15}$/.test(normalized)) {
      return Response.json({ error: 'Formato de número inválido. Usa formato internacional: +5491112345678' }, { status: 400 })
    }

    // Verify caller is admin
    const { data: membership } = await supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership || membership.role !== 'admin') {
      return Response.json({ error: 'Solo los admins pueden agregar miembros de WhatsApp' }, { status: 403 })
    }

    // Check plan allows WhatsApp
    const { data: ws } = await supabaseAdmin
      .from('workspaces')
      .select('plan')
      .eq('id', workspace_id)
      .maybeSingle()
    if (!canUseFeature(ws?.plan, 'whatsappEnabled')) {
      return Response.json({ error: 'Tu plan no incluye Nukor for WhatsApp. Actualiza a Pro o Enterprise.' }, { status: 403 })
    }

    // Check phone member limit
    const { count } = await supabaseAdmin
      .from('phone_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id)
    if (!withinPhoneMemberLimit(ws?.plan, count ?? 0)) {
      return Response.json({ error: 'Has alcanzado el límite de miembros de WhatsApp de tu plan.' }, { status: 403 })
    }

    // Check if number already registered
    const { data: existing } = await supabaseAdmin
      .from('phone_members')
      .select('id, workspace_id')
      .eq('phone_number', normalized)
      .maybeSingle()
    if (existing) {
      return Response.json({ error: 'Este número ya está registrado en un workspace' }, { status: 409 })
    }

    // Generate 6-digit activation code
    const activationCode = String(Math.floor(100000 + Math.random() * 900000))

    const { data: newMember, error } = await supabaseAdmin
      .from('phone_members')
      .insert({
        workspace_id,
        phone_number: normalized,
        name,
        activation_code: activationCode,
        activated: false,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Fetch workspace name
    const { data: ws } = await supabaseAdmin
      .from('workspaces')
      .select('name')
      .eq('id', workspace_id)
      .maybeSingle()
    const wsName = ws?.name ?? 'tu empresa'

    // Send activation WhatsApp message
    await sendWhatsAppMessage(
      normalized,
      `¡Hola ${name}! 👋 Has sido invitado a acceder al asistente de conocimiento de *${wsName}* a través de WhatsApp.\n\nPara activar tu acceso, responde con el código:\n\n*${activationCode}*\n\nUna vez activado podrás hacer consultas directamente desde este chat.`
    )

    return Response.json({ member: newMember }, { status: 201 })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE — remove a phone member
export async function DELETE(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, workspace_id } = await request.json()
    if (!id || !workspace_id) return Response.json({ error: 'Missing fields' }, { status: 400 })

    const { data: membership } = await supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership || membership.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    await supabaseAdmin.from('phone_members').delete().eq('id', id).eq('workspace_id', workspace_id)
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID
  const token = process.env.META_WHATSAPP_TOKEN
  if (!phoneNumberId || !token) return

  // WhatsApp has a 4096 char limit — truncate if needed
  const body = text.length > 4096 ? text.slice(0, 4090) + '…' : text

  await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  })
}
