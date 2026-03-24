export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { verifyWebhookSignature } from '@/lib/paddle'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('paddle-signature') ?? ''

  if (!verifyWebhookSignature(rawBody, signature)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType: string = event.event_type ?? ''
  const data = event.data ?? {}
  const workspaceId: string | undefined = data.custom_data?.workspace_id

  if (!workspaceId) {
    console.warn('[billing/webhook] Missing workspace_id in custom_data', eventType)
    return Response.json({ received: true })
  }

  const subscriptionId: string = data.id ?? ''
  const customerId: string = data.customer_id ?? ''
  const status: string = data.status ?? 'active'
  const periodEnd: string | null = data.current_billing_period?.ends_at ?? data.next_billed_at ?? null

  switch (eventType) {
    case 'subscription.created':
    case 'subscription.updated':
    case 'subscription.resumed': {
      const plan = status === 'active' || status === 'trialing' ? 'pro' : 'free'
      await supabaseAdmin
        .from('workspaces')
        .update({
          plan,
          paddle_subscription_id: subscriptionId,
          paddle_customer_id: customerId,
          subscription_status: status,
          current_period_end: periodEnd,
        })
        .eq('id', workspaceId)
      break
    }

    case 'subscription.canceled':
    case 'subscription.paused': {
      await supabaseAdmin
        .from('workspaces')
        .update({
          plan: 'free',
          subscription_status: status,
          current_period_end: periodEnd,
        })
        .eq('id', workspaceId)
      break
    }

    default:
      break
  }

  return Response.json({ received: true })
}
