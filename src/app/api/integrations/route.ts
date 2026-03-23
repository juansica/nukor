import { ragie } from '@/lib/ragie'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspace_id')

  const iterator = await ragie.connections.list({
    partition: `workspace-${workspaceId}`,
  })

  const connections = []
  for await (const page of iterator) {
    connections.push(...page.result.connections)
  }

  return Response.json({ connections })
}

export async function DELETE(request: Request) {
  const { connectionId } = await request.json()

  await ragie.connections.delete({
    connectionId,
    deleteConnectionPayload: { keepFiles: false },
  })

  return Response.json({ success: true })
}
