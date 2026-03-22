export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_areas',
      description: 'Get all areas in the workspace that the user has access to',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_collections',
      description: 'Get all collections inside a specific area',
      parameters: {
        type: 'object',
        properties: {
          area_id: { type: 'string', description: 'The ID of the area' }
        },
        required: ['area_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_entries',
      description: 'Get all entries inside a specific collection',
      parameters: {
        type: 'object',
        properties: {
          collection_id: { type: 'string', description: 'The ID of the collection' }
        },
        required: ['collection_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_entry',
      description: 'Save a new knowledge entry. Use this whenever the user shares important information about the company.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short descriptive title in Spanish' },
          content: { type: 'string', description: 'Full structured content in Spanish' },
          area_id: { type: 'string', description: 'Optional area ID to save to. Use get_areas first to find the right area.' },
          collection_id: { type: 'string', description: 'Optional collection ID within the area' }
        },
        required: ['title', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_entry',
      description: 'Update an existing knowledge entry when the user corrects or adds information',
      parameters: {
        type: 'object',
        properties: {
          entry_id: { type: 'string', description: 'The ID of the entry to update' },
          content: { type: 'string', description: 'The new updated content' }
        },
        required: ['entry_id', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_collection',
      description: 'Create a new collection inside an area when no suitable collection exists. Use this proactively — do not ask the user for permission.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Collection name in Spanish, descriptive and concise' },
          area_id: { type: 'string', description: 'The area ID where the collection will be created' },
          description: { type: 'string', description: 'Brief description of what this collection contains' }
        },
        required: ['name', 'area_id']
      }
    }
  }
]

