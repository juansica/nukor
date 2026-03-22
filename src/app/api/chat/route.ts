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
      description: 'Save a new knowledge entry. Always call get_areas first to find the correct area_id before saving.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short descriptive title' },
          content: { type: 'string', description: 'Full structured content' },
          area_id: { type: 'string', description: 'The ID of the area this entry belongs to. Call get_areas first to find the correct ID.' },
          collection_id: { type: 'string', description: 'Optional collection ID' }
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
  }
]

async function executeTool(name: string, args: any, workspaceId: string, userId: string) {
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  switch (name) {
    case 'get_areas': {
      const { data } = await supabase
        .from('areas')
        .select('id, name, description, color')
        .eq('workspace_id', workspaceId)
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
      const { data } = await supabase
        .from('entries')
        .insert({
          title: args.title,
          content: args.content,
          area_id: args.area_id ?? null,
          collection_id: args.collection_id ?? null,
          workspace_id: workspaceId,
          created_by: userId,
        })
        .select()
        .single()
      return JSON.stringify({ success: true, entry: data })
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
    default:
      return JSON.stringify({ error: 'Unknown tool' })
  }
}

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

Tienes acceso a herramientas para consultar la base de conocimiento:
- get_areas: para ver las áreas de la empresa
- get_collections: para ver las colecciones dentro de un área
- get_entries: para ver las entradas dentro de una colección
- create_entry: para guardar conocimiento nuevo AUTOMÁTICAMENTE cuando el usuario comparte información importante — no necesitas pedir confirmación, guárdalo y notifica al usuario
- update_entry: para actualizar entradas existentes cuando el usuario corrige información

Usa estas herramientas proactivamente. Si el usuario pregunta sobre la estructura de la empresa, usa get_areas. Si comparte conocimiento nuevo, usa create_entry inmediatamente.

IMPORTANTE: Antes de llamar a create_entry, SIEMPRE llama primero a get_areas para obtener el ID real del área correspondiente. Nunca guardes una entrada sin area_id si el contenido claramente pertenece a un área existente. El flujo correcto es:
1. get_areas() → obtener lista de áreas con sus IDs
2. Identificar a qué área pertenece el contenido
3. create_entry() con el area_id correcto

Tu trabajo es detectar la intención del usuario en cada mensaje:

1. **PREGUNTA**: El usuario quiere saber algo. Busca en el contexto proporcionado y utilizando tus herramientas. Si no tienes información clara, dilo.
2. **CONOCIMIENTO NUEVO**: El usuario está compartiendo información, procesos o datos. Usa create_entry o update_entry y avísale que ya se guardó automáticamente. NO MANDES JSON RAW.
3. **CONVERSACIÓN**: El usuario saluda, agradece o hace comentarios generales. Responde de forma natural y breve.`

    if (similarEntries && similarEntries.length > 0) {
      systemPrompt += `\n\nContexto de conocimiento de la empresa:\n`
      similarEntries.forEach((entry: any) => {
        systemPrompt += `---\n${entry.title}\n${entry.content}\n`
      })
      systemPrompt += `\n\nFuentes utilizadas: ${similarEntries.map((e: any) => e.title).join(', ')}`
    }

    // Primera llamada (no streaming) para gestionar tool calls
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      tools,
      tool_choice: 'auto',
      stream: false,
    })

    const message = response.choices[0].message

    // 2. If model wants to call tools
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolMessages = []
      const toolNames: string[] = []

      for (const toolCall of message.tool_calls) {
        if (toolCall.type === 'function') {
          toolNames.push(toolCall.function.name)
          const args = JSON.parse(toolCall.function.arguments)
          const result = await executeTool(toolCall.function.name, args, effectiveWorkspaceId, userId)

          toolMessages.push({
            role: 'tool' as const,
            tool_call_id: toolCall.id,
            content: result
          })
        }
      }

      // 3. Second call — stream the final response with tool results as context
      const finalStream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
          message,
          ...toolMessages
        ],
        stream: true,
      })

      // 4. Stream the response
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          // Emit internal step logs
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: 'Analizando intención...' })}\n\n`))
          await new Promise(r => setTimeout(r, 400))
          
          if (similarEntries && similarEntries.length > 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: `Revisando base de conocimiento general (${similarEntries.length} fuentes)` })}\n\n`))
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: `Ejecutando acción: ${toolNames.join(', ')}` })}\n\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: 'Generando respuesta...' })}\n\n`))

          for await (const chunk of finalStream) {
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
    }

    // 5. If no tool calls — stream directly as before
    const directStream = await openai.chat.completions.create({
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
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: 'Analizando intención...' })}\n\n`))
        await new Promise(r => setTimeout(r, 400))
        
        if (similarEntries && similarEntries.length > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: `Revisando base de conocimiento general (${similarEntries.length} fuentes)` })}\n\n`))
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: 'Generando respuesta...' })}\n\n`))

        for await (const chunk of directStream) {
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
