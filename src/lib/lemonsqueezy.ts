const LS_API = 'https://api.lemonsqueezy.com/v1'

function headers() {
  return {
    'Accept': 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
    'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY!}`,
  }
}

export async function createCheckoutUrl(opts: {
  variantId: string
  userEmail: string
  workspaceId: string
  successUrl: string
}): Promise<string> {
  const res = await fetch(`${LS_API}/checkouts`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: opts.userEmail,
            custom: { workspace_id: opts.workspaceId },
          },
          product_options: {
            redirect_url: opts.successUrl,
          },
        },
        relationships: {
          store: {
            data: { type: 'stores', id: process.env.LEMONSQUEEZY_STORE_ID! },
          },
          variant: {
            data: { type: 'variants', id: opts.variantId },
          },
        },
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LemonSqueezy checkout error: ${err}`)
  }

  const json = await res.json()
  return json.data.attributes.url as string
}

export async function getCustomerPortalUrl(customerId: string): Promise<string> {
  const res = await fetch(`${LS_API}/customers/${customerId}`, {
    headers: headers(),
  })
  if (!res.ok) throw new Error('Failed to fetch customer')
  const json = await res.json()
  return json.data.attributes.urls?.customer_portal as string
}

export async function getSubscription(subscriptionId: string) {
  const res = await fetch(`${LS_API}/subscriptions/${subscriptionId}`, {
    headers: headers(),
  })
  if (!res.ok) throw new Error('Failed to fetch subscription')
  const json = await res.json()
  return json.data.attributes
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const crypto = require('crypto')
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!
  const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}
