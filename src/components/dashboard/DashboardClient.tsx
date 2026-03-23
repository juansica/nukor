'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import { IConversation, IMessage } from '@/types/chat'
import { ChatMessage, StreamUsage, streamChat } from '@/lib/openai'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/dashboard/Sidebar'
import ChatArea from '@/components/dashboard/ChatArea'

export interface LogEntry {
  id: string
  timestamp: Date
  type: 'thinking' | 'tool_call' | 'tool_result' | 'rag_search' | 'rag_result' | 'response' | 'save' | 'error'
  title: string
  detail?: string
  data?: any
  duration?: number
}

export interface LogGroup {
  id: string
  timestamp: Date
  userMessage: string
  steps: LogEntry[]
  expanded: boolean
}

interface DashboardClientProps {
  userId: string
  userName: string
  userEmail: string
  workspaceName: string
  workspaceId: string
}

export default function DashboardClient({ userId, userName, userEmail, workspaceName, workspaceId }: DashboardClientProps) {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [conversations, setConversations] = useState<IConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    searchParams.get('id')
  )

  // Sync state when URL changes (e.g. back button)
  useEffect(() => {
    const id = searchParams.get('id')
    setActiveConversationId(id)
  }, [searchParams])
  const [isTyping, setIsTyping] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [thinkingSteps, setThinkingSteps] = useState<{ id: string, text: string, status: 'active' | 'done' }[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [logGroups, setLogGroups] = useState<LogGroup[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )
  // Prevents the activeConversationId effect from calling loadConversation on
  // first mount — that is handled sequentially by the init effect below.
  const isFirstConvEffect = useRef(true)

  // ─── Initial Load ──────────────────────────────────────────────────────────
  // Run sequentially: fetch conversation list first, THEN load messages for the
  // active conversation so that loadConversation always finds it in state.
  useEffect(() => {
    const init = async () => {
      await fetchConversations()
      if (activeConversationId) loadConversation(activeConversationId)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      const fetched: IConversation[] = data.conversations || []
      // Merge: preserve in-memory messages so in-flight streaming isn't wiped
      setConversations(prev => {
        const prevMap = new Map(prev.map(c => [c.id, c]))
        return fetched.map(conv => ({
          ...conv,
          messages: prevMap.get(conv.id)?.messages || [],
        }))
      })
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    }
  }

  // Effect to load messages when the active conversation changes.
  // Skips the first run on mount — init() handles that sequentially.
  useEffect(() => {
    if (isFirstConvEffect.current) {
      isFirstConvEffect.current = false
      return
    }
    if (activeConversationId) {
      loadConversation(activeConversationId)
    } else {
      setThinkingSteps([])
      setLogGroups([])
    }
  }, [activeConversationId])

  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`)
      const data = await res.json()
      const messages: IMessage[] = data.messages || []
      // Don't overwrite in-flight streaming messages with an empty DB response
      setConversations(prev => prev.map(c => {
        if (c.id !== id) return c
        return { ...c, messages: messages.length > 0 ? messages : (c.messages || []) }
      }))
    } catch (err) {
      console.error('Failed to load conversation:', err)
    }
  }


  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null
  const currentWorkspaceId = workspaceId || userId || 'default'



  // ─── Main send handler ───────────────────────────────────────────────────────
  const handleSendMessage = async (content: string) => {
    if (isStreaming) return

    let convId = activeConversationId
    const isNew = !convId
    const convTitle = content.length > 48 ? content.slice(0, 48) + '…' : content

    if (!convId) {
      const newConv: IConversation = {
        id: crypto.randomUUID(),
        title: convTitle,
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      convId = newConv.id
      setConversations((prev) => [newConv, ...prev])
      setActiveConversationId(convId)
    }

    const capturedId = convId
    // Tracks the real server-assigned ID once it arrives (may differ from temp UUID for new convs)
    let effectiveConvId = capturedId

    const userMsg: IMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    }
    setConversations((prev) =>
      prev.map((c) => (c.id === capturedId ? { ...c, messages: [...c.messages, userMsg] } : c))
    )

    const MAX_MESSAGES = 20
    const currentConv = conversations.find((c) => c.id === capturedId)
    // Construct history manually including the new message to avoid stale state issues
    const allMessagesList = [...(currentConv?.messages ?? []), userMsg]
    const history: ChatMessage[] = allMessagesList.slice(-MAX_MESSAGES).map((m) => ({ 
      role: m.role, 
      content: m.content 
    }))

    console.log('[Nukor] Sending history:', history.length, 'messages')

    setIsTyping(true)
    setIsStreaming(true)

    const aiMsgId = crypto.randomUUID()
    let fullContent = ''
    let gotFirstToken = false
    let finalUsage: StreamUsage | null = null

    setThinkingSteps([])
    setIsThinking(true)

    // Create a new LogGroup for this turn
    setLogGroups(prev => [{
      id: crypto.randomUUID(),
      timestamp: new Date(),
      userMessage: content,
      steps: [],
      expanded: false
    }, ...prev])

    try {
      for await (const event of streamChat(currentWorkspaceId, history, isNew ? null : capturedId)) {
        if (event.type === 'error') {
          setIsThinking(false)
          if (!gotFirstToken) {
            setIsTyping(false)
            setConversations((prev) =>
              prev.map((c) =>
                c.id === effectiveConvId
                  ? {
                      ...c,
                      messages: [
                        ...c.messages,
                        {
                          id: aiMsgId,
                          role: 'assistant' as const,
                          content: `Lo siento, ocurrió un error: ${event.error}`,
                          timestamp: new Date(),
                        },
                      ],
                    }
                  : c
              )
            )
          }
          break
        }

        if (event.type === 'log') {
          setLogGroups(prev => prev.map((group, i) => i === 0 ? {
            ...group,
            steps: [...group.steps, {
              ...event.log,
              id: Date.now().toString() + Math.random().toString(36).substring(7),
              timestamp: new Date()
            }]
          } : group))
          continue
        }

        if (event.type === 'conversation') {
          if (isNew) {
            effectiveConvId = event.id
            // Rename the temp-UUID conversation to the real server-assigned ID
            setConversations(prev =>
              prev.map(c => (c.id === capturedId ? { ...c, id: event.id } : c))
            )
            setActiveConversationId(event.id)
            router.push(`/dashboard?id=${event.id}`)
          }
          continue
        }

        if (event.type === 'step') {
          setThinkingSteps(prev => [
            ...prev.map(s => ({ ...s, status: 'done' as const })),
            { id: Date.now().toString(), text: event.content, status: 'active' }
          ])
          // Auto convert text steps into thinking logs
          setLogGroups(prev => prev.map((group, i) => i === 0 ? {
            ...group,
            steps: [...group.steps, {
              type: 'thinking',
              title: event.content,
              id: Date.now().toString() + Math.random().toString(36).substring(7),
              timestamp: new Date()
            }]
          } : group))
          continue
        }

        if (event.type === 'token') {
          if (!gotFirstToken) {
            gotFirstToken = true
            setIsTyping(false)
            setIsThinking(false)
            setThinkingSteps(prev => prev.map(s => ({ ...s, status: 'done' })))

            setConversations((prev) =>
              prev.map((c) =>
                c.id === effectiveConvId
                  ? {
                      ...c,
                      messages: [
                        ...c.messages,
                        { id: aiMsgId, role: 'assistant' as const, content: '', timestamp: new Date() },
                      ],
                    }
                  : c
              )
            )
          }
          fullContent += event.content
          setConversations((prev) =>
            prev.map((c) =>
              c.id === effectiveConvId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === aiMsgId ? { ...m, content: fullContent } : m
                    ),
                  }
                : c
            )
          )
        }

        if (event.type === 'done') {
          finalUsage = event.usage
          fetchConversations() // Final refresh for title update
        }
      }
    } finally {
      setIsTyping(false)
      setIsStreaming(false)
      setIsThinking(false)
      
      // After stream completes, check for save intent
      const jsonMatch = fullContent.match(/\{"intent":"save".*?\}/)
      if (jsonMatch) {
        try {
          const saveData = JSON.parse(jsonMatch[0])
          const cleanedContent = fullContent
            .replace(/```json[\s\S]*?```/g, '')
            .replace(/\{"intent":"save"[\s\S]*?\}/g, '')
            .trim()
          
          // Update messages with cleaned content
          setConversations((prev) =>
            prev.map((c) =>
              c.id === effectiveConvId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === aiMsgId ? { ...m, content: cleanedContent } : m
                    ),
                  }
                : c
            )
          )
          
          // Set suggested entry for UI banner
          setSuggestedEntry({
            title: saveData.title,
            content: saveData.content
          })
          
          fullContent = cleanedContent // Use cleaned content for persistence
        } catch (e) {
          console.error('[Nukor] Failed to parse save intent JSON:', e)
        }
      }
    }
  }

  const handleDeleteConversation = async (id: string) => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (res.ok) {
        if (activeConversationId === id) {
          setActiveConversationId(null)
          router.push('/dashboard')
        }
        fetchConversations()
      }
    } catch (err) {
      console.error('Delete conversation error:', err)
    }
  }

  const [isFileUploading, setIsFileUploading] = useState(false)

  const handleFileUpload = async (file: File) => {
    setIsFileUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('workspace_id', currentWorkspaceId)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json()
        import('sonner').then(({ toast }) => toast.error(data.error || 'Error al subir el archivo'))
        return
      }
      import('sonner').then(({ toast }) => toast.success(`"${file.name}" subido correctamente`))
      // Add a local file message to the active conversation
      const fileMsg: IMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: `__FILE__${file.name}__${file.type}__${file.size}`,
        timestamp: new Date(),
      }
      if (activeConversationId) {
        setConversations(prev =>
          prev.map(c => c.id === activeConversationId ? { ...c, messages: [...c.messages, fileMsg] } : c)
        )
      }
    } catch {
      import('sonner').then(({ toast }) => toast.error('Error al subir el archivo'))
    } finally {
      setIsFileUploading(false)
    }
  }

  const [suggestedEntry, setSuggestedEntry] = useState<{title: string, content: string} | null>(null)

  const handleSaveSuggestedEntry = async () => {
    if (!suggestedEntry) return
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: suggestedEntry.title, 
          content: suggestedEntry.content, 
          workspace_id: '00000000-0000-0000-0000-000000000001' 
        })
      })

      if (!res.ok) throw new Error('Failed to save entry')
      
      import('sonner').then(({ toast }) => toast.success('Entrada guardada correctamente'))
      setSuggestedEntry(null)
    } catch (err) {
      console.error('Save suggested entry error:', err)
      import('sonner').then(({ toast }) => toast.error('Error al guardar la entrada'))
    }
  }

  const handleNewConversation = () => {
    setActiveConversationId(null)
    setLogGroups([])
    if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false)
  }

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id)
    if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false)
  }

  return (
    <motion.div
      className="h-screen flex overflow-hidden relative bg-background-secondary text-text-primary"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden bg-text-primary/10 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-30 flex-shrink-0
          w-64 h-full flex flex-col bg-background-primary border-r border-border-default
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <Sidebar
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          userName={userName}
          userEmail={userEmail}
          workspaceName={workspaceName}
          onClose={() => setSidebarOpen(false)}
          initialConversations={conversations}
        />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-full">
        <ChatArea
          conversation={activeConversation}
          isTyping={isTyping}
          isStreaming={isStreaming}
          onToggleSidebar={() => setSidebarOpen((s) => !s)}
          onSendMessage={handleSendMessage}
          userName={userName}
          workspaceId={currentWorkspaceId}
          userId={userId}
          suggestedEntry={suggestedEntry}
          onSaveSuggestedEntry={handleSaveSuggestedEntry}
          onDiscardSuggestedEntry={() => setSuggestedEntry(null)}
          thinkingSteps={thinkingSteps}
          isThinking={isThinking}
          logGroups={logGroups}
          onClearLogs={() => setLogGroups([])}
          onFileUpload={handleFileUpload}
          isFileUploading={isFileUploading}
        />
      </div>
    </motion.div>
  )
}
