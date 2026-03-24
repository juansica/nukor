export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { verifyWebhookSignature } from '@/lib/lemonsqueezy'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-signature') ?? ''

  if (!verifyWebhookSignature(rawBody, signature)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventName: string = event.meta?.event_name ?? ''
  const attrs = event.data?.attributes ?? {}
  const workspaceId: string | undefined = event.meta?.custom_data?.workspace_id

  if (!workspaceId) {
    console.warn('[billing/webhook] Missing workspace_id in custom_data', eventName)
    return Response.json({ received: true })
  }

  const subscriptionId = String(event.data?.id ?? '')
  const customerId = String(attrs.customer_id ?? '')
  const status: string = attrs.status ?? 'active'
  const endsAt: string | null = attrs.ends_at ?? null
  const renewsAt: string | null = attrs.renews_at ?? null

  switch (eventName) {
    case 'subscription_created':
    case 'subscription_updated':
    case 'subscription_resumed': {
      const plan = status === 'active' || status === 'on_trial' ? 'pro' : 'free'
      await supabaseAdmin
        .from('workspaces')
        .update({
          plan,
          ls_subscription_id: subscriptionId,
          ls_customer_id: customerId,
          subscription_status: status,
          current_period_end: endsAt ?? renewsAt,
        })
        .eq('id', workspaceId)
      break
    }

    case 'subscription_cancelled':
    case 'subscription_expired':
    case 'subscription_paused': {
      await supabaseAdmin
        .from('workspaces')
        .update({
          plan: 'free',
          subscription_status: status,
          current_period_end: endsAt,
        })
        .eq('id', workspaceId)
      break
    }

    default:
      // Unhandled event — ignore
      break
  }

  return Response.json({ received: true })
}
