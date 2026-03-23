import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { IConversation } from '@/types/chat'
import SignOutButton from '@/components/auth/SignOutButton'
import { Plus, BookOpen, MessageSquare, Settings, ChevronDown, X, Check } from 'lucide-react'

interface SidebarProps {
  activeConversationId: string | null
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
  userName: string
  userEmail: string
  workspaceName: string
  onClose: () => void
  onDeleteConversation?: (id: string) => void
}

const Sidebar = ({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  userName,
  userEmail,
  workspaceName,
  onClose,
  onDeleteConversation,
}: SidebarProps) => {
  const initials = userName.slice(0, 2).toUpperCase()
  const pathname = usePathname()
  const router = useRouter()

  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const workspaceRef = useRef<HTMLDivElement>(null)

  const [conversations, setConversations] = useState<IConversation[]>([])

  const refreshConversations = async () => {
    try {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    }
  }

  useEffect(() => {
    refreshConversations()
  }, [pathname])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (workspaceRef.current && !workspaceRef.current.contains(event.target as Node)) {
        setWorkspaceOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogoClick = () => {
    if (pathname === '/dashboard') {
      router.refresh()
    } else {
      router.push('/dashboard')
    }
  }

  const handleNewConversationClick = () => {
    if (pathname !== '/dashboard') {
      router.push('/dashboard')
    } else {
      onNewConversation()
    }
    onClose()
  }

  const handleSelectConversationClick = (id: string) => {
    if (pathname !== '/dashboard') {
      router.push(`/dashboard?id=${id}`)
    } else {
      onSelectConversation(id)
    }
    onClose()
  }

  const isChatActive = pathname === '/dashboard'
  const isLibraryActive = pathname.startsWith('/dashboard/library')
  const isSettingsActive = pathname.startsWith('/dashboard/settings')

  return (
    <div className="flex flex-col h-full bg-white text-gray-950">
      {/* Header */}
      <div className="flex flex-col gap-4 p-5 flex-shrink-0 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <button
            onClick={handleLogoClick}
            className="flex items-center gap-2 font-heading font-bold text-base tracking-tight text-gray-950 border-none bg-transparent p-0"
          >
            <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-black bg-indigo-600 text-white">
              N
            </span>
            Nukor
          </button>
          <button
            className="md:hidden p-1.5 rounded-md hover:bg-slate-50 transition-colors text-gray-500"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Workspace selector */}
        <div className="relative" ref={workspaceRef}>
          <button
            onClick={() => setWorkspaceOpen(!workspaceOpen)}
            className="flex items-center justify-between w-full rounded-lg px-3 py-2 bg-white border border-gray-200 shadow-sm hover:border-gray-300 transition-colors"
          >
            <span className="text-sm font-medium text-gray-950">{workspaceName}</span>
            <ChevronDown size={16} className={`text-gray-500 transition-transform ${workspaceOpen ? 'rotate-180' : ''}`} />
          </button>

          {workspaceOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600">
                <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">N</div>
                <span className="text-sm font-medium">{workspaceName}</span>
                <Check className="w-4 h-4 ml-auto" />
              </div>

              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={() => { setWorkspaceOpen(false); setShowCreateModal(true) }}
                  className="flex items-center gap-2 px-3 py-2 w-full text-left text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Crear workspace
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New conversation */}
      <div className="p-4 pl-5 pr-5 flex-shrink-0">
        <motion.button
          onClick={handleNewConversationClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus size={16} />
          Nueva conversación
        </motion.button>
      </div>

      {/* Nav — PRINCIPAL */}
      <nav className="px-3 pb-2 flex-shrink-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-1.5">Principal</p>
        <Link
          href="/dashboard"
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border border-transparent ${
            isChatActive
              ? 'bg-indigo-50 text-indigo-600'
              : 'text-gray-500 hover:bg-slate-50 hover:text-gray-900'
          }`}
          onClick={onClose}
        >
          <MessageSquare size={18} className={isChatActive ? 'text-indigo-600' : 'text-gray-400'} />
          Chat
        </Link>
        <Link
          href="/dashboard/library"
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border border-transparent ${
            isLibraryActive
              ? 'bg-indigo-50 text-indigo-600'
              : 'text-gray-500 hover:bg-slate-50 hover:text-gray-900'
          }`}
          onClick={onClose}
        >
          <BookOpen size={18} className={isLibraryActive ? 'text-indigo-600' : 'text-gray-400'} />
          Base de conocimiento
        </Link>
      </nav>

      {/* Nav — GESTIÓN */}
      <nav className="px-3 pb-3 flex-shrink-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-1.5 mt-2">Gestión</p>
        <Link
          href="/dashboard/settings"
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border border-transparent ${
            isSettingsActive
              ? 'bg-indigo-50 text-indigo-600'
              : 'text-gray-500 hover:bg-slate-50 hover:text-gray-900'
          }`}
          onClick={onClose}
        >
          <Settings size={18} className={isSettingsActive ? 'text-indigo-600' : 'text-gray-400'} />
          Configuración
        </Link>
      </nav>

      {/* HISTORIAL section label */}
      <div className="px-6 flex-shrink-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Historial</p>
      </div>

      {/* Conversations grouped by date */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {conversations.length === 0 ? (
          <p className="text-xs px-2 py-2 leading-relaxed text-gray-400">
            Tus conversaciones aparecerán aquí
          </p>
        ) : (
          (() => {
            const today = new Date()
            const yesterday = new Date(today)
            yesterday.setDate(yesterday.getDate() - 1)
            const lastWeek = new Date(today)
            lastWeek.setDate(lastWeek.getDate() - 7)

            const grouped = {
              'Hoy': conversations.filter(c => new Date(c.updated_at || c.created_at).toDateString() === today.toDateString()),
              'Ayer': conversations.filter(c => new Date(c.updated_at || c.created_at).toDateString() === yesterday.toDateString()),
              'Esta semana': conversations.filter(c => {
                const d = new Date(c.updated_at || c.created_at)
                return d > lastWeek && d.toDateString() !== today.toDateString() && d.toDateString() !== yesterday.toDateString()
              }),
              'Anteriores': conversations.filter(c => new Date(c.updated_at || c.created_at) <= lastWeek)
            }

            return Object.entries(grouped).map(([label, convs]) => (
              convs.length > 0 && (
                <div key={label} className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-1">{label}</p>
                  {convs.map((conv) => {
                    const isActive = conv.id === activeConversationId
                    return (
                      <motion.div
                        key={conv.id}
                        className="group relative"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <button
                          onClick={() => handleSelectConversationClick(conv.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all truncate pr-8 ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-600 font-semibold'
                              : 'text-gray-600 hover:bg-slate-50 hover:text-gray-900 font-medium'
                          }`}
                        >
                          {conv.title || 'Nueva conversación'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteConversation?.(conv.id)
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-red-50"
                        >
                          <X size={12} />
                        </button>
                      </motion.div>
                    )
                  })}
                </div>
              )
            ))
          })()
        )}
      </div>

      {/* User footer */}
      <div className="flex-shrink-0 p-5 border-t border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
            {initials}
          </div>
          <div className="flex-1 min-w-0 flex flex-col items-start">
            <p className="text-sm font-semibold truncate text-gray-950 tracking-tight">{userName}</p>
            <p className="text-xs truncate text-gray-500 mb-1">{userEmail}</p>
            <SignOutButton className="text-xs text-gray-500 hover:text-gray-900 transition-colors text-left font-medium underline underline-offset-2 decoration-gray-300 hover:decoration-gray-900" />
          </div>
        </div>
      </div>

      {/* Create workspace modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200 border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-950 mb-1 tracking-tight">Crear nuevo workspace</h3>
            <p className="text-xs text-gray-500 mb-6">Nukor te ayuda a organizar tu conocimiento.</p>
            <input
              type="text"
              placeholder="Nombre del workspace"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 mb-6 transition-all bg-slate-50 hover:bg-white"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowCreateModal(false); setNewWorkspaceName('') }}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!newWorkspaceName.trim()) return
                  setShowCreateModal(false)
                  setNewWorkspaceName('')
                }}
                className="px-6 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all active:scale-[0.98]"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Sidebar
