'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/dashboard/Sidebar'
import ReactMarkdown from 'react-markdown'
import {
  Search,
  Plus,
  MoreHorizontal,
  BookOpen,
  Pencil,
  Trash2,
  X,
  Menu,
  ArrowUpDown,
  Calendar,
  ChevronRight,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'

interface Entry {
  id: string
  title: string
  content: string
  created_by: string
  created_at: string
  profiles?: { email: string; full_name: string | null } | null
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── New Entry Modal ─────────────────────────────────────────────────────────
function NewEntryModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Por favor, completa el título y el contenido.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { error: supaErr } = await supabase.from('entries').insert({
        title: title.trim(),
        content: content.trim(),
        workspace_id: DEFAULT_WORKSPACE_ID,
        created_by: user?.id,
        is_published: true,
      })
      if (supaErr) throw supaErr
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar la entrada.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-950">Nueva entrada</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Título</label>
            <input
              type="text"
              placeholder="Ej. Política de vacaciones"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-950 placeholder-gray-400 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all border-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Contenido (Markdown soportado)</label>
            <textarea
              placeholder="Escribe el conocimiento que quieres guardar..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-950 placeholder-gray-400 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all resize-none border-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Entry Detail Drawer ──────────────────────────────────────────────────────
function EntryDetailDrawer({
  entry,
  currentUserId,
  onClose,
  onUpdate,
}: {
  entry: Entry
  currentUserId: string | null
  onClose: () => void
  onUpdate: (updated: Entry) => void
}) {
  const supabase = createClient()
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(entry.title)
  const [content, setContent] = useState(entry.content)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(entry.title)
    setContent(entry.content)
    setIsEditing(false)
  }, [entry])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('entries')
        .update({ title, content })
        .eq('id', entry.id)
      
      if (error) throw error
      onUpdate({ ...entry, title, content })
      setIsEditing(false)
      toast.success('Entrada actualizada')
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  const authorName = entry.created_by === currentUserId ? 'Tú' : (entry.profiles?.email?.split('@')[0] ?? 'Usuario')

  return (
    <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">
        <header className="flex items-center justify-between px-6 h-16 border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-400">
            <BookOpen size={16} />
            <span className="text-xs font-medium uppercase tracking-widest">Detalle de entrada</span>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors flex items-center gap-2 text-sm"
              >
                <Pencil size={16} />
                Editar
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-10">
          {isEditing ? (
            <div className="space-y-6">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-2xl font-bold text-gray-950 focus:outline-none placeholder-gray-300 bg-transparent border-none"
                placeholder="Título"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full text-base text-gray-700 leading-relaxed focus:outline-none min-h-[400px] bg-transparent resize-none border-none"
                placeholder="Contenido..."
              />
            </div>
          ) : (
            <article className="prose prose-indigo max-w-none">
              <h1 className="text-3xl font-bold text-gray-950 mb-6">{entry.title}</h1>
              <div className="text-gray-700 leading-relaxed">
                <ReactMarkdown>{entry.content}</ReactMarkdown>
              </div>
            </article>
          )}
        </main>

        <footer className="border-t border-gray-100 p-6 flex items-center justify-between bg-gray-50/50">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-gray-400">Guardado por <span className="text-gray-900 font-medium">{authorName}</span></p>
            <p className="text-xs text-gray-400">{formatDate(entry.created_at)}</p>
          </div>
          {isEditing && (
            <div className="flex gap-2">
              <button
                disabled={saving}
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={saving}
                onClick={handleSave}
                className="px-6 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100 flex items-center gap-2"
              >
                {saving ? 'Guardando...' : (
                  <>
                    <Save size={16} />
                    Guardar cambios
                  </>
                )}
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  )
}

// ─── Entry Row ────────────────────────────────────────────────────────────────
function EntryRow({
  entry,
  currentUserId,
  onOpenDetail,
  onDelete,
}: {
  entry: Entry
  currentUserId: string | null
  onOpenDetail: (entry: Entry) => void
  onDelete: (entry: Entry) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const preview = entry.content.slice(0, 100) + (entry.content.length > 100 ? '…' : '')
  const authorName = entry.created_by === currentUserId ? 'Tú' : (entry.profiles?.email?.split('@')[0] ?? 'Usuario')

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div 
      onClick={() => onOpenDetail(entry)}
      className="group flex items-start gap-4 px-6 py-5 hover:bg-white hover:shadow-md transition-all cursor-pointer border-b border-gray-100 last:border-0"
    >
      <div className="mt-0.5 flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:border-indigo-600 transition-colors">
        <BookOpen size={16} className="text-indigo-500 group-hover:text-white transition-colors" />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-gray-950 truncate mb-1">{entry.title}</h3>
        <p className="text-sm text-gray-500 line-clamp-1 mb-2 font-medium">{preview}</p>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md font-medium">{authorName}</span>
          <span className="flex items-center gap-1.5"><Calendar size={12} /> {formatDate(entry.created_at)}</span>
        </div>
      </div>

      <div className="relative flex-shrink-0" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((p) => !p)
          }}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-opacity md:opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal size={18} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-10 z-20 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 w-40 animate-in fade-in zoom-in-95 duration-100">
            <button
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onOpenDetail(entry) }}
            >
              <Pencil size={14} className="text-gray-400" /> Ver detalle
            </button>
            <button
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(entry) }}
            >
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Library Page ─────────────────────────────────────────────────────────────
export default function LibraryPage() {
  const supabase = createClient()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'az'>('newest')
  const [sortOpen, setSortOpen] = useState(false)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('Usuario')
  const [userEmail, setUserEmail] = useState('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 350)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchEntries = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
      setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario')
      setUserEmail(user.email ?? '')
    }

    const { data, error } = await supabase
      .from('entries')
      .select('id, title, content, created_by, created_at, profiles(email, full_name)')
      .eq('workspace_id', DEFAULT_WORKSPACE_ID)
      .is('deleted_at', null)

    if (!error && data) {
      setEntries(data as unknown as Entry[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const { error } = await supabase.from('entries').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setEntries(prev => prev.filter(e => e.id !== deleteTarget.id))
      toast.success('Entrada eliminada')
    } catch (err: any) {
      toast.error('No se pudo eliminar la entrada')
    } finally {
      setDeleteTarget(null)
    }
  }

  const filteredAndSorted = useMemo(() => {
    let result = entries.filter(e => 
      e.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      e.content.toLowerCase().includes(debouncedQuery.toLowerCase())
    )

    if (sortBy === 'newest') result.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    else if (sortBy === 'oldest') result.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    else if (sortBy === 'az') result.sort((a,b) => a.title.localeCompare(b.title))
    
    return result
  }, [entries, debouncedQuery, sortBy])

  return (
    <div className="h-screen flex overflow-hidden bg-[#F1F3F6]">
      <aside className={`fixed md:relative inset-y-0 left-0 z-50 w-64 h-full bg-white border-r border-gray-200 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <Sidebar 
          conversations={[]} 
          activeConversationId={null} 
          onSelectConversation={() => {}} 
          onNewConversation={() => {}} 
          userName={userName} 
          userEmail={userEmail} 
          onClose={() => setSidebarOpen(false)} 
        />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="flex-shrink-0 h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <button className="md:hidden p-2 text-gray-400" onClick={() => setSidebarOpen(true)}><Menu size={20}/></button>
            <div className="relative max-w-md w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar en conocimiento..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              />
            </div>
          </div>
          <button 
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-shadow shadow-md shadow-indigo-100"
          >
            <Plus size={18} /> Nueva entrada
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-950 mb-1">Base de conocimiento</h1>
                <p className="text-sm text-gray-500 font-medium">{entries.length} entradas guardadas</p>
              </div>

              <div className="relative">
                <button 
                  onClick={() => setSortOpen(!sortOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:border-indigo-400 transition-colors"
                >
                  <ArrowUpDown size={14}/>
                  {sortBy === 'newest' ? 'Más recientes' : sortBy === 'oldest' ? 'Más antiguas' : 'Nombre A-Z'}
                </button>
                {sortOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-10 w-40 p-1">
                    {[
                      { l: 'Más recientes', v: 'newest' },
                      { l: 'Más antiguas', v: 'oldest' },
                      { l: 'Nombre A-Z', v: 'az' }
                    ].map(opt => (
                      <button 
                        key={opt.v}
                        onClick={() => { setSortBy(opt.v as any); setSortOpen(false) }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium ${sortBy === opt.v ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50 text-gray-600'}`}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className="grid gap-3">
                {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white/50 animate-pulse rounded-2xl border border-gray-100" />)}
              </div>
            ) : filteredAndSorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-gray-200 flex items-center justify-center mb-6 text-indigo-600">
                  <BookOpen size={40} strokeWidth={1.5} />
                </div>
                {searchQuery ? (
                  <>
                    <p className="text-lg font-bold text-gray-950 mb-1">No se encontraron resultados</p>
                    <p className="text-sm text-gray-500">No hay entradas que coincidan con "<span className="font-semibold">{searchQuery}</span>"</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold text-gray-950 mb-1">Tu base de conocimiento está vacía</p>
                    <p className="text-sm text-gray-500 mb-8 max-w-xs">Empieza una conversación con Nukor y guarda lo que aprendas.</p>
                    <Link href="/dashboard" className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-100 hover:bg-indigo-700">Ir al chat</Link>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {filteredAndSorted.map(entry => (
                  <EntryRow 
                    key={entry.id} 
                    entry={entry} 
                    currentUserId={currentUserId}
                    onOpenDetail={setSelectedEntry}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {showNewModal && <NewEntryModal onClose={() => setShowNewModal(false)} onSaved={fetchEntries} />}
      
      {selectedEntry && (
        <EntryDetailDrawer 
          entry={selectedEntry} 
          currentUserId={currentUserId}
          onClose={() => setSelectedEntry(null)} 
          onUpdate={(u) => { setEntries(prev => prev.map(e => e.id === u.id ? u : e)); setSelectedEntry(u) }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-gray-950 mb-2">¿Eliminar esta entrada?</h2>
            <p className="text-sm text-gray-500 mb-6 font-medium">Esta acción no se puede deshacer y el conocimiento se perderá permanentemente.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={handleDelete} className="px-6 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-lg shadow-red-100">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
