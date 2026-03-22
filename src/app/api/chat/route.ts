export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    // Get user but don't block if not found
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id || 'anonymous'

    const { messages, workspaceId } = await request.json()
    const effectiveWorkspaceId = workspaceId || '00000000-0000-0000-0000-000000000001'

    if (!messages) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    // Generate embedding for the user's latest message
    const userMessage = messages[messages.length - 1].content

    const queryEmbedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: userMessage,
    })

    const embedding = queryEmbedding.data[0].embedding

    // Search for similar entries using pgvector
    const { data: similarEntries } = await supabase.rpc('match_entries', {
      query_embedding: embedding,
      workspace_id: effectiveWorkspaceId,
      match_threshold: 0.5,
      match_count: 5,
    })

    let systemPrompt = `Eres Nukor, el asistente de conocimiento interno de esta empresa. Respondes siempre en español latinoamericano.

Tu trabajo es detectar la intención del usuario en cada mensaje:

1. **PREGUNTA**: El usuario quiere saber algo. Busca en el contexto proporcionado y responde. Si no tienes información, dilo claramente y sugiere agregarla.

2. **CONOCIMIENTO NUEVO**: El usuario está compartiendo información, procesos, políticas o datos de la empresa. En este caso:
   - Confirma que entendiste la información
   - Estructura la información claramente
   - AL FINAL de tu respuesta, agrega exactamente esta línea en JSON: {"intent":"save","title":"[título corto descriptivo]","content":"[contenido estructurado completo]"}

3. **CONVERSACIÓN**: El usuario saluda, agradece o hace comentarios generales. Responde de forma natural y breve.

Si no estás seguro de la intención, pregunta: "¿Quieres que guarde esta información en la base de conocimiento?"

IMPORTANTE: Solo incluye el JSON de guardado cuando estés seguro de que el usuario está aportando conocimiento nuevo. Nunca lo incluyas en respuestas a preguntas o conversaciones generales.`

    if (similarEntries && similarEntries.length > 0) {
      systemPrompt += `\n\nContexto de conocimiento de la empresa:\n`
      similarEntries.forEach((entry: any) => {
        systemPrompt += `---\n${entry.title}\n${entry.content}\n`
      })
      systemPrompt += `\n\nFuentes utilizadas: ${similarEntries.map((e: any) => e.title).join(', ')}`
    }

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      stream: true,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        // Initial reflection
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: 'Analizando tu mensaje...' })}\n\n`))
        await new Promise(r => setTimeout(r, 400))
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: 'Buscando en la base de conocimiento...' })}\n\n`))

        // Re-calculate or just use the similarEntries from above
        if (similarEntries && similarEntries.length > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: `Encontré ${similarEntries.length} entradas relevantes` })}\n\n`))
        } else {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: 'No encontré contexto relevante' })}\n\n`))
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: 'Generando respuesta...' })}\n\n`))

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || ''
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}
