'use client'

import { useEffect, useRef, useState } from 'react'
import { IConversation } from '@/types/chat'
import ChatInput from '@/components/dashboard/ChatInput'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Bookmark, Menu } from 'lucide-react'

const SUGGESTIONS = [
  '¿Cuál es nuestro proceso de onboarding?',
  '¿Cómo manejamos las devoluciones?',
  '¿Cuáles son nuestras políticas de vacaciones?',
]

const TypingIndicator = () => (
  <div className="flex items-end gap-3 px-4 max-w-[720px] mx-auto w-full mt-2">
    <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-black flex-shrink-0 bg-indigo-600 text-white shadow-sm mt-1 self-start">
      N
    </div>
    <div className="rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5 bg-white border border-gray-200 shadow-sm">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full animate-bounce bg-indigo-600"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  </div>
)

interface ChatAreaProps {
  conversation: IConversation | null
  isTyping: boolean
  isStreaming: boolean
  onToggleSidebar: () => void
  onSendMessage: (content: string) => void
  userName: string
  workspaceId: string
  userId: string
  suggestedEntry?: { title: string, content: string } | null
  onSaveSuggestedEntry?: () => void
  onDiscardSuggestedEntry?: () => void
  thinkingSteps?: { id: string, text: string, status: 'active' | 'done' }[]
  isThinking?: boolean
}

const parseMessageContent = (content: string) => {
  const parts = content.split('📚 Fuentes:')
  if (parts.length > 1) {
    const mainContent = parts[0].trim()
    const sourceText = parts.slice(1).join('📚 Fuentes:').trim()
    const sources = sourceText.split('\n').map((s) => s.replace(/^[-*]\s*/, '').trim()).filter(Boolean)
    return { mainContent, sources }
  }
  return { mainContent: content, sources: [] }
}

function ThinkingLog({ steps }: { steps: { id: string, text: string, status: 'active' | 'done' }[] }) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4 bg-slate-50 border border-gray-100 rounded-2xl max-w-[400px] shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-3 text-sm">
          {step.status === 'active' ? (
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse flex-shrink-0" />
          ) : (
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
          )}
          <span className={`font-medium tracking-tight ${step.status === 'done' ? 'text-gray-400' : 'text-gray-600'}`}>
            {step.text}
          </span>
        </div>
      ))}
    </div>
  )
}

