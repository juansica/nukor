import { ragie } from '@/lib/ragie'
import { ConnectorSource } from 'ragie/models/components'

export async function POST(request: Request) {
  const { provider, workspaceId } = await request.json()

  const response = await ragie.connections.createOAuthRedirectUrl({
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?connected=true`,
    partition: `workspace-${workspaceId}`,
    sourceType: provider as ConnectorSource,
  })

  return Response.json({ authUrl: response.url })
}
