export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { searchRagie } from '@/lib/ragie'
import { sendWhatsAppMessage } from '../members/route'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

// ── GET: Meta webhook verification ──────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// ── POST: Incoming WhatsApp messages ────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Read raw body first for signature verification
  const rawBody = await request.text()

  // Verify X-Hub-Signature-256
  const appSecret = process.env.META_APP_SECRET
  if (appSecret) {
    const signature = request.headers.get('x-hub-signature-256')
    if (!signature) return new Response('Forbidden', { status: 403 })
    const expected = 'sha256=' + crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')
    if (signature !== expected) return new Response('Forbidden', { status: 403 })
  }

  // Always respond 200 immediately so Meta doesn't retry
  processIncoming(rawBody).catch(err => console.error('[WhatsApp webhook error]', err))
  return new Response('OK', { status: 200 })
}

async function processIncoming(rawBody: string) {
  let body: any
  try { body = JSON.parse(rawBody) } catch { return }

  if (body.object !== 'whatsapp_business_account') return

  const entry = body.entry?.[0]
  const change = entry?.changes?.[0]
  if (change?.field !== 'messages') return

  const value = change.value
  const messageObj = value?.messages?.[0]
  if (!messageObj || messageObj.type !== 'text') return // ignore non-text for now

  const fromNumber = '+' + messageObj.from.replace(/^\+/, '')
  const text = messageObj.text?.body?.trim() ?? ''
  if (!text) return

  // Look up registered phone member
  const { data: member } = await supabaseAdmin
    .from('phone_members')
    .select('id, workspace_id, name, activation_code, activated')
    .eq('phone_number', fromNumber)
    .maybeSingle()

  if (!member) {
    // Not registered — silently ignore (or uncomment to notify)
    // await sendWhatsAppMessage(fromNumber, 'Este número no está registrado en Nukor.')
    return
  }

  // ── Activation flow ──────────────────────────────────────────────────────
  if (!member.activated) {
    if (text === member.activation_code) {
      await supabaseAdmin
        .from('phone_members')
        .update({ activated: true, activation_code: null })
        .eq('id', member.id)

      const { data: ws } = await supabaseAdmin
        .from('workspaces')
        .select('name')
        .eq('id', member.workspace_id)
        .maybeSingle()

      await sendWhatsAppMessage(
        fromNumber,
        `✅ ¡Acceso activado, ${member.name}! Ya puedes hacerme preguntas sobre el conocimiento de *${ws?.name ?? 'tu empresa'}*.\n\nEjemplo: _¿Cuál es el proceso de onboarding?_`
      )
    } else {
      await sendWhatsAppMessage(
        fromNumber,
        `Código incorrecto. Por favor revisa el código que te enviaron e inténtalo de nuevo.`
      )
    }
    return
  }

  // ── Active member — run chat pipeline ───────────────────────────────────
  const session = await getOrCreateSession(fromNumber, member.workspace_id)
  const history: { role: string; content: string }[] = session.messages ?? []

  // Append the new user message
  history.push({ role: 'user', content: text })

  const responseText = await runWhatsAppChat(member.workspace_id, history)

  // Trim history to last 10 messages to keep context manageable
  history.push({ role: 'assistant', content: responseText })
  const trimmedHistory = history.slice(-10)

  // Update session
  await supabaseAdmin
    .from('phone_sessions')
    .upsert({
      phone_number: fromNumber,
      workspace_id: member.workspace_id,
      messages: trimmedHistory,
      last_activity: new Date().toISOString(),
    })

  await sendWhatsAppMessage(fromNumber, responseText)
}

async function getOrCreateSession(phoneNumber: string, workspaceId: string) {
  const { data: session } = await supabaseAdmin
    .from('phone_sessions')
    .select('messages, last_activity')
    .eq('phone_number', phoneNumber)
    .maybeSingle()

  if (!session) return { messages: [] }

  // Reset context after 24h of inactivity
  const hoursSinceLast = (Date.now() - new Date(session.last_activity).getTime()) / (1000 * 60 * 60)
  if (hoursSinceLast > 24) return { messages: [] }

  return session
}

async function runWhatsAppChat(
  workspaceId: string,
  history: { role: string; content: string }[]
): Promise<string> {
  const userMessage = history[history.length - 1].content

  try {
    // Get workspace AI config
    const { data: ws } = await supabaseAdmin
      .from('workspaces')
      .select('ai_config, name')
      .eq('id', workspaceId)
      .maybeSingle()
    const aiCfg = ws?.ai_config as Record<string, any> ?? {}

    // RAG: generate embedding + search entries
    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: userMessage,
    })
    const embedding = embeddingRes.data[0].embedding

    const { data: similarEntries } = await supabaseAdmin.rpc('match_entries', {
      query_embedding: embedding,
      workspace_id: workspaceId,
      match_threshold: 0.2,
      match_count: 5,
    })

    // Ragie document search
    const ragieChunks = await searchRagie(userMessage, workspaceId).catch(() => [])

    // Build system prompt
    const assistantName = aiCfg.assistant_name || ws?.name || 'Nukor'
    let systemPrompt = aiCfg.system_prompt ||
      `Eres ${assistantName}, el asistente de conocimiento interno de esta empresa. Respondes siempre en español latinoamericano de forma concisa y clara. Estás respondiendo por WhatsApp, así que mantén las respuestas cortas (máximo 300 palabras). Usa *negrita* para resaltar conceptos clave. Evita listas muy largas.`

    if (similarEntries && similarEntries.length > 0) {
      systemPrompt += '\n\nContexto de conocimiento:\n'
      similarEntries.forEach((e: any) => {
        systemPrompt += `---\n${e.title}\n${e.content}\n`
      })
    }

    if (ragieChunks && ragieChunks.length > 0) {
      systemPrompt += '\n\nDocumentos relevantes:\n'
      ragieChunks.slice(0, 3).forEach((chunk: any) => {
        systemPrompt += `---\n${chunk.text ?? chunk.content ?? ''}\n`
      })
    }

    // Non-streaming OpenAI call
    const completion = await openai.chat.completions.create({
      model: aiCfg.model || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-8).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: 500,
      temperature: 0.7,
    })

    return completion.choices[0]?.message?.content?.trim() ?? 'Lo siento, no pude generar una respuesta.'
  } catch (err) {
    console.error('[WhatsApp chat error]', err)
    return 'Lo siento, ocurrió un error al procesar tu consulta. Intenta de nuevo en un momento.'
  }
}
