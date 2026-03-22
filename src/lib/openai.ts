
/**
 * Client-side helper for the /functions/v1/chat Supabase Edge Function.
 *
 * NOTE: The OpenAI SDK runs entirely server-side inside the Edge Function.
 *       This module only handles the streaming fetch + SSE parsing — the API
 *       key is never exposed to the browser.
 */

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamUsage {
  inputTokens: number
  outputTokens: number
}

export type StreamEvent =
  | { type: 'token'; content: string }
  | { type: 'done'; usage: StreamUsage }
  | { type: 'error'; error: string }


/**
 * Async generator that streams chat tokens from the edge function.
 * Yields StreamEvent objects — callers should handle each event type.
 */
export async function* streamChat(
  workspaceId: string,
  messages: ChatMessage[]
): AsyncGenerator<StreamEvent> {
  let response: Response
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ workspaceId, messages }),
    })
  } catch (err) {
    yield { type: 'error', error: `Network error: ${String(err)}` }
    return
  }

  if (!response.ok) {
    const text = await response.text().catch(() => `HTTP ${response.status}`)
    yield { type: 'error', error: text }
    return
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // SSE messages are delimited by double newlines
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data: ')) continue
      const json = line.slice(6).trim()
      if (!json) continue

      try {
        const event = JSON.parse(json)
        if (event.type === 'token') {
          yield { type: 'token', content: event.content as string }
        } else if (event.type === 'done') {
          yield {
            type: 'done',
            usage: {
              inputTokens: event.inputTokens as number,
              outputTokens: event.outputTokens as number,
            },
          }
        } else if (event.type === 'error') {
          yield { type: 'error', error: event.error as string }
        }
      } catch {
        // Malformed SSE line — skip silently
      }
    }
  }
}