const ChatArea = ({
  conversation,
  isTyping,
  isStreaming,
  onToggleSidebar,
  onSendMessage,
  userName,
  workspaceId,
  userId,
  suggestedEntry,
  onSaveSuggestedEntry,
  onDiscardSuggestedEntry,
  thinkingSteps = [],
  isThinking = false,
}: ChatAreaProps) => {
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [entryTitle, setEntryTitle] = useState('')
  const [entryContent, setEntryContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = userName.split(' ')[0]

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setTimeout(() => {
      setEntryTitle('')
      setEntryContent('')
    }, 300)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages, isTyping])

  const handleSaveClick = (msgContent: string) => {
    const { mainContent } = parseMessageContent(msgContent)
    let firstSentence = mainContent.split('.')[0]
    if (firstSentence) firstSentence += '.'
    else firstSentence = mainContent
    firstSentence = firstSentence.trim()
    setEntryTitle(firstSentence.length > 60 ? firstSentence.slice(0, 60) + '...' : firstSentence)
    setEntryContent(mainContent)
    setIsModalOpen(true)
  }

  const submitEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: entryTitle, 
          content: entryContent, 
          workspace_id: '00000000-0000-0000-0000-000000000001' 
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to save entry')
      }

      toast.success('Entrada guardada correctamente')
      handleCloseModal()
    } catch (err: any) {
      console.error('Save entry error:', err)
      toast.error(`Error al guardar: ${err.message || 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-white shadow-sm rounded-xl m-2 md:m-3 border border-gray-200 overflow-hidden relative">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center h-14 px-4 border-b border-gray-200 bg-white">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg transition-colors hover:bg-slate-50 mr-3 text-gray-500"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>
        {conversation && (
          <span className="text-sm font-semibold tracking-tight truncate text-gray-950">
            {conversation.title}
          </span>
        )}
      </div>

      {/* Messages / Welcome */}
      <div className="flex-1 overflow-y-auto py-8 bg-slate-50">
        {!conversation ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black mb-6 bg-indigo-600 text-white shadow-md">
              N
            </div>
            <h1 className="font-heading text-3xl font-bold mb-2 tracking-tight text-gray-950">
              {greeting}, {firstName}
            </h1>
            <p className="text-lg mb-10 text-gray-500 leading-relaxed">
              ¿Qué quieres saber hoy?
            </p>
            <div className="grid sm:grid-cols-3 gap-4 w-full max-w-[720px]">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSendMessage(s)}
                  className="rounded-xl px-4 py-4 text-sm font-medium text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] bg-white border border-gray-200 hover:border-indigo-200 hover:shadow-sm text-gray-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 px-6">
            {conversation.messages.map((msg, idx) => {
              const isLastMsg = idx === conversation.messages.length - 1
              const showCursor = isStreaming && isLastMsg && msg.role === 'assistant'
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-3 max-w-[760px] mx-auto w-full mt-2 ${
                    msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-black flex-shrink-0 self-start mt-1 bg-indigo-600 text-white shadow-sm">
                      N
                    </div>
                  )}

                  <div className={`group relative ${msg.role === 'user' ? 'max-w-[75%]' : 'flex-1 min-w-0'}`}>
                    <div
                      className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-br-sm font-medium'
                          : 'bg-white border border-gray-200 text-gray-950 rounded-bl-sm'
                      }`}
                    >
                      {msg.role === 'assistant'
                        ? parseMessageContent(msg.content).mainContent
                        : msg.content}
                      {showCursor && (
                        <span className="inline-block w-[2px] h-[1em] ml-0.5 align-middle animate-pulse bg-indigo-600" />
                      )}
                    </div>

                    {msg.role === 'assistant' &&
                      parseMessageContent(msg.content).sources.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2 ml-1">
                          {parseMessageContent(msg.content).sources.map((source, i) => (
                            <span
                              key={i}
                              className="text-xs font-medium tracking-tight px-3 py-1 rounded-md bg-background-tertiary text-text-muted border border-border-default shadow-sm"
                            >
                              {source}
                            </span>
                          ))}
                        </div>
                      )}

                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => handleSaveClick(msg.content)}
                        className="absolute -bottom-8 left-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all opacity-0 group-hover:opacity-100 bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 shadow-sm"
                      >
                        <Bookmark size={12} />
                        Guardar como entrada
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {isTyping && (
                <div className="max-w-[720px] mx-auto w-full">
                  <TypingIndicator />
                </div>
              )}

              {suggestedEntry && (
                <div className="max-w-[760px] mx-auto w-full mt-6 px-4">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                        <Bookmark size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-indigo-900 text-sm mb-1 line-clamp-1">
                          💾 Nukor detectó conocimiento nuevo
                        </h3>
                        <p className="text-gray-600 text-xs mb-4 line-clamp-2 italic">
                          "{suggestedEntry.title}"
                        </p>
                        <div className="flex items-center gap-2">
                          <Button 
                            onClick={onSaveSuggestedEntry}
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-8 px-4 text-xs font-semibold shadow-sm"
                          >
                            Guardar en base de conocimiento
                          </Button>
                          <Button 
                            onClick={onDiscardSuggestedEntry}
                            variant="ghost" 
                            size="sm"
                            className="text-gray-500 hover:bg-white/50 h-8 px-3 text-xs"
                          >
                            Descartar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-8" />
          </div>
        )}
      </div>

      {/* Input bar */}
      <ChatInput onSend={onSendMessage} disabled={isTyping || isStreaming} />

      {/* Save Entry Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="sm:max-w-[500px] bg-white border-gray-200 shadow-lg text-gray-950 p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold tracking-tight text-xl text-gray-950">Save as Knowledge Entry</DialogTitle>
          </DialogHeader>

          <form onSubmit={submitEntry} className="space-y-5 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Title</label>
              <Input
                value={entryTitle}
                onChange={(e) => setEntryTitle(e.target.value)}
                placeholder="Entry title..."
                required
                className="bg-white border-gray-200 text-gray-950 focus-visible:ring-indigo-600 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Content</label>
              <Textarea
                value={entryContent}
                onChange={(e) => setEntryContent(e.target.value)}
                placeholder="Entry content..."
                required
                className="min-h-[160px] bg-white border-gray-200 text-gray-950 focus-visible:ring-indigo-600 rounded-lg leading-relaxed shadow-sm"
              />
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCloseModal}
                disabled={isSaving}
                className="text-gray-500 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-indigo-600 text-white font-semibold hover:bg-indigo-700 rounded-lg shadow-sm"
              >
                {isSaving ? 'Saving...' : 'Save Entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ChatArea
