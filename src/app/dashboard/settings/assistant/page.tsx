'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/dashboard/Sidebar'
import UserMenu from '@/components/dashboard/UserMenu'
import IntegrationsTab from '@/components/settings/IntegrationsTab'
import {
  Menu, Save, AlertTriangle, ChevronDown, ChevronRight, Plus, X, Smartphone, CheckCircle, Clock,
} from 'lucide-react'
import { toast } from 'sonner'

const ASSISTANT_TABS = [
  { id: 'ai', label: 'Asistente IA', icon: '🤖' },
  { id: 'integrations', label: 'Integraciones', icon: '🔌' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '📱' },
]

const TONES = [
  { id: 'profesional', label: 'Profesional', desc: 'Directo y claro' },
  { id: 'amigable', label: 'Amigable', desc: 'Cercano y cálido' },
  { id: 'tecnico', label: 'Técnico', desc: 'Preciso y detallado' },
  { id: 'formal', label: 'Formal', desc: 'Corporativo y estructurado' },
]

function buildSystemPrompt(cfg: Record<string, any>): string {
  const name = cfg.assistant_name || 'Nukor'
  const toneMap: Record<string, string> = {
    profesional: 'profesional y directo',
    amigable: 'amigable y cercano',
    tecnico: 'técnico y preciso',
    formal: 'formal y corporativo',
  }
  const tone = toneMap[cfg.tone || 'profesional'] || 'profesional y directo'
  let prompt = `Eres ${name}, el asistente de conocimiento interno de esta empresa. Respondes siempre en español latinoamericano con un tono ${tone}.`

  const behaviorMap: Record<string, string> = {
    admit: 'Cuando no tengas información sobre un tema, admítelo claramente y sugiere al usuario cómo podría documentarlo.',
    try: 'Cuando no tengas información exacta, intenta responder con lo disponible, indicando claramente que puede faltar contexto.',
    escalate: 'Cuando no tengas información suficiente, sugiere al usuario contactar al responsable del área correspondiente.',
  }
  if (cfg.unknown_behavior && behaviorMap[cfg.unknown_behavior]) {
    prompt += `\n\n${behaviorMap[cfg.unknown_behavior]}`
  }

  const saveMap: Record<string, string> = {
    always: 'Cuando el usuario comparte información importante, guárdala automáticamente sin pedir confirmación.',
    confirm: 'Antes de guardar cualquier información nueva, pide confirmación al usuario.',
    never: 'No guardes información automáticamente. Espera instrucciones explícitas del usuario para guardar.',
  }
  if (cfg.auto_save && saveMap[cfg.auto_save]) {
    prompt += `\n\n${saveMap[cfg.auto_save]}`
  }

  return prompt
}

function AssistantSettingsContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get('tab') || 'ai'

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [workspaceName, setWorkspaceName] = useState('Mi workspace')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // ── AI tab ──
  const [aiCfg, setAiCfg] = useState({
    assistant_name: 'Nukor',
    tone: 'profesional',
    unknown_behavior: 'admit',
    auto_save: 'always',
    rag_threshold: 0.3,
    max_messages: 20,
    tools_enabled: true,
    system_prompt: '',
    system_prompt_manual: false,
  })
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([])
  const [areaAccess, setAreaAccess] = useState<string[]>([])
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [promptUnlocked, setPromptUnlocked] = useState(false)
  const [savingAi, setSavingAi] = useState(false)
  const [aiUpdatedAt, setAiUpdatedAt] = useState<string | null>(null)

  const [currentPlan, setCurrentPlan] = useState<string | null>(null)

  // ── WhatsApp ──
  const [phoneMembers, setPhoneMembers] = useState<{ id: string; phone_number: string; name: string; activated: boolean; created_at: string }[]>([])
  const [loadingPhoneMembers, setLoadingPhoneMembers] = useState(false)
  const [showAddPhone, setShowAddPhone] = useState(false)
  const [newPhoneName, setNewPhoneName] = useState('')
  const [newPhoneNumber, setNewPhoneNumber] = useState('')
  const [addingPhone, setAddingPhone] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario')
      setUserEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles').select('last_workspace_id').eq('id', user.id).maybeSingle()
      if (!profile?.last_workspace_id) return
      setWorkspaceId(profile.last_workspace_id)

      const { data: ws } = await supabase
        .from('workspaces').select('name, ai_config, plan').eq('id', profile.last_workspace_id).maybeSingle()
      if (ws?.name) setWorkspaceName(ws.name)
      if (ws?.plan !== undefined) setCurrentPlan(ws.plan)
      if (ws?.ai_config) {
        const cfg = ws.ai_config
        setAiCfg(prev => ({
          ...prev,
          assistant_name: cfg.assistant_name || 'Nukor',
          tone: cfg.tone || 'profesional',
          unknown_behavior: cfg.unknown_behavior || 'admit',
          auto_save: cfg.auto_save || 'always',
          rag_threshold: cfg.rag_threshold ?? 0.3,
          max_messages: cfg.max_messages ?? 20,
          tools_enabled: cfg.tools_enabled ?? true,
          system_prompt: cfg.system_prompt || '',
          system_prompt_manual: cfg.system_prompt_manual ?? false,
        }))
        if (cfg.areas_access) setAreaAccess(cfg.areas_access)
        if (cfg.updated_at) setAiUpdatedAt(cfg.updated_at)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (activeTab === 'ai' && workspaceId) {
      fetch('/api/areas').then(r => r.json()).then(d => setAreas(d.areas || []))
    }
    if (activeTab === 'whatsapp' && workspaceId) {
      fetchPhoneMembers()
    }
  }, [activeTab, workspaceId])

  const fetchPhoneMembers = async () => {
    if (!workspaceId) return
    setLoadingPhoneMembers(true)
    try {
      const res = await fetch(`/api/phone/members?workspace_id=${workspaceId}`)
      const data = await res.json()
      setPhoneMembers(data.members ?? [])
    } catch { /* ignore */ } finally {
      setLoadingPhoneMembers(false)
    }
  }

  const handleAddPhoneMember = async () => {
    if (!newPhoneName.trim() || !newPhoneNumber.trim() || !workspaceId) return
    setAddingPhone(true)
    try {
      const res = await fetch('/api/phone/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, phone_number: newPhoneNumber.trim(), name: newPhoneName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Código de activación enviado a ${newPhoneNumber}`)
      setNewPhoneName('')
      setNewPhoneNumber('')
      setShowAddPhone(false)
      fetchPhoneMembers()
    } catch (err: any) {
      toast.error(err.message ?? 'Error al agregar el número')
    } finally {
      setAddingPhone(false)
    }
  }

  const handleRemovePhoneMember = async (id: string) => {
    if (!workspaceId) return
    await fetch('/api/phone/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, workspace_id: workspaceId }),
    })
    setPhoneMembers(prev => prev.filter(m => m.id !== id))
    toast.success('Número eliminado')
  }

  useEffect(() => {
    if (!aiCfg.system_prompt_manual) {
      setAiCfg(prev => ({ ...prev, system_prompt: buildSystemPrompt(prev) }))
    }
  }, [aiCfg.assistant_name, aiCfg.tone, aiCfg.unknown_behavior, aiCfg.auto_save, aiCfg.system_prompt_manual])

  const updateAiCfg = (key: string, value: any) =>
    setAiCfg(prev => ({ ...prev, [key]: value }))

  const handleSaveAi = async () => {
    if (!workspaceId) return
    setSavingAi(true)
    const now = new Date().toISOString()
    const payload = {
      ...aiCfg,
      areas_access: areaAccess,
      updated_at: now,
      updated_by: currentUserId,
    }
    const res = await fetch('/api/workspace/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, ai_config: payload }),
    })
    setSavingAi(false)
    if (res.ok) { setAiUpdatedAt(now); toast.success('Configuración guardada') }
    else toast.error('Error al guardar')
  }

  const setTab = (tab: string) => router.push(`/dashboard/settings/assistant?tab=${tab}`)

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
              <h1 className="text-base font-bold text-gray-950 tracking-tight">Asistente</h1>
            </div>
            <nav className="px-3 flex-1">
              {ASSISTANT_TABS.map(tab => (
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
                <h1 className="text-xl font-bold text-gray-950 tracking-tight">Asistente</h1>
              </div>
              <div className="sm:hidden mb-6 overflow-x-auto flex gap-2 pb-1">
                {ASSISTANT_TABS.map(tab => (
                  <button key={tab.id} onClick={() => setTab(tab.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* ── ASISTENTE IA ── */}
              {activeTab === 'ai' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-gray-950 tracking-tight mb-1">Asistente IA</h2>
                    <p className="text-sm text-gray-500">Personaliza cómo se comporta el asistente en tu workspace.</p>
                  </div>

                  {/* Wizard */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Configuración guiada</p>

                    {/* Name */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre del asistente</label>
                      <input
                        type="text" value={aiCfg.assistant_name}
                        onChange={e => updateAiCfg('assistant_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 hover:bg-white transition-colors"
                        placeholder="Nukor"
                      />
                    </div>

                    {/* Tone */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Tono de comunicación</label>
                      <div className="grid grid-cols-2 gap-2">
                        {TONES.map(t => (
                          <button key={t.id} onClick={() => updateAiCfg('tone', t.id)}
                            className={`p-3 rounded-lg border text-left transition-all ${aiCfg.tone === t.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                          >
                            <p className={`text-sm font-semibold ${aiCfg.tone === t.id ? 'text-indigo-700' : 'text-gray-800'}`}>{t.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Areas access */}
                    {areas.length > 0 && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Áreas con acceso</label>
                        <p className="text-xs text-gray-400 mb-2">Sin selección = acceso a todas las áreas</p>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {areas.map(area => (
                            <label key={area.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={areaAccess.length === 0 || areaAccess.includes(area.id)}
                                onChange={e => {
                                  if (areaAccess.length === 0) {
                                    if (!e.target.checked) setAreaAccess(areas.map(a => a.id).filter(id => id !== area.id))
                                  } else {
                                    setAreaAccess(prev =>
                                      e.target.checked ? [...prev, area.id] : prev.filter(id => id !== area.id)
                                    )
                                  }
                                }}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-sm text-gray-700">{area.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unknown behavior */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Cuando no sabe la respuesta</label>
                      <div className="space-y-2">
                        {[
                          { id: 'admit', label: 'Admitir y sugerir documentar', desc: 'Reconoce que no tiene información y propone al usuario documentarla' },
                          { id: 'try', label: 'Intentar con lo disponible', desc: 'Responde con información parcial, indicando que puede faltar contexto' },
                          { id: 'escalate', label: 'Escalar al responsable', desc: 'Sugiere contactar a la persona responsable del área' },
                        ].map(opt => (
                          <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${aiCfg.unknown_behavior === opt.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            <input type="radio" name="unknown_behavior" value={opt.id}
                              checked={aiCfg.unknown_behavior === opt.id}
                              onChange={() => updateAiCfg('unknown_behavior', opt.id)}
                              className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <p className={`text-sm font-semibold ${aiCfg.unknown_behavior === opt.id ? 'text-indigo-700' : 'text-gray-800'}`}>{opt.label}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Auto-save */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Guardado automático de conocimiento</label>
                      <div className="space-y-2">
                        {[
                          { id: 'always', label: 'Siempre automático', desc: 'Guarda sin pedir confirmación' },
                          { id: 'confirm', label: 'Pedir confirmación', desc: 'Pregunta antes de guardar cada entrada' },
                          { id: 'never', label: 'Nunca automático', desc: 'Solo guarda cuando el usuario lo pide explícitamente' },
                        ].map(opt => (
                          <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${aiCfg.auto_save === opt.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            <input type="radio" name="auto_save" value={opt.id}
                              checked={aiCfg.auto_save === opt.id}
                              onChange={() => updateAiCfg('auto_save', opt.id)}
                              className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <p className={`text-sm font-semibold ${aiCfg.auto_save === opt.id ? 'text-indigo-700' : 'text-gray-800'}`}>{opt.label}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Advanced */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setAdvancedOpen(v => !v)}
                      className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <span>Configuración avanzada</span>
                      {advancedOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {advancedOpen && (
                      <div className="px-6 pb-6 space-y-6 border-t border-gray-100 pt-4">
                        {/* RAG threshold */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-sm font-semibold text-gray-700">Umbral de búsqueda semántica</label>
                            <span className="text-sm font-bold text-indigo-600">{aiCfg.rag_threshold.toFixed(2)}</span>
                          </div>
                          <input
                            type="range" min={0.3} max={0.8} step={0.05}
                            value={aiCfg.rag_threshold}
                            onChange={e => updateAiCfg('rag_threshold', parseFloat(e.target.value))}
                            className="w-full accent-indigo-600"
                          />
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>Amplio</span><span>Preciso</span>
                          </div>
                        </div>

                        {/* Conversation window */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ventana de conversación</label>
                          <select value={aiCfg.max_messages} onChange={e => updateAiCfg('max_messages', parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                          >
                            <option value={10}>10 mensajes</option>
                            <option value={20}>20 mensajes</option>
                            <option value={30}>30 mensajes</option>
                          </select>
                        </div>

                        {/* Tools toggle */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Herramientas habilitadas</p>
                            <p className="text-xs text-gray-400">Permite al asistente leer y escribir en la base de conocimiento</p>
                          </div>
                          <button
                            onClick={() => updateAiCfg('tools_enabled', !aiCfg.tools_enabled)}
                            className={`w-11 h-6 rounded-full transition-colors relative ${aiCfg.tools_enabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
                          >
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${aiCfg.tools_enabled ? 'translate-x-5' : ''}`} />
                          </button>
                        </div>

                        {/* System prompt */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-sm font-semibold text-gray-700">Instrucciones del sistema</label>
                            <button
                              onClick={() => {
                                setPromptUnlocked(v => !v)
                                if (!promptUnlocked) updateAiCfg('system_prompt_manual', true)
                                else updateAiCfg('system_prompt_manual', false)
                              }}
                              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                              {promptUnlocked ? 'Usar configuración guiada' : 'Editar manualmente'}
                            </button>
                          </div>
                          {aiCfg.system_prompt_manual && (
                            <div className="flex items-center gap-2 mb-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              <AlertTriangle size={13} />
                              Editar manualmente sobreescribe la configuración guiada
                            </div>
                          )}
                          <textarea
                            value={aiCfg.system_prompt}
                            onChange={e => updateAiCfg('system_prompt', e.target.value)}
                            readOnly={!promptUnlocked}
                            rows={6}
                            className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-colors ${promptUnlocked ? 'bg-white' : 'bg-gray-50 text-gray-500 cursor-default'}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Estado del modelo</p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Modelo principal</span>
                        <span className="flex items-center gap-2 font-semibold text-gray-800">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />GPT-4o
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Modelo de respaldo</span>
                        <span className="flex items-center gap-2 font-medium text-gray-400">
                          <span className="w-2 h-2 rounded-full bg-gray-300" />Claude Sonnet
                        </span>
                      </div>
                      {aiUpdatedAt && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Última actualización</span>
                          <span className="text-gray-500">{new Date(aiUpdatedAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button onClick={handleSaveAi} disabled={savingAi}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 shadow-sm transition-colors"
                  >
                    <Save size={15} />
                    {savingAi ? 'Guardando...' : 'Guardar configuración'}
                  </button>
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

              {/* ── WHATSAPP ── */}
              {activeTab === 'whatsapp' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-gray-950 tracking-tight mb-1">Nukor for WhatsApp</h2>
                    <p className="text-sm text-gray-500">Permite que miembros de tu equipo consulten el asistente directamente desde WhatsApp.</p>
                  </div>

                  {/* How it works */}
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">¿Cómo funciona?</p>
                    <ol className="space-y-2">
                      {[
                        'Agrega el número de un miembro de tu equipo.',
                        'El sistema le enviará un código de activación por WhatsApp.',
                        'Una vez que confirme el código, podrá consultar al asistente desde WhatsApp.',
                        'El contexto de cada conversación se mantiene por 24 horas.',
                      ].map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-indigo-800">
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Plan gate */}
                  {currentPlan !== null && !['pro', 'enterprise'].includes(currentPlan) && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex gap-3 items-start">
                      <Smartphone size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-indigo-800">Nukor for WhatsApp requiere el plan Pro</p>
                        <p className="text-xs text-indigo-600 mt-0.5">Actualiza tu plan para agregar miembros y conectar el asistente a WhatsApp.</p>
                      </div>
                      <button
                        onClick={() => router.push('/dashboard/settings?tab=plan')}
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0"
                      >
                        Ver planes
                      </button>
                    </div>
                  )}

                  {/* Members list */}
                  <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden ${currentPlan !== null && !['pro', 'enterprise'].includes(currentPlan) ? 'opacity-40 pointer-events-none select-none' : ''}`}>
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-950">Miembros registrados</p>
                        {currentPlan === 'pro' && (
                          <p className="text-xs text-gray-400 mt-0.5">{phoneMembers.length} / 50</p>
                        )}
                      </div>
                      <button
                        onClick={() => setShowAddPhone(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <Plus size={13} /> Agregar número
                      </button>
                    </div>

                    {loadingPhoneMembers ? (
                      <div className="py-10 flex justify-center">
                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : phoneMembers.length === 0 ? (
                      <div className="py-12 flex flex-col items-center gap-2 text-center">
                        <Smartphone size={28} className="text-gray-300" />
                        <p className="text-sm font-medium text-gray-400">Sin miembros registrados</p>
                        <p className="text-xs text-gray-400">Agrega un número para empezar</p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {phoneMembers.map(m => (
                          <li key={m.id} className="flex items-center gap-4 px-5 py-3.5">
                            <div className="w-9 h-9 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <Smartphone size={16} className="text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-950 truncate">{m.name}</p>
                              <p className="text-xs text-gray-400 font-mono">{m.phone_number}</p>
                            </div>
                            {m.activated ? (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                <CheckCircle size={11} /> Activo
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                <Clock size={11} /> Pendiente
                              </span>
                            )}
                            <button
                              onClick={() => handleRemovePhoneMember(m.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Config note */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                    <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-700 mb-1">Requiere configuración del sistema</p>
                      <p className="text-xs text-amber-600">Para activar WhatsApp necesitas configurar <code className="bg-amber-100 px-1 rounded">META_WHATSAPP_TOKEN</code>, <code className="bg-amber-100 px-1 rounded">META_PHONE_NUMBER_ID</code>, <code className="bg-amber-100 px-1 rounded">META_APP_SECRET</code> y <code className="bg-amber-100 px-1 rounded">META_WEBHOOK_VERIFY_TOKEN</code> en tus variables de entorno.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Add phone member modal */}
              {showAddPhone && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                  <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
                      <h2 className="text-base font-semibold text-gray-950">Agregar número de WhatsApp</h2>
                      <button onClick={() => setShowAddPhone(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
                    </div>
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
                        <input
                          type="text"
                          value={newPhoneName}
                          onChange={e => setNewPhoneName(e.target.value)}
                          placeholder="Juan Pérez"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Número de teléfono</label>
                        <input
                          type="tel"
                          value={newPhoneNumber}
                          onChange={e => setNewPhoneNumber(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddPhoneMember()}
                          placeholder="+5491112345678"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                        />
                        <p className="text-xs text-gray-400 mt-1">Formato internacional con código de país</p>
                      </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                      <button onClick={() => setShowAddPhone(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg">Cancelar</button>
                      <button
                        onClick={handleAddPhoneMember}
                        disabled={addingPhone || !newPhoneName.trim() || !newPhoneNumber.trim()}
                        className="px-5 py-2 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-60"
                      >
                        {addingPhone ? 'Enviando código...' : 'Enviar código de activación'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default function AssistantSettingsPage() {
  return (
    <Suspense>
      <AssistantSettingsContent />
    </Suspense>
  )
}
