// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Paddle, Environment } = require('@paddle/paddle-node-sdk')
import crypto from 'crypto'

export const paddle = new Paddle(process.env.PADDLE_API_KEY!, {
  environment:
    process.env.PADDLE_ENVIRONMENT === 'production'
      ? Environment.production
      : Environment.sandbox,
})

export async function createCheckoutUrl(opts: {
  priceId: string
  userEmail: string
  workspaceId: string
  successUrl: string
}): Promise<string> {
  const transaction = await paddle.transactions.create({
    items: [{ priceId: opts.priceId, quantity: 1 }],
    customData: { workspace_id: opts.workspaceId } as any,
    checkout: { url: opts.successUrl },
  } as any)

  const url = (transaction as any).checkout?.url
  if (!url) throw new Error('Paddle did not return a checkout URL')
  return url as string
}

export async function getCustomerPortalUrl(
  customerId: string,
  subscriptionId?: string
): Promise<string> {
  const session = await paddle.customerPortalSessions.create(customerId, {
    subscriptionIds: subscriptionId ? [subscriptionId] : [],
  })
  return (session as any).urls?.general?.overview as string
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string
): boolean {
  const secret = process.env.PADDLE_WEBHOOK_SECRET!
  const parts = Object.fromEntries(
    signatureHeader.split(';').map((p) => {
      const idx = p.indexOf('=')
      return [p.slice(0, idx), p.slice(idx + 1)]
    })
  )
  const ts = parts['ts']
  const h1 = parts['h1']
  if (!ts || !h1) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${ts}:${rawBody}`)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(h1))
  } catch {
    return false
  }
}
