
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
  | { type: 'step'; content: string }
  | { type: 'log'; log: any }
  | { type: 'done'; usage: StreamUsage }
  | { type: 'error'; error: string }
  | { type: 'conversation'; id: string }


/**
 * Async generator that streams chat tokens from the edge function.
 * Yields StreamEvent objects — callers should handle each event type.
 */
export async function* streamChat(
  _workspaceId: string,
  messages: ChatMessage[],
  conversationId?: string | null
): AsyncGenerator<StreamEvent> {
  const workspaceId = '00000000-0000-0000-0000-000000000001'
  console.log('Sending to /api/chat:', { messages, workspaceId })

  let response: Response
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ workspaceId, messages, conversationId }),
    })
  } catch (err) {
    console.error('Fetch error:', err)
    yield { type: 'error', error: `Network error: ${String(err)}` }
    return
  }

  if (!response.ok) {
    const text = await response.text().catch(() => `HTTP ${response.status}`)
    console.error('Chat error:', response.status, text)
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
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine.startsWith('data: ')) continue
      const data = trimmedLine.slice(6).trim()
      
      if (data === '[DONE]') break

      try {
        const parsed = JSON.parse(data)
        if (parsed.log) {
          yield { type: 'log', log: parsed.log }
        } else if (parsed.step) {
          yield { type: 'step', content: parsed.step }
        } else if (parsed.text) {
          yield { type: 'token', content: parsed.text }
        } else if (parsed.type === 'token') {
          // Compatibility with existing route response format
          yield { type: 'token', content: parsed.content }
        } else if (parsed.conversationId) {
          yield { type: 'conversation', id: parsed.conversationId }
        } else if (parsed.type === 'error') {
          yield { type: 'error', error: parsed.error }
        }
      } catch (e) {
        // Skip malformed JSON
      }
    }
  }
}
