import { Ragie } from 'ragie'

export const ragie = new Ragie({ auth: process.env.RAGIE_API_KEY! })

export async function uploadDocument(
  file: Uint8Array,
  filename: string,
  metadata: {
    workspace_id: string
    area_id?: string
    collection_id?: string
  }
) {
  const blob = new Blob([file])
  const document = await ragie.documents.create({
    file: { content: blob, fileName: filename },
    metadata,
    mode: 'fast',
  })
  return document
}

export async function searchRagie(query: string, workspaceId: string, topK = 5) {
  try {
    const results = await ragie.retrievals.retrieve({
      query,
      topK,
      filter: { scope: 'partition', partition: workspaceId },
    })
    return results.scoredChunks ?? []
  } catch {
    return []
  }
}
