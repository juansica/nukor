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
  Grid,
  Layers,
  ChevronLeft,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'

const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'

interface Area {
  id: string
  name: string
  description: string | null
  color: string | null
  collections?: { id: string }[]
  entries?: { id: string }[]
}

interface Collection {
  id: string
  area_id: string
  name: string
  description: string | null
  entries?: { id: string }[]
  updated_at: string
}

interface Entry {
  id: string
  title: string
  content: string
  created_by: string
  created_at: string
  area_id: string | null
  collection_id: string | null
  profiles?: { email: string; full_name: string | null } | null
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Modals ──────────────────────────────────────────────────────────────────

function NewAreaModal({ onClose, onSaved, userId }: { onClose: () => void, onSaved: () => void, userId: string }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [saving, setSaving] = useState(false)
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6']

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, color, created_by: userId })
      })
      if (!res.ok) throw new Error('Error al crear área')
      onSaved()
      onClose()
      toast.success('Área creada')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-base font-semibold text-gray-950">Nueva área</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="Ej. Operaciones, Ventas..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Color</label>
            <div className="flex gap-2">
              {colors.map(c => (
                <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-gray-950 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm">{saving ? 'Guardando...' : 'Crear área'}</button>
        </div>
      </div>
    </div>
  )
}

function NewCollectionModal({ onClose, onSaved, userId, areaId }: { onClose: () => void, onSaved: () => void, userId: string, areaId: string }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, area_id: areaId, created_by: userId })
      })
      if (!res.ok) throw new Error('Error al crear colección')
      onSaved()
      onClose()
      toast.success('Colección creada')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-base font-semibold text-gray-950">Nueva colección</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="Ej. Procesos, Equipos..." />
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm">{saving ? 'Guardando...' : 'Crear colección'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Entry Detail Drawer ──────────────────────────────────────────────────────
function EntryDetailDrawer({ entry, currentUserId, onClose, onUpdate }: { entry: Entry, currentUserId: string | null, onClose: () => void, onUpdate: (updated: Entry) => void }) {
  const supabase = createClient()
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(entry.title)
  const [content, setContent] = useState(entry.content)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('entries').update({ title, content }).eq('id', entry.id)
      if (error) throw error
      onUpdate({ ...entry, title, content })
      setIsEditing(false)
      toast.success('Entrada actualizada')
    } catch (err: any) { toast.error(err.message) } finally { setSaving(false) }
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
          <div className="flex gap-2">
            {!isEditing && <button onClick={() => setIsEditing(true)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 flex items-center gap-2 text-sm"><Pencil size={16} /> Editar</button>}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={20} /></button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-8 py-10">
          {isEditing ? (
            <div className="space-y-6">
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full text-2xl font-bold focus:outline-none border-none bg-transparent" placeholder="Título" />
              <textarea value={content} onChange={e => setContent(e.target.value)} className="w-full text-base text-gray-700 min-h-[400px] focus:outline-none bg-transparent resize-none border-none" placeholder="Contenido..." />
            </div>
          ) : (
            <article className="prose prose-indigo max-w-none">
              <h1 className="text-3xl font-bold text-gray-950 mb-6">{entry.title}</h1>
              <div className="text-gray-700 leading-relaxed"><ReactMarkdown>{entry.content}</ReactMarkdown></div>
            </article>
          )}
        </main>
        {isEditing && (
          <footer className="border-t border-gray-100 p-6 flex justify-end gap-3 bg-gray-50/50">
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-200 rounded-lg">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg shadow-md flex items-center gap-2">
              <Save size={16} /> {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}

import { Suspense } from 'react'

// ─── Main Component ──────────────────────────────────────────────────────────
function LibraryClient() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const areaId = searchParams.get('area')
  const collectionId = searchParams.get('collection')

  const [loading, setLoading] = useState(true)
  const [areas, setAreas] = useState<Area[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('Usuario')
  const [userEmail, setUserEmail] = useState('')

  // Modals state
  const [showAreaModal, setShowAreaModal] = useState(false)
  const [showCollModal, setShowCollModal] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 350)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
      setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario')
      setUserEmail(user.email ?? '')
    }

    // Fetch Areas
    const aRes = await fetch('/api/areas')
    const aData = await aRes.json()
    setAreas(aData || [])

    if (areaId) {
      const cRes = await fetch(`/api/collections?areaId=${areaId}`)
      const cData = await cRes.json()
      setCollections(cData || [])
    }

    const { data: eData } = await supabase
      .from('entries')
      .select('*, profiles(email, full_name)')
      .eq('workspace_id', DEFAULT_WORKSPACE_ID)
      .is('deleted_at', null)

    setEntries(eData as any || [])
    setLoading(false)
  }, [areaId, collectionId, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const currentArea = useMemo(() => areas.find(a => a.id === areaId), [areas, areaId])
  const currentCollection = useMemo(() => collections.find(c => c.id === collectionId), [collections, collectionId])

  const filteredEntries = useMemo(() => {
    let result = entries
    if (collectionId) result = result.filter(e => e.collection_id === collectionId)
    else if (areaId) result = result.filter(e => e.area_id === areaId)

    if (debouncedQuery) {
      result = result.filter(e => e.title.toLowerCase().includes(debouncedQuery.toLowerCase()) || e.content.toLowerCase().includes(debouncedQuery.toLowerCase()))
    }
    return result
  }, [entries, areaId, collectionId, debouncedQuery])

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.from('entries').delete().eq('id', deleteTarget.id)
    if (!error) {
      setEntries(prev => prev.filter(e => e.id !== deleteTarget.id))
      toast.success('Entrada eliminada')
    } else {
      toast.error('Error al eliminar')
    }
    setDeleteTarget(null)
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#F1F3F6]">
      <aside className={`fixed md:relative inset-y-0 left-0 z-50 w-64 h-full bg-white border-r border-gray-200 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <Sidebar conversations={[]} activeConversationId={null} onSelectConversation={() => {}} onNewConversation={() => {}} userName={userName} userEmail={userEmail} onClose={() => setSidebarOpen(false)} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="flex-shrink-0 h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <button className="md:hidden p-2 text-gray-400" onClick={() => setSidebarOpen(true)}><Menu size={20}/></button>
            <div className="relative max-w-md w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Buscar en biblioteca..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium" />
            </div>
          </div>
          <div className="flex gap-3">
            {!areaId && <button onClick={() => setShowAreaModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-sm"><Plus size={18} /> Nueva área</button>}
            {areaId && !collectionId && <button onClick={() => setShowCollModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-sm"><Plus size={18} /> Nueva colección</button>}
            {collectionId && <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-sm"><Plus size={18} /> Nueva entrada</Link>}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6 bg-white self-start px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm overflow-hidden truncate">
              <Link href="/dashboard/library" className="hover:text-indigo-600 font-medium">Base de conocimiento</Link>
              {areaId && (
                <>
                  <ChevronRight size={14} className="flex-shrink-0" />
                  <Link href={`/dashboard/library?area=${areaId}`} className={`hover:text-indigo-600 font-medium truncate ${!collectionId ? 'text-indigo-600' : ''}`}>{currentArea?.name || 'Área'}</Link>
                </>
              )}
              {collectionId && (
                <>
                  <ChevronRight size={14} className="flex-shrink-0" />
                  <span className="text-indigo-600 font-semibold truncate">{currentCollection?.name || 'Colección'}</span>
                </>
              )}
            </nav>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1,2,3].map(i => <div key={i} className="h-48 bg-white/50 animate-pulse rounded-2xl border border-gray-100" />)}
              </div>
            ) : !areaId && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {areas.map(area => (
                  <Link key={area.id} href={`/dashboard/library?area=${area.id}`} className="group bg-white p-6 rounded-2xl border-l-[6px] border border-gray-200 hover:shadow-xl transition-all relative overflow-hidden" style={{ borderLeftColor: area.color || '#e2e8f0' }}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 rounded-xl bg-gray-50 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors"><Layers size={24} /></div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">Workspace</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-950 mb-2">{area.name}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-6 font-medium">{area.description || 'Sin descripción'}</p>
                    <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
                      <span className="flex items-center gap-1"><Grid size={14}/> {area.collections?.length || 0} colecciones</span>
                      <span className="flex items-center gap-1"><BookOpen size={14}/> {area.entries?.length || 0} entradas</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {areaId && !collectionId && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {collections.length === 0 ? (
                  <div className="col-span-full py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300 mb-4"><Layers size={32} /></div>
                    <p className="text-lg font-bold text-gray-900 mb-1">Esta área no tiene colecciones aún</p>
                    <p className="text-sm text-gray-500 mb-6">Crea una para empezar a organizar tu conocimiento.</p>
                    <button onClick={() => setShowCollModal(true)} className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">Nueva colección</button>
                  </div>
                ) : collections.map(coll => (
                  <Link key={coll.id} href={`/dashboard/library?area=${areaId}&collection=${coll.id}`} className="group bg-white p-6 rounded-2xl border border-gray-200 hover:border-indigo-200 hover:shadow-lg transition-all">
                    <div className="p-2 w-fit rounded-lg bg-gray-50 text-gray-400 mb-4 font-bold group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors"><Grid size={20} /></div>
                    <h3 className="text-base font-bold text-gray-950 mb-1">{coll.name}</h3>
                    <div className="flex items-center justify-between mt-6 text-[11px] font-bold text-gray-400">
                       <span className="bg-gray-50 px-2 py-0.5 rounded-md">{coll.entries?.length || 0} entradas</span>
                       <span>Actualizado {formatDate(coll.updated_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {(collectionId || debouncedQuery) && (
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
                {filteredEntries.length === 0 ? (
                  <div className="p-20 text-center flex flex-col items-center">
                    <Search size={40} className="text-gray-200 mb-4" />
                    <p className="text-gray-950 font-bold">No se encontraron entradas</p>
                    <p className="text-gray-500 text-sm font-medium">Intenta con otros términos o crea una nueva.</p>
                  </div>
                ) : filteredEntries.map(entry => (
                  <div key={entry.id} onClick={() => setSelectedEntry(entry)} className="group flex items-start gap-4 px-6 py-5 hover:bg-gray-50 transition-all cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><BookOpen size={18} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-gray-950 truncate">{entry.title}</h3>
                        {!collectionId && (
                           <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                             {areas.find(a => a.id === entry.area_id)?.name || 'Sin área'}
                           </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-1 mb-2 font-medium">{entry.content.slice(0, 100)}...</p>
                      <div className="flex items-center gap-3 text-[11px] font-bold text-gray-400">
                        <span className="text-indigo-600">{entry.profiles?.email?.split('@')[0] || 'Tú'}</span>
                        <span>{formatDate(entry.created_at)}</span>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(entry) }} className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-600 md:opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {showAreaModal && <NewAreaModal onClose={() => setShowAreaModal(false)} onSaved={fetchData} userId={currentUserId || ''} />}
      {showCollModal && <NewCollectionModal onClose={() => setShowCollModal(false)} onSaved={fetchData} userId={currentUserId || ''} areaId={areaId || ''} />}
      {selectedEntry && <EntryDetailDrawer entry={selectedEntry} currentUserId={currentUserId} onClose={() => setSelectedEntry(null)} onUpdate={e => setEntries(prev => prev.map(x => x.id === e.id ? e : x))} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold mb-2">¿Eliminar esta entrada?</h2>
            <p className="text-sm text-gray-500 mb-6 font-medium">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={handleDelete} className="px-6 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LibraryPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-[#F1F3F6]">
        <div className="animate-pulse text-gray-400 font-medium">Cargando biblioteca...</div>
      </div>
    }>
      <LibraryClient />
    </Suspense>
  )
}
