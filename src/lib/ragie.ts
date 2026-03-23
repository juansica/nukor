import { Ragie } from 'ragie'

export const ragie = new Ragie({ auth: process.env.RAGIE_API_KEY! })

export async function uploadDocument(
  blob: Blob,
  filename: string,
  metadata: {
    workspace_id: string
    area_id?: string
    collection_id?: string
  }
) {
  const document = await ragie.documents.create({
    file: { content: blob, fileName: filename },
    metadata,
    mode: 'fast',
    partition: `workspace-${metadata.workspace_id}`,
  })
  return document
}

export async function searchRagie(query: string, workspaceId: string, topK = 5) {
  try {
    const results = await ragie.retrievals.retrieve({
      query,
      topK,
      partition: `workspace-${workspaceId}`,
    })
    return results.scoredChunks ?? []
  } catch {
    return []
  }
}
