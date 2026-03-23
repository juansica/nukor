'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
  ChevronRight,
  Grid,
  Layers,
  Inbox,
  FolderOpen,
  FolderInput,
  ArrowLeft,
  RotateCcw
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
        body: JSON.stringify({ name, color, created_by: userId })
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
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, area_id: areaId, created_by: userId })
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

import { Suspense } from 'react'
import { motion } from 'framer-motion'

const cardVariants = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1 }
}
const containerVariants = {
  animate: { transition: { staggerChildren: 0.07 } }
}

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
  const [workspaceName, setWorkspaceName] = useState('Mi workspace')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Modals / dropdowns
  const [showAreaModal, setShowAreaModal] = useState(false)
  const [showCollModal, setShowCollModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [moveDropdownId, setMoveDropdownId] = useState<string | null>(null)

  // Inline document editing state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 350)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    const handleClick = () => { setOpenDropdownId(null); setMoveDropdownId(null) }
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      let wsId = DEFAULT_WORKSPACE_ID
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario')
        setUserEmail(user.email ?? '')
        const { data: profile } = await supabase.from('profiles').select('last_workspace_id').eq('id', user.id).maybeSingle()
        if (profile?.last_workspace_id) {
          wsId = profile.last_workspace_id
          setWorkspaceId(wsId)
          const { data: ws } = await supabase.from('workspaces').select('name').eq('id', wsId).maybeSingle()
          if (ws?.name) setWorkspaceName(ws.name)
        }
      }

      const aRes = await fetch('/api/areas')
      if (aRes.ok) {
        const aData = await aRes.json()
        setAreas(Array.isArray(aData.areas) ? aData.areas : [])
      }

      // Always fetch all collections so area card counts are accurate
      const cRes = await fetch('/api/collections')
      if (cRes.ok) {
        const cData = await cRes.json()
        setCollections(Array.isArray(cData.collections) ? cData.collections : [])
      }

      const { data: eData, error: eError } = await supabase
        .from('entries')
        .select('*')
        .eq('workspace_id', wsId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (eError) console.error('[Library] Entries error:', eError)
      setEntries(Array.isArray(eData) ? eData as any : [])
    } catch (err: any) {
      console.error('[Library] Error in fetchData:', err)
      toast.error('Error al cargar datos. Por favor, recarga la página.')
    } finally {
      setLoading(false)
    }
  }, [areaId, collectionId, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const currentArea = useMemo(() => {
    if (areaId === 'unclassified') return { id: 'unclassified', name: 'Sin clasificar', description: null, color: '#9ca3af' } as Area
    return areas.find(a => a.id === areaId)
  }, [areas, areaId])

  const currentCollection = useMemo(() => collections.find(c => c.id === collectionId), [collections, collectionId])

  const filteredEntries = useMemo(() => {
    let result = entries
    if (collectionId) result = result.filter(e => e.collection_id === collectionId)
    else if (areaId === 'unclassified') result = result.filter(e => !e.area_id)
    else if (areaId) result = result.filter(e => e.area_id === areaId)

    if (debouncedQuery) {
      result = result.filter(e => e.title.toLowerCase().includes(debouncedQuery.toLowerCase()) || e.content.toLowerCase().includes(debouncedQuery.toLowerCase()))
    }
    return result
  }, [entries, areaId, collectionId, debouncedQuery])

  const handleFileUpload = async (file: File) => {
    if (!workspaceId) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('workspace_id', workspaceId)
      if (areaId && areaId !== 'unclassified') formData.append('area_id', areaId)
      if (collectionId) formData.append('collection_id', collectionId)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Error al subir el archivo')
      } else {
        toast.success(`"${file.name}" subido correctamente`)
        fetchData()
      }
    } catch {
      toast.error('Error al subir el archivo')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  // Used for the non-collection list view delete
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

  const handleAssignArea = async (entryId: string, newAreaId: string) => {
    setOpenDropdownId(null)
    const { error } = await supabase.from('entries').update({ area_id: newAreaId, collection_id: null }).eq('id', entryId)
    if (!error) {
      toast.success('Área asignada')
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, area_id: newAreaId, collection_id: null } : e))
    } else {
      toast.error('Error al asignar')
    }
  }

  // Inline document view handlers
  const handleEditEntry = (entry: Entry) => {
    setEditingEntryId(entry.id)
    setEditTitle(entry.title)
    setEditContent(entry.content)
  }

  const handleSaveEdit = async (entryId: string) => {
    const { error } = await supabase
      .from('entries')
      .update({ title: editTitle, content: editContent, updated_at: new Date().toISOString() })
      .eq('id', entryId)
    if (error) { toast.error('Error al guardar'); return }
    setEditingEntryId(null)
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, title: editTitle, content: editContent } : e))
    toast.success('Sección actualizada')
  }

  const confirmDelete = async (entryId: string) => {
    const { error } = await supabase.from('entries').delete().eq('id', entryId)
    if (!error) {
      setEntries(prev => prev.filter(e => e.id !== entryId))
      toast.success('Sección eliminada')
    } else {
      toast.error('Error al eliminar')
    }
    setConfirmDeleteId(null)
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#F1F3F6]">
      <aside className={`fixed md:relative inset-y-0 left-0 z-50 w-64 h-full bg-white border-r border-gray-200 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <Sidebar activeConversationId={null} onSelectConversation={() => {}} onNewConversation={() => {}} userName={userName} userEmail={userEmail} workspaceName={workspaceName} onClose={() => setSidebarOpen(false)} />
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
            <button
              onClick={fetchData}
              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              title="Refrescar datos"
            >
              <RotateCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            {!areaId && <button onClick={() => setShowAreaModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-sm"><Plus size={18} /> Nueva área</button>}
            {areaId && !collectionId && <button onClick={() => setShowCollModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-sm"><Plus size={18} /> Nueva colección</button>}
            {collectionId && <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-sm"><Plus size={18} /> Nueva entrada</Link>}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-3 mb-6">
              {areaId && (
                <button
                  onClick={() => collectionId
                    ? router.push(`/dashboard/library?area=${areaId}`)
                    : router.push('/dashboard/library')
                  }
                  className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors shadow-sm"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <nav className="flex items-center gap-2 text-sm text-gray-500 bg-white self-start px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm overflow-hidden truncate">
                <Link href="/dashboard/library" className={`hover:text-indigo-600 font-medium ${!areaId ? 'text-indigo-600' : ''}`}>Base de conocimiento</Link>
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
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1,2,3].map(i => <div key={i} className="h-48 bg-white/50 animate-pulse rounded-2xl border border-gray-100" />)}
              </div>
            ) : !areaId && (
              <>
                <div className="mb-6 px-1">
                  <p className="text-sm font-medium text-gray-500">
                    Las áreas representan los departamentos de tu empresa.<br />
                    Dentro de cada área puedes crear colecciones para organizar el conocimiento por temas.
                  </p>
                </div>
                <motion.div
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  variants={containerVariants}
                  initial="initial"
                  animate="animate"
                >
                {areas.map(area => (
                  <motion.div key={area.id} variants={cardVariants}>
                    <Link href={`/dashboard/library?area=${area.id}`} className="group bg-white p-6 rounded-2xl border-l-[6px] border border-gray-200 hover:shadow-xl transition-all relative overflow-hidden block" style={{ borderLeftColor: area.color || '#e2e8f0' }}>
                      <div className="flex items-start mb-4">
                        <div className="p-2 rounded-xl bg-gray-50 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors"><Layers size={24} /></div>
                      </div>
                      <h3 className="text-lg font-bold text-gray-950 mb-2">{area.name}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-6 font-medium">{area.description || 'Sin descripción'}</p>
                      <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
                        <span className="flex items-center gap-1"><Grid size={14}/> {collections.filter(c => c.area_id === area.id).length} colecciones</span>
                        <span className="flex items-center gap-1"><BookOpen size={14}/> {entries.filter(e => e.area_id === area.id).length} entradas</span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
                <Link href={`/dashboard/library?area=unclassified`} className="group bg-white p-6 rounded-2xl border-l-[6px] border border-gray-200 hover:shadow-xl transition-all relative overflow-hidden" style={{ borderLeftColor: '#9ca3af' }}>
                  <div className="flex items-start mb-4">
                    <div className="p-2 rounded-xl bg-gray-50 text-gray-400 group-hover:bg-gray-100 transition-colors"><Inbox size={24} /></div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-950 mb-2">Sin clasificar</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-6 font-medium">Entradas sin un área asignada.</p>
                  <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
                    <span className="flex items-center gap-1"><BookOpen size={14}/> {entries.filter(e => !e.area_id).length} entradas</span>
                  </div>
                </Link>
              </motion.div>
              </>
            )}

            {areaId && !collectionId && areaId !== 'unclassified' && (
              <>
                <div className="mb-6 px-1">
                  <p className="text-sm font-medium text-gray-500">
                    Las colecciones agrupan entradas relacionadas dentro de un área.<br />
                    Crea colecciones para organizar el conocimiento por proceso, proyecto o tema.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {collections.length === 0 ? (
                    <div className="col-span-full py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 mb-4"><FolderOpen size={32} /></div>
                      <p className="text-lg font-bold text-gray-900 mb-1">Esta área no tiene colecciones aún</p>
                      <p className="text-sm text-gray-500 mb-6 max-w-md">Las colecciones te permiten organizar el conocimiento por temas.<br/>Por ejemplo: "Proceso de ventas", "Políticas de RRHH", "Manual técnico"</p>
                      <button onClick={() => setShowCollModal(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 transition-colors">+ Crear primera colección</button>
                    </div>
                  ) : collections.map(coll => (
                  <Link key={coll.id} href={`/dashboard/library?area=${areaId}&collection=${coll.id}`} className="group bg-white p-6 rounded-2xl border border-gray-200 hover:border-indigo-200 hover:shadow-lg transition-all">
                    <div className="p-2 w-fit rounded-lg bg-gray-50 text-gray-400 mb-4 font-bold group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors"><Grid size={20} /></div>
                    <h3 className="text-base font-bold text-gray-950 mb-1">{coll.name}</h3>
                    <div className="flex items-center justify-between mt-6 text-[11px] font-bold text-gray-400">
                       <span className="bg-gray-50 px-2 py-0.5 rounded-md">{entries.filter(e => e.collection_id === coll.id).length} entradas</span>
                       <span>Actualizado {formatDate(coll.updated_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
              </>
            )}

            {/* ── Collection detail: file upload zone ── */}
            {collectionId && (
              <div
                className={`mb-4 border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.pdf,.doc,.docx,.xls,.xlsx'; i.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFileUpload(f) }; i.click() }}
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
                    <p className="text-sm font-medium text-indigo-600">Subiendo documento...</p>
                  </div>
                ) : (
                  <>
                    <p className="text-2xl mb-2">📎</p>
                    <p className="text-sm font-semibold text-gray-700">Arrastra archivos aquí</p>
                    <p className="text-xs text-gray-400 mt-0.5">o haz clic para seleccionar · PDF, Word, Excel · máx 50MB</p>
                  </>
                )}
              </div>
            )}

            {/* ── Collection detail: unified document view ── */}
            {collectionId && (
              <div className="max-w-3xl mx-auto">
                {/* Document header */}
                {currentCollection && (
                  <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">{currentCollection.name}</h1>
                    {currentCollection.description && (
                      <p className="text-gray-500 mt-1">{currentCollection.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
                      <span>{filteredEntries.length} secciones</span>
                      <span>Última actualización: {formatDate(currentCollection.updated_at)}</span>
                    </div>
                  </div>
                )}

                {/* Document body */}
                <div className="space-y-0">
                  {filteredEntries.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">Esta colección está vacía</p>
                      <p className="text-sm mt-1">
                        Ve al chat y cuando Nukor detecte conocimiento nuevo,<br />
                        podrás guardarlo directamente aquí.
                      </p>
                      <button
                        onClick={() => router.push('/dashboard')}
                        className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Ir al chat →
                      </button>
                    </div>
                  ) : (
                    <>
                      {filteredEntries.map((entry, index) => (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="group relative"
                        >
                          {index > 0 && <div className="border-t border-gray-100 my-1" />}

                          <div className="relative py-4 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                            {editingEntryId === entry.id ? (
                              <div className="space-y-2 pr-10">
                                <input
                                  value={editTitle}
                                  onChange={e => setEditTitle(e.target.value)}
                                  className="w-full font-semibold text-gray-800 border-b border-indigo-300 focus:outline-none bg-transparent pb-1"
                                />
                                <textarea
                                  value={editContent}
                                  onChange={e => setEditContent(e.target.value)}
                                  className="w-full text-gray-600 text-sm leading-relaxed focus:outline-none bg-transparent resize-none border-none"
                                  rows={6}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSaveEdit(entry.id)}
                                    className="text-xs text-white bg-indigo-600 px-3 py-1 rounded-md hover:bg-indigo-700"
                                  >
                                    Guardar
                                  </button>
                                  <button
                                    onClick={() => setEditingEntryId(null)}
                                    className="text-xs text-gray-500 px-3 py-1 rounded-md hover:bg-gray-100"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="pr-10">
                                <h3 className="font-semibold text-gray-800 mb-1">{entry.title}</h3>
                                <div className="text-gray-600 text-sm leading-relaxed prose prose-sm max-w-none">
                                  <ReactMarkdown>{entry.content}</ReactMarkdown>
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-xs text-gray-400">
                                    {entry.created_by === currentUserId ? 'Tú' : 'Asistente'} · {formatDate(entry.created_at)}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Inline action buttons — visible on hover */}
                            {editingEntryId !== entry.id && (
                              <div className="absolute right-2 top-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                {confirmDeleteId === entry.id ? (
                                  <div className="flex items-center gap-1 bg-white border border-red-100 rounded-lg shadow-sm px-2 py-1">
                                    <span className="text-xs text-red-600">¿Eliminar?</span>
                                    <button
                                      onClick={() => confirmDelete(entry.id)}
                                      className="text-xs text-red-600 font-medium hover:text-red-700 px-1"
                                    >
                                      Sí
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="text-xs text-gray-400 hover:text-gray-600 px-1"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleEditEntry(entry)}
                                      className="p-1.5 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                                      title="Editar"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    {/* Move to area */}
                                    <div className="relative" onClick={e => e.stopPropagation()}>
                                      <button
                                        onClick={() => setMoveDropdownId(moveDropdownId === entry.id ? null : entry.id)}
                                        className="p-1.5 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                                        title="Mover a área"
                                      >
                                        <FolderInput className="w-3.5 h-3.5" />
                                      </button>
                                      {moveDropdownId === entry.id && (
                                        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                                          <div className="py-1 max-h-48 overflow-y-auto">
                                            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mover a área</div>
                                            {areas.map(a => (
                                              <button
                                                key={a.id}
                                                onClick={() => { handleAssignArea(entry.id, a.id); setMoveDropdownId(null) }}
                                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                              >
                                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.color || '#ccc' }} />
                                                <span className="truncate">{a.name}</span>
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => setConfirmDeleteId(entry.id)}
                                      className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                      title="Eliminar sección"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}

                      <button
                        onClick={() => router.push('/dashboard')}
                        className="mt-4 flex items-center gap-2 text-sm text-gray-400 hover:text-indigo-600 transition-colors py-2 px-2 rounded-lg hover:bg-indigo-50 w-full"
                      >
                        <Plus className="w-4 h-4" />
                        Agregar sección
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Non-collection list view (search / unclassified) ── */}
            {!collectionId && (debouncedQuery || areaId === 'unclassified') && (
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
                {filteredEntries.length === 0 ? (
                  debouncedQuery ? (
                    <div className="p-20 text-center flex flex-col items-center">
                      <Search size={40} className="text-gray-200 mb-4" />
                      <p className="text-lg font-bold text-gray-950 mb-2">No se encontraron resultados</p>
                      <p className="text-sm font-medium text-gray-500">Intenta con otros términos.</p>
                    </div>
                  ) : (
                    <div className="p-20 text-center flex flex-col items-center">
                      <BookOpen size={40} className="text-gray-200 mb-4" />
                      <p className="text-lg font-bold text-gray-950 mb-2">No hay entradas</p>
                      <p className="text-sm font-medium text-gray-500">Aún no tienes entradas aquí.</p>
                    </div>
                  )
                ) : filteredEntries.map(entry => (
                  <div key={entry.id} className="group flex items-start gap-4 px-6 py-5 hover:bg-gray-50 transition-all cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><BookOpen size={18} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-gray-950 truncate">{entry.title}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {areas.find(a => a.id === entry.area_id)?.name || 'Sin área'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-1 mb-2 font-medium">{entry.content.slice(0, 100)}...</p>
                      <div className="flex items-center gap-3 text-[11px] font-bold text-gray-400">
                        <span className="text-indigo-600">{entry.created_by === currentUserId ? 'Tú' : 'Asistente'}</span>
                        <span>{formatDate(entry.created_at)}</span>
                      </div>
                    </div>
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === entry.id ? null : entry.id) }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 md:opacity-0 group-hover:opacity-100 transition-all">
                        <MoreHorizontal size={16}/>
                      </button>
                      {openDropdownId === entry.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden" onClick={e => e.stopPropagation()}>
                          <div className="py-1 max-h-48 overflow-y-auto">
                            <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Asignar área</div>
                            {areas.map(a => (
                              <button key={a.id} onClick={(e) => { e.stopPropagation(); handleAssignArea(entry.id, a.id) }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.color || '#ccc' }} />
                                <span className="truncate">{a.name}</span>
                              </button>
                            ))}
                            <div className="h-px bg-gray-100 my-1" />
                            <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(entry); setOpenDropdownId(null) }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium">
                              <Trash2 size={14} /> Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {showAreaModal && <NewAreaModal onClose={() => setShowAreaModal(false)} onSaved={fetchData} userId={currentUserId || ''} />}
      {showCollModal && <NewCollectionModal onClose={() => setShowCollModal(false)} onSaved={fetchData} userId={currentUserId || ''} areaId={areaId || ''} />}

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
