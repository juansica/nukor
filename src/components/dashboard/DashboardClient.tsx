'use client'

import { useState } from 'react'
import { IConversation, IMessage } from '@/types/chat'
import { ChatMessage, StreamUsage, streamChat } from '@/lib/openai'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/dashboard/Sidebar'
import ChatArea from '@/components/dashboard/ChatArea'

interface DashboardClientProps {
  userId: string
  userName: string
  userEmail: string
}

export default function DashboardClient({ userId, userName, userEmail }: DashboardClientProps) {
  const supabase = createClient()

  const [conversations, setConversations] = useState<IConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [thinkingSteps, setThinkingSteps] = useState<{ id: string, text: string, status: 'active' | 'done' }[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null
  const currentWorkspaceId = userId || 'default'

  // ─── Save to Supabase (silent) ──────────────────────────────────────────────
  const persistMessages = async (
    convId: string,
    convTitle: string,
    isNew: boolean,
    userContent: string,
    aiContent: string,
    usage: StreamUsage | null
  ) => {
    try {
      if (isNew) {
        await supabase.from('conversations').insert({
          id: convId,
          workspace_id: currentWorkspaceId,
          user_id: userId,
          title: convTitle,
        })
      }
      await supabase.from('messages').insert([
        {
          conversation_id: convId,
          role: 'user',
          content: userContent,
          input_tokens: 0,
          output_tokens: 0,
          model: null,
        },
        {
          conversation_id: convId,
          role: 'assistant',
          content: aiContent,
          input_tokens: usage?.inputTokens ?? 0,
          output_tokens: usage?.outputTokens ?? 0,
          model: 'gpt-4o',
        },
      ])
    } catch (err) {
      console.error('[Nukor] Failed to save conversation to Supabase:', err)
    }
  }

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
        createdAt: new Date(),
      }
      convId = newConv.id
      setConversations((prev) => [newConv, ...prev])
      setActiveConversationId(convId)
    }

    const capturedId = convId

    const userMsg: IMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    }
    setConversations((prev) =>
      prev.map((c) => (c.id === capturedId ? { ...c, messages: [...c.messages, userMsg] } : c))
    )

    const currentConv = conversations.find((c) => c.id === capturedId)
    const history: ChatMessage[] = [
      ...(currentConv?.messages ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content },
    ]

    setIsTyping(true)
    setIsStreaming(true)

    const aiMsgId = crypto.randomUUID()
    let fullContent = ''
    let gotFirstToken = false
    let finalUsage: StreamUsage | null = null

    setThinkingSteps([])
    setIsThinking(true)

    try {
      for await (const event of streamChat(currentWorkspaceId, history)) {
        if (event.type === 'error') {
          setIsThinking(false)
          if (!gotFirstToken) {
            setIsTyping(false)
            setConversations((prev) =>
              prev.map((c) =>
                c.id === capturedId
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

        if (event.type === 'step') {
          setThinkingSteps(prev => [
            ...prev.map(s => ({ ...s, status: 'done' as const })),
            { id: Date.now().toString(), text: event.content, status: 'active' }
          ])
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
                c.id === capturedId
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
              c.id === capturedId
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
          const cleanedContent = fullContent.replace(jsonMatch[0], '').trim()
          
          // Update messages with cleaned content
          setConversations((prev) =>
            prev.map((c) =>
              c.id === capturedId
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

    if (fullContent) {
      persistMessages(capturedId, convTitle, isNew, content, fullContent, finalUsage)
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
    if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false)
  }

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id)
    if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false)
  }

  return (
    <div className="h-screen flex overflow-hidden relative bg-background-secondary text-text-primary">
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
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          userName={userName}
          userEmail={userEmail}
          onClose={() => setSidebarOpen(false)}
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
        />
      </div>
    </div>
  )
}
