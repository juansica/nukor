export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { searchRagie } from '@/lib/ragie'

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
      name: 'create_area',
      description: 'Create a new area (department/division) in the workspace. Use this when the user asks to create an area or when saving knowledge that belongs to a department that does not exist yet.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Area name in Spanish, concise and descriptive (e.g. "Logística", "Ventas", "RRHH")' },
          description: { type: 'string', description: 'Brief description of what this area covers' },
          color: { type: 'string', description: 'Hex color for the area, e.g. #6366f1. Pick a distinct color.' }
        },
        required: ['name']
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
  },
  {
    type: 'function',
    function: {
      name: 'detect_contradiction',
      description: 'Check if new information contradicts existing knowledge entries. Use this before saving new information that might conflict with what is already stored.',
      parameters: {
        type: 'object',
        properties: {
          new_information: { type: 'string', description: 'The new information to check for contradictions' }
        },
        required: ['new_information']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'suggest_knowledge_gaps',
      description: 'After answering a question, identify topics mentioned in the conversation that have no knowledge entries and suggest adding them.',
      parameters: {
        type: 'object',
        properties: {
          topics: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of topics mentioned in the conversation that are not documented in the knowledge base'
          }
        },
        required: ['topics']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_knowledge_audit',
      description: 'Run a full audit of the knowledge base when the user asks for it (e.g. "auditoría", "audit", "revisar base de conocimiento"). Reports outdated entries, unclassified entries, and empty areas.',
      parameters: {
        type: 'object',
        properties: {
          workspace_id: { type: 'string', description: 'The workspace ID to audit' }
        },
        required: ['workspace_id']
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
        return JSON.stringify({ success: false, error: 'Failed to create entry' })
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
    case 'create_area': {
      const { data, error } = await supabase
        .from('areas')
        .insert({
          name: args.name,
          description: args.description ?? null,
          color: args.color ?? '#6366f1',
          workspace_id: effectiveId,
          created_by: userId,
        })
        .select()
        .single()

      if (error) {
        console.error('create_area error:', error)
        return JSON.stringify({ success: false, error: 'Failed to create area' })
      }
      return JSON.stringify({ success: true, area: { id: data.id, name: data.name, color: data.color } })
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

      if (error) return JSON.stringify({ success: false, error: 'Failed to create collection' })
      return JSON.stringify({ success: true, collection: { id: data.id, name: data.name } })
    }
    case 'detect_contradiction': {
      // Search for semantically similar entries to surface potential conflicts
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: args.new_information,
        })
        const embedding = embeddingResponse.data[0].embedding

        const { data: similarEntries } = await supabase.rpc('match_entries', {
          query_embedding: embedding,
          workspace_id: effectiveId,
          match_threshold: 0.5,
          match_count: 3,
        })

        if (!similarEntries || similarEntries.length === 0) {
          return JSON.stringify({ has_similar_entries: false, entries: [] })
        }

        return JSON.stringify({
          has_similar_entries: true,
          entries: similarEntries.map((e: any) => ({
            id: e.id,
            title: e.title,
            content: e.content,
            similarity: e.similarity,
          }))
        })
      } catch (err) {
        console.error('detect_contradiction error:', err)
        return JSON.stringify({ has_similar_entries: false, entries: [] })
      }
    }
    case 'suggest_knowledge_gaps': {
      const topics: string[] = args.topics || []
      if (topics.length === 0) {
        return JSON.stringify({ success: true, suggestion: 'No se detectaron temas sin documentar.' })
      }
      return JSON.stringify({
        success: true,
        undocumented_topics: topics,
        suggestion: `Detecté ${topics.length} tema${topics.length > 1 ? 's' : ''} sin documentar: ${topics.join(', ')}.`
      })
    }
    case 'run_knowledge_audit': {
      const auditWorkspaceId = args.workspace_id || effectiveId

      const [{ data: entries }, { data: areas }] = await Promise.all([
        supabase
          .from('entries')
          .select('id, title, created_at, area_id, collection_id')
          .eq('workspace_id', auditWorkspaceId)
          .is('deleted_at', null),
        supabase
          .from('areas')
          .select('id, name')
          .eq('workspace_id', auditWorkspaceId),
      ])

      const now = Date.now()
      const outdated = (entries || []).filter(e => {
        const days = (now - new Date(e.created_at).getTime()) / (1000 * 60 * 60 * 24)
        return days > 90
      })
      const unclassified = (entries || []).filter(e => !e.area_id && !e.collection_id)
      const areasWithEntries = new Set((entries || []).map(e => e.area_id).filter(Boolean))
      const emptyAreas = (areas || []).filter(a => !areasWithEntries.has(a.id))

      const total = entries?.length || 0
      const healthScore = total === 0
        ? 0
        : Math.round((total - outdated.length - unclassified.length) / total * 100)

      return JSON.stringify({
        total_entries: total,
        outdated_entries: outdated.length,
        outdated_list: outdated.slice(0, 5).map(e => e.title),
        unclassified_entries: unclassified.length,
        empty_areas: emptyAreas.map(a => a.name),
        health_score: Math.max(0, healthScore),
      })
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

    // Fetch user profile + recent conversations in parallel for personalized context
    const [{ data: profile }, { data: recentConvs }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('full_name, last_workspace_id')
        .eq('id', userId)
        .maybeSingle(),
      supabaseAdmin
        .from('conversations')
        .select('title, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const userName = profile?.full_name?.split(' ')[0] || 'Usuario'

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

    // Build dynamic system prompt
    let systemPrompt = `Eres Nukor, el asistente de conocimiento interno de esta empresa. Respondes siempre en español latinoamericano con un tono amigable y profesional.

Contexto del usuario actual:
- Nombre: ${userName}
- Workspace ID: ${effectiveWorkspaceId}

Dirígate a ${userName} por su nombre cuando sea apropiado y natural.

Tienes acceso a herramientas para consultar la base de conocimiento:
- get_areas: para ver las áreas de la empresa
- get_collections: para ver las colecciones dentro de un área
- get_entries: para ver las entradas dentro de una colección
- create_area: para crear una nueva área/departamento cuando el usuario lo pide o cuando no existe el área adecuada
- create_collection: para crear una nueva colección dentro de un área
- create_entry: para guardar conocimiento nuevo AUTOMÁTICAMENTE cuando el usuario comparte información importante — no necesitas pedir confirmación, guárdalo y notifica al usuario
- update_entry: para actualizar entradas existentes cuando el usuario corrige información
- detect_contradiction: para verificar si nueva información contradice entradas existentes antes de guardar

Usa estas herramientas proactivamente. Si el usuario pregunta sobre la estructura de la empresa, usa get_areas. Si comparte conocimiento nuevo, usa create_entry inmediatamente.

IMPORTANTE: Antes de llamar a create_entry, llama primero a get_areas para obtener el ID real del área correspondiente.
Si no existe ningún área adecuada, créala primero con create_area — no le digas al usuario que no puedes proceder por falta de áreas.
Si no encuentras una colección adecuada, créala automáticamente con create_collection antes de llamar a create_entry. No pidas permiso para crear áreas ni colecciones.

Antes de guardar información nueva que pueda contradecir conocimiento existente, usa detect_contradiction. Si encuentras entradas similares con contenido conflictivo, notifica a ${userName}: "Nota: esto podría contradecir lo que tenemos registrado sobre [tema]. ¿Quieres actualizar la entrada existente o crear una nueva?"

Cuando encuentres múltiples entradas relacionadas con una pregunta, sintetiza la información en una respuesta coherente y fluida. No listes las entradas por separado — integra toda la información en párrafos naturales. Solo menciona las fuentes al final de forma compacta.

Tu trabajo es detectar la intención del usuario en cada mensaje:

1. **PREGUNTA**: El usuario quiere saber algo. Busca en el contexto proporcionado y utilizando tus herramientas. Si no tienes información clara, dilo.
2. **CONOCIMIENTO NUEVO**: El usuario está compartiendo información, procesos o datos. Usa create_entry o update_entry y avísale que ya se guardó automáticamente. NO MANDES JSON RAW.
3. **CONVERSACIÓN**: El usuario saluda, agradece o hace comentarios generales. Responde de forma natural y breve.
4. **CONFIRMACIÓN**: Si el usuario responde "Sí", "Ok", "Adelante" o cualquier confirmación similar, continúa con la acción o flujo pendiente sin reiniciar la conversación.

INCERTIDUMBRE: Cuando no estés completamente seguro de una respuesta basada en el contexto disponible, indícalo explícitamente:
- "Basándome en lo que tenemos registrado, creo que..."
- "Solo tenemos una entrada sobre esto y fue registrada hace [tiempo], así que verifica si sigue siendo válido."
- "Tengo información parcial sobre esto — podría faltar contexto importante."
Nunca inventes información para completar una respuesta incompleta.

SUGERENCIAS PROACTIVAS: Al final de conversaciones donde respondiste preguntas, usa suggest_knowledge_gaps si detectas temas importantes mencionados que no están documentados. Hazlo de forma natural: "Por cierto, noté que mencionaste [tema] — ¿te gustaría que lo documentemos?"

AUDITORÍA: Cuando el usuario diga "auditoría", "audit", "revisar base de conocimiento" o similar, usa run_knowledge_audit con el workspace_id actual y presenta los resultados de forma clara:
- Salud general: X%
- Entradas desactualizadas: N (lista las primeras 5)
- Entradas sin clasificar: N
- Áreas vacías: lista
Ofrece ayuda para resolver cada problema encontrado.`

    // Inject retrieved knowledge context
    if (similarEntries && similarEntries.length > 0) {
      // Check for outdated entries (older than 90 days)
      const outdatedEntries = similarEntries.filter((entry: any) => {
        if (!entry.created_at) return false
        const daysDiff = (Date.now() - new Date(entry.created_at).getTime()) / (1000 * 60 * 60 * 24)
        return daysDiff > 90
      })

      if (outdatedEntries.length > 0) {
        systemPrompt += `\n\nAVISO: Las siguientes entradas tienen más de 90 días y pueden estar desactualizadas: ${outdatedEntries.map((e: any) => e.title).join(', ')}. Cuando uses esta información, menciona a ${userName} que podría estar desactualizada y ofrécete a actualizarla.`
      }

      if (similarEntries.length > 2) {
        systemPrompt += `\n\nSe encontraron ${similarEntries.length} entradas relacionadas. Sintetiza toda esta información en una respuesta fluida y coherente — no listes las entradas por separado.`
      }

      systemPrompt += `\n\nContexto de conocimiento de la empresa:\n`
      similarEntries.forEach((entry: any) => {
        systemPrompt += `---\n${entry.title}\n${entry.content}\n`
      })
      systemPrompt += `\n\nFuentes utilizadas: ${similarEntries.map((e: any) => e.title).join(', ')}`
    }

    // Inject recent conversation topics for persistent memory context
    if (recentConvs && recentConvs.length > 0) {
      const recentTopics = recentConvs.map(c => c.title).filter(Boolean).join(', ')
      if (recentTopics) {
        systemPrompt += `\n\nTemas recientes de ${userName}: ${recentTopics}. Usa este contexto para personalizar tus respuestas cuando sea relevante.`
      }
    }

    // Search Ragie for document chunks
    const ragieChunks = await searchRagie(userMessage, effectiveWorkspaceId)
    if (ragieChunks.length > 0) {
      systemPrompt += `\n\nContexto adicional de documentos:\n`
      ragieChunks.forEach((chunk: any) => {
        systemPrompt += `---\n${chunk.text}\n`
      })
      activityLogs.push({
        type: 'rag_result',
        title: `${ragieChunks.length} fragmentos de documentos encontrados`,
        data: ragieChunks.map((c: any) => ({ text: c.text?.slice(0, 80) }))
      })
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

          // Fetch ai_config from DB for max_messages setting
          const { data: wsData } = await supabaseAdmin
            .from('workspaces')
            .select('ai_config')
            .eq('id', effectiveWorkspaceId)
            .single()

          const aiConfig = wsData?.ai_config || {}
          const maxMessages = aiConfig.max_messages || 20

          const conversationMessages: any[] = [
            { role: 'system' as const, content: systemPrompt },
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

            // If no tool calls — break WITHOUT pushing, so finalStream generates a fresh response
            if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
              break
            }

            // Only push assistant message when it has tool calls (tool results must follow)
            conversationMessages.push(assistantMessage)

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
    console.error('Chat route error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