async function executeTool(name: string, args: any, workspaceId: string, userId: string) {
  const effectiveId = workspaceId || '00000000-0000-0000-0000-000000000001'
  
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  switch (name) {
    case 'get_areas': {
      console.log('get_areas called with effectiveId:', effectiveId)
      const { data, error } = await supabase
        .from('areas')
        .select('id, name, description, color')
        .eq('workspace_id', effectiveId)
      console.log('get_areas result:', data, 'error:', error)
      return JSON.stringify(data || [])
    }
    case 'get_collections': {
      const { data } = await supabase
        .from('collections')
        .select('id, name, description, area_id')
        .eq('area_id', args.area_id)
      return JSON.stringify(data || [])
    }
    case 'get_entries': {
      const { data } = await supabase
        .from('entries')
        .select('id, title, content')
        .eq('collection_id', args.collection_id)
        .is('deleted_at', null)
      return JSON.stringify(data || [])
    }
    case 'create_entry': {
      const { data, error } = await supabase
        .from('entries')
        .insert({
          title: args.title,
          content: args.content,
          collection_id: args.collection_id ?? null,
          area_id: args.area_id ?? null,
          workspace_id: effectiveId,
          created_by: userId,
          is_published: true,
        })
        .select()
        .single()

      if (error) {
        console.error('create_entry error:', error)
        return JSON.stringify({ success: false, error: error.message })
      }

      // Generate embedding after saving
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: `${args.title}\n\n${args.content}`,
        })
        const embedding = embeddingResponse.data[0].embedding
        await supabase
          .from('entries')
          .update({ embedding: JSON.stringify(embedding) })
          .eq('id', data.id)
      } catch (embeddingError) {
        console.error('Embedding failed:', embeddingError)
      }

      return JSON.stringify({ success: true, entry: { id: data.id, title: data.title } })
    }
    case 'update_entry': {
      const { data } = await supabase
        .from('entries')
        .update({ content: args.content, updated_at: new Date().toISOString() })
        .eq('id', args.entry_id)
        .select()
        .single()
      return JSON.stringify({ success: true, entry: data })
    }
    case 'create_collection': {
      const { data, error } = await supabase
        .from('collections')
        .insert({
          name: args.name,
          area_id: args.area_id,
          workspace_id: effectiveId,
          description: args.description ?? null,
          created_by: userId,
        })
        .select()
        .single()

      if (error) return JSON.stringify({ success: false, error: error.message })
      return JSON.stringify({ success: true, collection: { id: data.id, name: data.name } })
    }
    default:
      return JSON.stringify({ error: 'Unknown tool' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id || 'anonymous'

    const { messages, workspaceId, conversationId: existingConversationId } = await request.json()
    const effectiveWorkspaceId = workspaceId || '00000000-0000-0000-0000-000000000001'
    console.log('[Nukor API] effectiveWorkspaceId:', effectiveWorkspaceId)

    if (!messages) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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
      match_threshold: 0.1,
      match_count: 5,
    })

    const activityLogs: any[] = []
    activityLogs.push({ type: 'rag_search', title: 'Buscando en base de conocimiento', detail: userMessage.slice(0, 60) })
    activityLogs.push({
      type: 'rag_result',
      title: similarEntries && similarEntries.length > 0 ? `${similarEntries.length} entradas relevantes encontradas` : 'Sin contexto relevante',
      data: similarEntries?.map((e: any) => ({ title: e.title, similarity: e.similarity }))
    })

    let systemPrompt = `Eres Nukor, el asistente de conocimiento interno de esta empresa. Respondes siempre en español latinoamericano.

Tienes acceso a herramientas para consultar la base de conocimiento:
- get_areas: para ver las áreas de la empresa
- get_collections: para ver las colecciones dentro de un área
- get_entries: para ver las entradas dentro de una colección
- create_collection: para crear una nueva colección dentro de un área
- create_entry: para guardar conocimiento nuevo AUTOMÁTICAMENTE cuando el usuario comparte información importante — no necesitas pedir confirmación, guárdalo y notifica al usuario
- update_entry: para actualizar entradas existentes cuando el usuario corrige información

Usa estas herramientas proactivamente. Si el usuario pregunta sobre la estructura de la empresa, usa get_areas. Si comparte conocimiento nuevo, usa create_entry inmediatamente.

IMPORTANTE: Antes de llamar a create_entry, SIEMPRE llama primero a get_areas para obtener el ID real del área correspondiente.
Si no encuentras una colección adecuada para guardar la entrada, crea una nueva automáticamente usando create_collection antes de llamar a create_entry. No pidas permiso para crear colecciones.

Tu trabajo es detectar la intención del usuario en cada mensaje:

1. **PREGUNTA**: El usuario quiere saber algo. Busca en el contexto proporcionado y utilizando tus herramientas. Si no tienes información clara, dilo.
2. **CONOCIMIENTO NUEVO**: El usuario está compartiendo información, procesos o datos. Usa create_entry o update_entry y avísale que ya se guardó automáticamente. NO MANDES JSON RAW.
3. **CONVERSACIÓN**: El usuario saluda, agradece o hace comentarios generales. Responde de forma natural y breve.
4. **CONFIRMACIÓN**: Si el usuario responde "Sí", "Ok", "Adelante" o cualquier confirmación similar, continúa con la acción o flujo pendiente sin reiniciar la conversación.`

    if (similarEntries && similarEntries.length > 0) {
      systemPrompt += `\n\nContexto de conocimiento de la empresa:\n`
      similarEntries.forEach((entry: any) => {
        systemPrompt += `---\n${entry.title}\n${entry.content}\n`
      })
      systemPrompt += `\n\nFuentes utilizadas: ${similarEntries.map((e: any) => e.title).join(', ')}`
    }

    // --- Streaming Logic with Iterative Tool Calling ---
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // 1. Ensure conversation exists
          let conversationId = existingConversationId
          if (!conversationId) {
            const { data: conv, error: convErr } = await supabaseAdmin
              .from('conversations')
              .insert({
                workspace_id: effectiveWorkspaceId,
                user_id: userId,
                title: userMessage.slice(0, 60) || 'Nueva conversación'
              })
              .select('id')
              .single()
            
            if (convErr) throw convErr
            conversationId = conv.id
          }

          // 2. Emit conversationId to client
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversationId })}\n\n`))

          // Fetch ai_config from DB
          const { data: wsData } = await supabaseAdmin
            .from('workspaces')
            .select('ai_config')
            .eq('id', effectiveWorkspaceId)
            .single()
          
          const aiConfig = wsData?.ai_config || {}
          const maxMessages = aiConfig.max_messages || 20

          const conversationMessages: any[] = [
            { role: 'system' as const, content: aiConfig.system_prompt || systemPrompt },
            ...messages.slice(-maxMessages)
          ]

          let iterationCount = 0
          const MAX_ITERATIONS = 5

          // Initial status updates
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: 'Analizando intención...' })}\n\n`))

          // Emit initial activity logs (RAG results)
          for (const log of activityLogs) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ log })}\n\n`))
            await new Promise(r => setTimeout(r, 50))
          }

          while (iterationCount < MAX_ITERATIONS) {
            iterationCount++

            const response = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: conversationMessages,
              tools,
              tool_choice: 'auto',
              stream: false,
            })

            const assistantMessage = response.choices[0].message
            conversationMessages.push(assistantMessage)

            // If no tool calls — break the loop and stream final text
            if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
              break
            }

            // Execute tool calls in this iteration
            const toolNames: string[] = []
            for (const toolCall of assistantMessage.tool_calls) {
              if (toolCall.type === 'function') {
                toolNames.push(toolCall.function.name)
                const args = JSON.parse(toolCall.function.arguments)

                // Emit tool call log
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ log: { type: 'tool_call', title: `Ejecutando: ${toolCall.function.name}`, data: args } })}\n\n`))

                const startTime = Date.now()
                const result = await executeTool(toolCall.function.name, args, effectiveWorkspaceId, userId)
                const duration = Date.now() - startTime

                // Emit tool result log
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ log: { type: 'tool_result', title: `Resultado: ${toolCall.function.name}`, duration, data: JSON.parse(result) } })}\n\n`))

                if (toolCall.function.name === 'create_entry') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ log: { type: 'save', title: 'Guardando en base de conocimiento', detail: args.title } })}\n\n`))
                }

                conversationMessages.push({
                  role: 'tool' as const,
                  tool_call_id: toolCall.id,
                  content: result
                })
              }
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: `Ejecutando: ${toolNames.join(', ')}` })}\n\n`))
            await new Promise(r => setTimeout(r, 100))
          }

          // Final response streaming
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: 'Generando respuesta final...' })}\n\n`))

          const finalStream = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: conversationMessages,
            stream: true,
          })

          let fullAssistantResponse = ''
          for await (const chunk of finalStream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) {
              fullAssistantResponse += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }
          
          // Emit final response log
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ 
              log: { 
                type: 'response', 
                title: 'Respuesta final generada',
                detail: fullAssistantResponse.slice(0, 100) + (fullAssistantResponse.length > 100 ? '...' : ''),
                data: { content: fullAssistantResponse }
              } 
            })}\n\n`
          ))

          // 3. Save messages to DB
          try {
            // Save user message
            await supabaseAdmin.from('messages').insert({
              conversation_id: conversationId,
              role: 'user',
              content: userMessage,
              input_tokens: 0,
              output_tokens: 0,
              model: 'gpt-4o',
            })

            // Save assistant message
            await supabaseAdmin.from('messages').insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: fullAssistantResponse,
              input_tokens: 0,
              output_tokens: 0,
              model: 'gpt-4o',
            })

            // Update conversation timestamp
            await supabaseAdmin
              .from('conversations')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', conversationId)

            // 4. Generate better title for new conversations
            if (!existingConversationId) {
              const titleResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'system',
                    content: 'Generate a short title (max 6 words) in Spanish for this conversation based on the first message. Return only the title, nothing else.'
                  },
                  { role: 'user', content: userMessage }
                ],
                max_tokens: 20,
              })

              const title = titleResponse.choices[0].message.content?.trim().replace(/^"|"$/g, '')
              if (title) {
                await supabaseAdmin
                  .from('conversations')
                  .update({ title })
                  .eq('id', conversationId)
              }
            }
          } catch (dbErr) {
            console.error('[Nukor DB Error]:', dbErr)
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err: any) {
          console.error('[Nukor API Error]:', err)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message || 'Error interno del servidor' })}\n\n`))
        } finally {
          controller.close()
        }
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
