'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/dashboard/Sidebar'
import IntegrationsTab from '@/components/settings/IntegrationsTab'
import { Menu, Settings, Bot, Plug, Users, CreditCard, Code2, Save, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

const INDUSTRIES = [
  'Logística', 'Retail', 'Salud', 'Tecnología',
  'Educación', 'Construcción', 'Otro',
]

const TABS = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'ai', label: 'Asistente IA', icon: '🤖' },
  { id: 'integrations', label: 'Integraciones', icon: '🔌' },
  { id: 'members', label: 'Miembros', icon: '👥' },
  { id: 'plan', label: 'Plan', icon: '💳' },
  { id: 'developers', label: 'Desarrolladores', icon: '🔧' },
]

function SettingsContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get('tab') || 'general'

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [workspaceName, setWorkspaceName] = useState('Mi workspace')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  // General tab state
  const [wsNameInput, setWsNameInput] = useState('')
  const [industry, setIndustry] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Members tab state
  const [members, setMembers] = useState<{ id: string; full_name: string; email: string; role: string }[]>([])

  // Plan tab state
  const [entriesCount, setEntriesCount] = useState<number | null>(null)
  const [conversationsCount, setConversationsCount] = useState<number | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario')
      setUserEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('last_workspace_id')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile?.last_workspace_id) return
      setWorkspaceId(profile.last_workspace_id)

      const { data: ws } = await supabase
        .from('workspaces')
        .select('name')
        .eq('id', profile.last_workspace_id)
        .maybeSingle()

      if (ws?.name) {
        setWorkspaceName(ws.name)
        setWsNameInput(ws.name)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!workspaceId) return
    if (activeTab === 'members') fetchMembers()
    if (activeTab === 'plan') fetchPlanStats()
  }, [activeTab, workspaceId])

  const fetchMembers = async () => {
    if (!workspaceId) return
    const { data } = await supabase
      .from('workspace_members')
      .select('role, profiles(id, full_name, email)')
      .eq('workspace_id', workspaceId)
    if (data) {
      setMembers(
        data.map((m: any) => ({
          id: m.profiles?.id ?? '',
          full_name: m.profiles?.full_name ?? 'Usuario',
          email: m.profiles?.email ?? '',
          role: m.role ?? 'viewer',
        }))
      )
    }
  }

  const fetchPlanStats = async () => {
    if (!workspaceId) return
    const [{ count: entries }, { count: convs }] = await Promise.all([
      supabase.from('entries').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    ])
    setEntriesCount(entries ?? 0)
    setConversationsCount(convs ?? 0)
  }

  const handleSaveWorkspaceName = async () => {
    if (!workspaceId || !wsNameInput.trim()) return
    setSavingName(true)
    const { error } = await supabase
      .from('workspaces')
      .update({ name: wsNameInput.trim() })
      .eq('id', workspaceId)
    setSavingName(false)
    if (error) {
      toast.error('Error al guardar el nombre')
    } else {
      setWorkspaceName(wsNameInput.trim())
      toast.success('Nombre actualizado')
    }
  }

  const setTab = (tab: string) => {
    router.push(`/dashboard/settings?tab=${tab}`)
  }

  const initials = (name: string) => name.slice(0, 2).toUpperCase()

  const roleBadge = (role: string) => {
    const map: Record<string, string> = {
      admin: 'bg-indigo-100 text-indigo-700',
      editor: 'bg-emerald-100 text-emerald-700',
      viewer: 'bg-gray-100 text-gray-600',
    }
    const labels: Record<string, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[role] ?? map.viewer}`}>
        {labels[role] ?? role}
      </span>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Main sidebar */}
      <aside className={`fixed md:relative inset-y-0 left-0 z-50 w-64 h-full bg-white border-r border-gray-200 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <Sidebar
          activeConversationId={null}
          onSelectConversation={() => {}}
          onNewConversation={() => {}}
          userName={userName}
          userEmail={userEmail}
          workspaceName={workspaceName}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Settings layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Settings sub-nav */}
        <aside className="hidden sm:flex flex-col w-52 bg-white border-r border-gray-200 flex-shrink-0">
          <div className="p-5 pb-3">
            <h1 className="text-base font-bold text-gray-950 tracking-tight">Configuración</h1>
          </div>
          <nav className="px-3 flex-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left mb-0.5 ${
                  activeTab === tab.id
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-500 hover:bg-slate-50 hover:text-gray-900'
                }`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8">
            {/* Mobile header */}
            <div className="flex items-center gap-3 mb-6 sm:hidden">
              <button className="p-2 text-gray-400" onClick={() => setSidebarOpen(true)}>
                <Menu size={20} />
              </button>
              <h1 className="text-xl font-bold text-gray-950 tracking-tight">Configuración</h1>
            </div>

            {/* Mobile tab selector */}
            <div className="sm:hidden mb-6 overflow-x-auto flex gap-2 pb-1">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* ── GENERAL ── */}
            {activeTab === 'general' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-bold text-gray-950 tracking-tight mb-1">General</h2>
                  <p className="text-sm text-gray-500">Información básica de tu workspace.</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
                  {/* Workspace name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre del workspace</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={wsNameInput}
                        onChange={e => setWsNameInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveWorkspaceName()}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 hover:bg-white transition-colors"
                        placeholder="Nombre del workspace"
                      />
                      <button
                        onClick={handleSaveWorkspaceName}
                        disabled={savingName || wsNameInput.trim() === workspaceName}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow-sm"
                      >
                        <Save size={14} />
                        {savingName ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>

                  {/* Industry */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Industria</label>
                    <select
                      value={industry}
                      onChange={e => setIndustry(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 hover:bg-white transition-colors text-gray-700"
                    >
                      <option value="">Seleccionar industria...</option>
                      {INDUSTRIES.map(ind => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>

                  {/* Logo upload placeholder */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Logo del workspace</label>
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-black">
                        N
                      </div>
                      <div>
                        <button
                          disabled
                          title="Próximamente"
                          className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed bg-gray-50"
                        >
                          Subir imagen
                        </button>
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG hasta 2MB — Próximamente</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Danger zone */}
                <div className="bg-white border border-red-200 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={16} className="text-red-500" />
                    <h3 className="text-sm font-bold text-red-600">Zona peligrosa</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">Esta acción no se puede deshacer. Se eliminarán todos los datos del workspace.</p>
                  <button
                    disabled
                    title="Próximamente"
                    className="px-4 py-2 text-sm font-semibold text-red-400 border border-red-200 rounded-lg cursor-not-allowed bg-red-50"
                  >
                    Eliminar workspace
                  </button>
                </div>
              </div>
            )}

            {/* ── ASISTENTE IA ── */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-950 tracking-tight mb-1">Asistente IA</h2>
                  <p className="text-sm text-gray-500">Personaliza el comportamiento del asistente en tu workspace.</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre del asistente</label>
                    <input
                      type="text"
                      disabled
                      placeholder="Nukor AI — Próximamente"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Instrucciones del sistema</label>
                    <textarea
                      disabled
                      placeholder="Define cómo debe comportarse el asistente... — Próximamente"
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Modelo</label>
                    <select
                      disabled
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                    >
                      <option>Claude Sonnet — Próximamente</option>
                    </select>
                  </div>
                  <button
                    disabled
                    title="Próximamente"
                    className="px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed"
                  >
                    Guardar configuración
                  </button>
                </div>
              </div>
            )}

            {/* ── INTEGRACIONES ── */}
            {activeTab === 'integrations' && workspaceId && (
              <IntegrationsTab workspaceId={workspaceId} />
            )}
            {activeTab === 'integrations' && !workspaceId && (
              <div className="h-40 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* ── MIEMBROS ── */}
            {activeTab === 'members' && (
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-950 tracking-tight mb-1">Miembros</h2>
                    <p className="text-sm text-gray-500">Personas con acceso a este workspace.</p>
                  </div>
                  <button
                    disabled
                    title="Próximamente"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed"
                  >
                    + Invitar miembro
                  </button>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {members.length === 0 ? (
                    <div className="py-12 text-center text-sm text-gray-400">
                      Cargando miembros...
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {members.map(m => (
                        <li key={m.id} className="flex items-center gap-4 px-5 py-4">
                          <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0">
                            {initials(m.full_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-950 truncate">{m.full_name}</p>
                            <p className="text-xs text-gray-400 truncate">{m.email}</p>
                          </div>
                          {roleBadge(m.role)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* ── PLAN ── */}
            {activeTab === 'plan' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-950 tracking-tight mb-1">Plan</h2>
                  <p className="text-sm text-gray-500">Tu suscripción y uso actual.</p>
                </div>

                {/* Current plan card */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Plan actual</p>
                      <p className="text-2xl font-bold text-gray-950 tracking-tight">Plan Gratuito</p>
                    </div>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Activo</span>
                  </div>
                  <button
                    disabled
                    title="Próximamente"
                    className="px-5 py-2 text-sm font-semibold bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed"
                  >
                    Actualizar plan — Próximamente
                  </button>
                </div>

                {/* Usage stats */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Uso del workspace</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-950">
                        {entriesCount === null ? '—' : entriesCount}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Entradas en biblioteca</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-950">
                        {conversationsCount === null ? '—' : conversationsCount}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Conversaciones</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-950">—</p>
                      <p className="text-xs text-gray-500 mt-1">Integraciones conectadas</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── DESARROLLADORES ── */}
            {activeTab === 'developers' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-950 tracking-tight mb-1">Desarrolladores</h2>
                  <p className="text-sm text-gray-500">Las API keys te permiten integrar Nukor con tus propios sistemas.</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-950">API Keys</h3>
                    <button
                      disabled
                      title="Próximamente"
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed"
                    >
                      + Generar API key
                    </button>
                  </div>
                  <div className="py-10 flex flex-col items-center gap-2 text-center border border-dashed border-gray-200 rounded-lg">
                    <Code2 size={24} className="text-gray-300" />
                    <p className="text-sm text-gray-400 font-medium">No tienes API keys generadas aún</p>
                    <p className="text-xs text-gray-400">Genera una API key para integrar Nukor con tus sistemas — Próximamente</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  )
}
