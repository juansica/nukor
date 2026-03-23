'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IConversation } from '@/types/chat'
import ChatInput from '@/components/dashboard/ChatInput'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Plus, Send, Menu, Sparkles, BookmarkPlus, Check, X, ArrowUp, Activity, FileText, FileSpreadsheet, File } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { LogEntry, LogGroup } from '@/components/dashboard/DashboardClient'

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
  logGroups?: LogGroup[]
  onClearLogs?: () => void
  onFileUpload?: (file: File) => Promise<void>
  isFileUploading?: boolean
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

function LogEntryView({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false)

  const icons: Record<string, string> = {
    thinking: '🧠',
    tool_call: '🔧',
    tool_result: '📦',
    rag_search: '🔍',
    rag_result: '📚',
    response: '✨',
    save: '💾',
    error: '❌'
  }

  const colors: Record<string, string> = {
    thinking: 'text-purple-600 bg-purple-50 border-purple-100',
    tool_call: 'text-blue-600 bg-blue-50 border-blue-100',
    tool_result: 'text-green-600 bg-green-50 border-green-100',
    rag_search: 'text-orange-600 bg-orange-50 border-orange-100',
    rag_result: 'text-teal-600 bg-teal-50 border-teal-100',
    response: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    save: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    error: 'text-red-600 bg-red-50 border-red-100'
  }

  const logType = log.type || 'thinking'
  const icon = icons[logType] || '⚪'
  const color = colors[logType] || 'text-gray-600 bg-gray-50 border-gray-100'

  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm flex-shrink-0">{icon}</span>
          <span className="text-xs font-medium truncate">{log.title}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {log.duration && (
            <span className="text-xs opacity-60">{log.duration}ms</span>
          )}
          {log.data && (
            <button onClick={() => setExpanded(!expanded)} className="text-xs opacity-60 hover:opacity-100 px-1">
              {expanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>
      {log.detail && (
        <p className="text-xs opacity-70 mt-1 ml-6">{log.detail}</p>
      )}
      {expanded && log.data && (
        <pre className="text-xs mt-2 ml-6 overflow-x-auto opacity-80 bg-white/50 rounded p-2">
          {JSON.stringify(log.data, null, 2)}
        </pre>
      )}
      <p className="text-xs opacity-40 mt-1 ml-6">
        {new Date(log.timestamp).toLocaleTimeString('es-CL')}
      </p>
    </div>
  )
}

function LogGroupView({ group }: { group: LogGroup }) {
  const [expanded, setExpanded] = useState(group.expanded || false)

  const stepsCount = group.steps.length
  const ragCount = group.steps.filter(s => s.type === 'rag_search' || s.type === 'rag_result').length
  const toolsCount = group.steps.filter(s => s.type === 'tool_call' || s.type === 'tool_result').length

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex-1 min-w-0 pr-3">
          <p className="text-sm font-medium text-gray-900 truncate">
            <span className="text-purple-500 mr-2">🟣</span>
            "{group.userMessage.length > 35 ? group.userMessage.slice(0, 35) + '...' : group.userMessage}"
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {stepsCount} pasos · RAG: {ragCount} · Tools: {toolsCount}
          </p>
        </div>
        <div className="flex flex-col items-end flex-shrink-0">
          <span className="text-[10px] text-gray-400 mb-1">{new Date(group.timestamp).toLocaleTimeString('es-CL')}</span>
          <span className="text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 py-3 border-t border-gray-100 space-y-3 bg-white">
          {group.steps.map(step => (
            <LogEntryView key={step.id} log={step} />
          ))}
          {group.steps.length === 0 && (
            <p className="text-xs text-center text-gray-400">Procesando...</p>
          )}
        </div>
      )}
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
  logGroups = [],
  onClearLogs,
  onFileUpload,
  isFileUploading = false,
}: ChatAreaProps) => {
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [entryTitle, setEntryTitle] = useState('')
  const [entryContent, setEntryContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [logsOpen, setLogsOpen] = useState(false)
  const [hasNewLogs, setHasNewLogs] = useState(false)
  const prevEventsCountRef = useRef(0)

  // Use flat count of events to detect new logs
  useEffect(() => {
    const currentCount = logGroups?.reduce((acc, g) => acc + g.steps.length, 0) || 0
    if (currentCount > prevEventsCountRef.current && !logsOpen) {
      setHasNewLogs(true)
    }
    prevEventsCountRef.current = currentCount
  }, [logGroups, logsOpen])

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault()
        setLogsOpen(prev => {
          if (!prev) setHasNewLogs(false)
          return !prev
        })
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [])

  const handleToggleLogs = () => {
    setLogsOpen(!logsOpen)
    if (!logsOpen) setHasNewLogs(false)
  }

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
    <div className="flex h-full w-full relative overflow-hidden bg-background-secondary">
      {/* Main chat box that squeezes its width smoothly */}
      <div className={`flex-1 flex flex-col min-w-0 bg-white shadow-sm rounded-xl m-2 md:m-3 border border-gray-200 overflow-hidden relative transition-all duration-300 ${logsOpen ? 'mr-[330px]' : ''}`}>
        
        {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between h-14 px-4 border-b border-gray-200 bg-white">
        <div className="flex flex-row items-center">
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
        <button
          onClick={handleToggleLogs}
          className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="Ver actividad del asistente"
        >
          <Activity className="w-5 h-5 text-gray-500" />
          {hasNewLogs && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 border-2 border-white rounded-full" />
          )}
        </button>
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
              const isUser = msg.role === 'user'
              const isLastMsg = idx === conversation.messages.length - 1
              const showCursor = isStreaming && isLastMsg && msg.role === 'assistant'
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <div
                    className={`flex items-end gap-3 max-w-[760px] mx-auto w-full mt-2 ${
                      isUser ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-black flex-shrink-0 self-start mt-1 bg-indigo-600 text-white shadow-sm">
                        N
                      </div>
                    )}

                    {/* Message content */}
                    <div
                      className={`flex-1 min-w-0 flex flex-col ${
                        isUser ? 'items-end' : 'items-start'
                      }`}
                    >
                      {isUser && msg.content.startsWith('__FILE__') ? (() => {
                        const parts = msg.content.split('__').filter(Boolean)
                        // parts: ['FILE', name, type, size]
                        const [, name, mime, sizeStr] = parts
                        const size = parseInt(sizeStr || '0', 10)
                        const sizeLabel = size > 1024 * 1024
                          ? `${(size / 1024 / 1024).toFixed(1)} MB`
                          : `${Math.round(size / 1024)} KB`
                        const isExcel = mime?.includes('spreadsheet') || mime?.includes('excel')
                        const isWord = mime?.includes('word') || mime?.includes('msword')
                        const Icon = isExcel ? FileSpreadsheet : isWord ? FileText : File
                        const iconColor = isExcel ? 'text-green-600' : isWord ? 'text-blue-600' : 'text-red-600'
                        return (
                          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-gray-200 shadow-sm max-w-[280px]">
                            <div className={`flex-shrink-0 ${iconColor}`}>
                              <Icon size={24} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                              <p className="text-xs text-gray-500">{sizeLabel}</p>
                            </div>
                          </div>
                        )
                      })() : (
                        <>
                          <div
                            className={`
                              px-5 py-3.5 rounded-2xl text-sm leading-relaxed max-w-full
                              ${
                                isUser
                                  ? 'bg-indigo-600 text-white font-medium border border-indigo-500 shadow-sm'
                                  : 'bg-white text-gray-900 border border-border-default shadow-sm'
                              }
                            `}
                          >
                            {isUser ? (
                              msg.content
                            ) : (
                              <div className="prose prose-sm max-w-none text-gray-700 prose-p:leading-relaxed prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-100 prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                                <ReactMarkdown>
                                  {parseMessageContent(msg.content).mainContent}
                                </ReactMarkdown>
                              </div>
                            )}
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
                        </>
                      )}
                    </div>
                  </div>

                  {/* Save Detection Banner (Directly below last AI message) */}
                  <AnimatePresence>
                  {!isUser && isLastMsg && suggestedEntry && (
                    <motion.div
                      className="max-w-[760px] mx-auto w-full mt-2 mb-4 px-10"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    >
                      <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <BookmarkPlus className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-indigo-700">Nukor detectó conocimiento nuevo</p>
                          <p className="text-xs text-indigo-500 truncate">"{suggestedEntry?.title}"</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <motion.button
                            onClick={onSaveSuggestedEntry}
                            className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors shadow-sm"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                          >
                            Guardar
                          </motion.button>
                          <button
                            onClick={onDiscardSuggestedEntry}
                            className="text-xs text-indigo-400 hover:text-indigo-600 flex-shrink-0 p-1"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </motion.div>
              )
            })}

              <div ref={messagesEndRef} className="h-8" />
          </div>
        )}
      </div>

      {/* Input bar */}
      <ChatInput
        onSend={onSendMessage}
        disabled={isTyping || isStreaming}
        onFileSelect={onFileUpload}
        isUploading={isFileUploading}
      />

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

      {/* Logs Panel - floats in from the right edge of container */}
      <AnimatePresence>
      {logsOpen && (
      <motion.div
        className="absolute right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col"
        initial={{ x: 320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 320, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-500" />
            <span className="font-semibold text-sm text-gray-900">Actividad del asistente</span>
          </div>
          <button onClick={() => setLogsOpen(false)} className="p-1 hover:bg-gray-100 rounded-md transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {(!logGroups || logGroups.length === 0) ? (
            <p className="text-sm text-gray-400 text-center mt-8 px-4">
              Los logs de actividad aparecerán aquí durante la conversación.
            </p>
          ) : (
            logGroups.map((group) => <LogGroupView key={group.id} group={group} />)
          )}
        </div>

        {logGroups && logGroups.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={onClearLogs}
              className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors w-full text-center"
            >
              Limpiar logs
            </button>
          </div>
        )}
      </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}

export default ChatArea
