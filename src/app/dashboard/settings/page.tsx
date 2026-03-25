'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/dashboard/Sidebar'
import UserMenu from '@/components/dashboard/UserMenu'
import {
  Menu, Save, AlertTriangle,
  X, Code2, Plus, Check, Zap, ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'

const INDUSTRIES = [
  'Logística', 'Retail', 'Salud', 'Tecnología',
  'Educación', 'Construcción', 'Otro',
]

const WORKSPACE_TABS = [
  { id: 'general', label: 'General', icon: '⚙️' },
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

  // ── General ──
  const [wsNameInput, setWsNameInput] = useState('')
  const [industry, setIndustry] = useState('')
  const [savingName, setSavingName] = useState(false)

  // ── Members ──
  const [members, setMembers] = useState<{ id: string; full_name: string; email: string; role: string }[]>([])
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [inviting, setInviting] = useState(false)

  // ── Plan ──
  const [entriesCount, setEntriesCount] = useState<number | null>(null)
  const [conversationsCount, setConversationsCount] = useState<number | null>(null)
  const [integrationsCount, setIntegrationsCount] = useState<number | null>(null)
  const [membersCount, setMembersCount] = useState<number | null>(null)
  const [currentPlan, setCurrentPlan] = useState<'free' | 'pro'>('free')
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [upgradingPlan, setUpgradingPlan] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario')
      setUserEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles').select('last_workspace_id').eq('id', user.id).maybeSingle()
      if (!profile?.last_workspace_id) return
      setWorkspaceId(profile.last_workspace_id)

      const { data: ws } = await supabase
        .from('workspaces').select('name, ai_config').eq('id', profile.last_workspace_id).maybeSingle()
      if (ws?.name) { setWorkspaceName(ws.name); setWsNameInput(ws.name) }
      if (ws?.ai_config?.industry) setIndustry(ws.ai_config.industry)
    }
    init()
  }, [])

  useEffect(() => {
    if (activeTab === 'members' && workspaceId) fetchMembers()
    if (activeTab === 'plan' && workspaceId) fetchPlanStats()
  }, [activeTab, workspaceId])

  const fetchMembers = async () => {
    if (!workspaceId) return
    const { data } = await supabase
      .from('workspace_members')
      .select('role, profiles(id, full_name, email)')
      .eq('workspace_id', workspaceId)
    if (data) {
      setMembers(data.map((m: any) => ({
        id: m.profiles?.id ?? '',
        full_name: m.profiles?.full_name ?? 'Usuario',
        email: m.profiles?.email ?? '',
        role: m.role ?? 'viewer',
      })))
    }
  }

  const fetchPlanStats = async () => {
    if (!workspaceId) return
    const [{ count: entries }, { count: convs }, { count: mems }] = await Promise.all([
      supabase.from('entries').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('workspace_members').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    ])
    setEntriesCount(entries ?? 0)
    setConversationsCount(convs ?? 0)
    setMembersCount(mems ?? 0)

    const [intRes, subRes] = await Promise.all([
      fetch(`/api/integrations?workspace_id=${workspaceId}`).catch(() => null),
      fetch('/api/billing/subscription').catch(() => null),
    ])
    if (intRes?.ok) {
      const data = await intRes.json()
      setIntegrationsCount((data.connections ?? []).length)
    } else {
      setIntegrationsCount(0)
    }
    if (subRes?.ok) {
      const data = await subRes.json()
      setCurrentPlan(data.plan ?? 'free')
      setSubscriptionStatus(data.status ?? null)
      setCurrentPeriodEnd(data.currentPeriodEnd ?? null)
      setPortalUrl(data.portalUrl ?? null)
    }
  }

  const handleUpgrade = async () => {
    setUpgradingPlan(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro' }),
      })
      if (!res.ok) throw new Error()
      const { checkoutUrl } = await res.json()
      window.location.href = checkoutUrl
    } catch {
      toast.error('Error al crear el checkout. Inténtalo de nuevo.')
      setUpgradingPlan(false)
    }
  }

  const handleSaveWorkspaceName = async () => {
    if (!workspaceId || !wsNameInput.trim()) return
    setSavingName(true)
    const { error } = await supabase
      .from('workspaces').update({ name: wsNameInput.trim() }).eq('id', workspaceId)
    setSavingName(false)
    if (error) { toast.error('Error al guardar el nombre') }
    else { setWorkspaceName(wsNameInput.trim()); toast.success('Nombre actualizado') }
  }

  const handleSaveIndustry = async () => {
    if (!workspaceId) return
    const res = await fetch('/api/workspace/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, ai_config: { industry } }),
    })
    if (res.ok) toast.success('Industria guardada')
    else toast.error('Error al guardar')
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !workspaceId) return
    setInviting(true)
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, workspace_id: workspaceId }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Invitación enviada a ${inviteEmail.trim()}`)
      setInviteEmail('')
      setShowInviteModal(false)
    } catch {
      toast.error('Error al enviar la invitación')
    } finally {
      setInviting(false)
    }
  }

  const setTab = (tab: string) => router.push(`/dashboard/settings?tab=${tab}`)
  const initials = (name: string) => name.slice(0, 2).toUpperCase()

  const roleBadge = (role: string) => {
    const styles: Record<string, string> = {
      admin: 'bg-indigo-100 text-indigo-700',
      editor: 'bg-emerald-100 text-emerald-700',
      viewer: 'bg-gray-100 text-gray-600',
    }
    const labels: Record<string, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[role] ?? styles.viewer}`}>
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

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
          <button className="md:hidden p-2 -ml-2 text-gray-400" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="flex-1" />
          <UserMenu userName={userName} userEmail={userEmail} />
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Settings sub-nav */}
          <aside className="hidden sm:flex flex-col w-52 bg-white border-r border-gray-200 flex-shrink-0">
            <div className="p-5 pb-3">
              <h1 className="text-base font-bold text-gray-950 tracking-tight">Configuración</h1>
            </div>
            <nav className="px-3 flex-1">
              {WORKSPACE_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left mb-0.5 ${
                    activeTab === tab.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-slate-50 hover:text-gray-900'
                  }`}
                >
                  <span className="text-base leading-none">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-6 py-8">
              {/* Mobile header */}
              <div className="flex items-center gap-3 mb-6 sm:hidden">
                <button className="p-2 text-gray-400" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
                <h1 className="text-xl font-bold text-gray-950 tracking-tight">Configuración</h1>
              </div>
              <div className="sm:hidden mb-6 overflow-x-auto flex gap-2 pb-1">
                {WORKSPACE_TABS.map(tab => (
                  <button key={tab.id} onClick={() => setTab(tab.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
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
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre del workspace</label>
                      <div className="flex gap-2">
                        <input
                          type="text" value={wsNameInput}
                          onChange={e => setWsNameInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveWorkspaceName()}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 hover:bg-white transition-colors"
                          placeholder="Nombre del workspace"
                        />
                        <button onClick={handleSaveWorkspaceName}
                          disabled={savingName || wsNameInput.trim() === workspaceName}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow-sm"
                        >
                          <Save size={14} />
                          {savingName ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Industria</label>
                      <div className="flex gap-2">
                        <select value={industry} onChange={e => setIndustry(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 hover:bg-white transition-colors text-gray-700"
                        >
                          <option value="">Seleccionar industria...</option>
                          {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                        </select>
                        <button onClick={handleSaveIndustry} disabled={!industry}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow-sm"
                        >
                          <Save size={14} /> Guardar
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Logo del workspace</label>
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-black">N</div>
                        <div>
                          <button disabled title="Próximamente" className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed bg-gray-50">Subir imagen</button>
                          <p className="text-xs text-gray-400 mt-1">PNG, JPG hasta 2MB — Próximamente</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border border-red-200 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={16} className="text-red-500" />
                      <h3 className="text-sm font-bold text-red-600">Zona peligrosa</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">Esta acción no se puede deshacer. Se eliminarán todos los datos del workspace.</p>
                    <button disabled title="Función disponible próximamente"
                      className="px-4 py-2 text-sm font-semibold text-red-400 border border-red-200 rounded-lg cursor-not-allowed bg-red-50"
                    >
                      Eliminar workspace
                    </button>
                  </div>
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
                    <button onClick={() => setShowInviteModal(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
                    >
                      <Plus size={15} /> Invitar
                    </button>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {members.length === 0 ? (
                      <div className="py-12 text-center text-sm text-gray-400">Cargando miembros...</div>
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
              {activeTab === 'plan' && (() => {
                const isPro = currentPlan === 'pro'
                const FREE_LIMITS = { entries: 100, members: 3, integrations: 2 }

                const usageItems = [
                  { label: 'Entradas en biblioteca', value: entriesCount ?? 0, limit: isPro ? null : FREE_LIMITS.entries },
                  { label: 'Miembros', value: membersCount ?? 0, limit: isPro ? null : FREE_LIMITS.members },
                  { label: 'Integraciones', value: integrationsCount ?? 0, limit: isPro ? null : FREE_LIMITS.integrations },
                ]

                const statusLabel: Record<string, string> = {
                  active: 'Activo', on_trial: 'Prueba', paused: 'Pausado',
                  cancelled: 'Cancelado', expired: 'Vencido',
                }
                const statusColor: Record<string, string> = {
                  active: 'bg-emerald-100 text-emerald-700',
                  on_trial: 'bg-indigo-100 text-indigo-700',
                  paused: 'bg-amber-100 text-amber-700',
                  cancelled: 'bg-red-100 text-red-600',
                  expired: 'bg-red-100 text-red-600',
                }

                return (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-bold text-gray-950 tracking-tight mb-1">Plan</h2>
                      <p className="text-sm text-gray-500">Tu suscripción y uso actual.</p>
                    </div>

                    {/* Current plan card */}
                    <div className={`rounded-xl border p-6 ${isPro ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white border-gray-200'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${isPro ? 'text-indigo-200' : 'text-gray-400'}`}>
                            Plan actual
                          </p>
                          <p className={`text-2xl font-bold tracking-tight ${isPro ? 'text-white' : 'text-gray-950'}`}>
                            {isPro ? 'Plan Pro' : 'Plan Gratuito'}
                          </p>
                          {currentPeriodEnd && (
                            <p className={`text-xs mt-1 ${isPro ? 'text-indigo-200' : 'text-gray-400'}`}>
                              {subscriptionStatus === 'cancelled' ? 'Acceso hasta' : 'Renueva el'}{' '}
                              {new Date(currentPeriodEnd).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-3">
                          {subscriptionStatus && (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColor[subscriptionStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                              {statusLabel[subscriptionStatus] ?? subscriptionStatus}
                            </span>
                          )}
                          {!isPro && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
                              Gratuito
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {isPro ? (
                          portalUrl ? (
                            <a href={portalUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-semibold transition-colors"
                            >
                              <ExternalLink size={14} />
                              Gestionar suscripción
                            </a>
                          ) : (
                            <span className="text-xs text-indigo-200">Cargando portal...</span>
                          )
                        ) : (
                          <button onClick={handleUpgrade} disabled={upgradingPlan}
                            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm"
                          >
                            <Zap size={14} />
                            {upgradingPlan ? 'Redirigiendo...' : 'Actualizar a Pro'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Usage */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-5">Uso del workspace</p>
                      <div className="space-y-4">
                        {usageItems.map(item => {
                          const pct = item.limit ? Math.min(100, Math.round((item.value / item.limit) * 100)) : 0
                          const isNearLimit = item.limit && pct >= 80
                          const isAtLimit = item.limit && pct >= 100
                          return (
                            <div key={item.label}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm text-gray-700 font-medium">{item.label}</span>
                                <span className={`text-sm font-semibold ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-amber-600' : 'text-gray-950'}`}>
                                  {item.value === null ? '—' : item.value}
                                  {item.limit && <span className="font-normal text-gray-400"> / {item.limit}</span>}
                                  {!item.limit && <span className="ml-1 text-xs font-normal text-emerald-600">Ilimitado</span>}
                                </span>
                              </div>
                              {item.limit && (
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-400' : 'bg-indigo-500'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Pro plan card — only shown on free */}
                    {!isPro && (
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-gray-950">Plan Pro</p>
                            <p className="text-xs text-gray-400 mt-0.5">Todo lo que necesitas para escalar</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-gray-950 tracking-tight">$29</p>
                            <p className="text-xs text-gray-400">/ mes</p>
                          </div>
                        </div>
                        <div className="px-6 py-5">
                          <ul className="space-y-2.5 mb-6">
                            {[
                              'Entradas ilimitadas en biblioteca',
                              'Hasta 15 miembros',
                              'Todas las integraciones (Google Drive, Notion, Slack…)',
                              'Asistente IA con prioridad',
                              'Soporte prioritario',
                            ].map(feat => (
                              <li key={feat} className="flex items-start gap-2.5 text-sm text-gray-700">
                                <Check size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                {feat}
                              </li>
                            ))}
                          </ul>
                          <button onClick={handleUpgrade} disabled={upgradingPlan}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm"
                          >
                            <Zap size={14} />
                            {upgradingPlan ? 'Redirigiendo...' : 'Empezar con Pro'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* ── DESARROLLADORES ── */}
              {activeTab === 'developers' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-gray-950 tracking-tight mb-1">Desarrolladores</h2>
                    <p className="text-sm text-gray-500">Integra Nukor con tus propios sistemas usando nuestra API.</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-gray-950">API Keys</h3>
                      <button disabled title="Próximamente — disponible en el plan Pro"
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed"
                      >
                        <Plus size={14} /> Generar API key
                      </button>
                    </div>
                    <div className="py-10 flex flex-col items-center gap-2 text-center border border-dashed border-gray-200 rounded-lg mb-6">
                      <Code2 size={24} className="text-gray-300" />
                      <p className="text-sm text-gray-400 font-medium">No tienes API keys generadas aún</p>
                      <p className="text-xs text-gray-400">Genera una API key para integrar Nukor — Disponible en el plan Pro</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Ejemplo de uso (próximamente)</p>
                      <div className="bg-gray-950 rounded-xl p-4 text-xs font-mono text-gray-300 space-y-1 overflow-x-auto">
                        <p><span className="text-indigo-400">POST</span> https://api.nukor.app/v1/chat</p>
                        <p><span className="text-gray-500">Authorization:</span> Bearer nk_live_xxxxx</p>
                        <p><span className="text-gray-500">Content-Type:</span> application/json</p>
                        <p className="mt-2 text-gray-500">{'{'}</p>
                        <p>&nbsp;&nbsp;<span className="text-emerald-400">"message"</span>: <span className="text-amber-400">"¿Cuál es el proceso de devolución?"</span></p>
                        <p className="text-gray-500">{'}'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-base font-semibold text-gray-950">Invitar miembro</h2>
              <button onClick={() => setShowInviteModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
                <input
                  type="email" value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                  placeholder="colaborador@empresa.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Rol</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="admin">Admin — acceso completo</option>
                  <option value="editor">Editor — puede crear y editar</option>
                  <option value="viewer">Viewer — solo lectura</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowInviteModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg">Cancelar</button>
              <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                className="px-5 py-2 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-60"
              >
                {inviting ? 'Enviando...' : 'Enviar invitación'}
              </button>
            </div>
          </div>
        </div>
      )}
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
