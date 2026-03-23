'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/dashboard/Sidebar'
import {
  MessageSquare,
  BookOpen,
  Layers,
  Grid,
  Users,
  TrendingUp,
  Menu,
  RefreshCw,
  Lock,
  Copy,
  Check,
} from 'lucide-react'

interface Stats {
  conversations: { total: number; today: number; avgPerDay: number; last30Total: number }
  knowledge: { areas: number; collections: number; entries: number }
  members: number
  activity: { date: string; count: number }[]
}

interface OverviewClientProps {
  userName: string
  userEmail: string
  workspaceName: string
  workspaceId: string
  systemRole: string | null
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-950 tracking-tight">{value}</p>
        <p className="text-sm font-medium text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className="flex-1 h-full flex items-end">
      <div
        className="w-full rounded-t-sm bg-indigo-500 transition-all"
        style={{ height: `${Math.max(pct, 4)}%`, opacity: value === 0 ? 0.2 : 1 }}
      />
    </div>
  )
}

function AccessDenied({ userEmail }: { userEmail: string }) {
  const [copied, setCopied] = useState(false)
  const sql = `-- Ejecuta esto en el SQL Editor de Supabase:\nALTER TABLE profiles ADD COLUMN IF NOT EXISTS system_role TEXT;\nUPDATE profiles SET system_role = 'super_admin' WHERE email = '${userEmail}';`

  const handleCopy = () => {
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-5">
          <Lock size={28} className="text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-950 mb-2">Acceso restringido</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          El dashboard de administración requiere el rol <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-indigo-600">super_admin</code>.
          <br />
          Tu cuenta (<strong>{userEmail}</strong>) aún no tiene este rol asignado.
        </p>

        <div className="bg-gray-950 rounded-xl p-4 text-left mb-3 relative">
          <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap leading-relaxed">{sql}</pre>
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 transition-colors"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>

        <p className="text-xs text-gray-400">
          1. Ve al <strong>SQL Editor</strong> en tu proyecto de Supabase<br />
          2. Pega y ejecuta el comando de arriba<br />
          3. Recarga esta página
        </p>

        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors"
        >
          Recargar página
        </button>
      </div>
    </div>
  )
}

export default function OverviewClient({
  userName,
  userEmail,
  workspaceName,
  workspaceId: _workspaceId,
  systemRole,
}: OverviewClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(systemRole === 'super_admin')
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/stats')
      if (!res.ok) throw new Error('Error al cargar estadísticas')
      setStats(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (systemRole === 'super_admin') fetchStats()
  }, [systemRole])

  const maxActivity = stats ? Math.max(...stats.activity.map(a => a.count), 1) : 1

  const today = new Date().toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="h-screen flex overflow-hidden bg-[#F1F3F6]">
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

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="flex-shrink-0 h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 text-gray-400" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-base font-bold text-gray-950 leading-tight">Dashboard</h1>
              <p className="text-xs text-gray-400 capitalize">{today}</p>
            </div>
          </div>
          {systemRole === 'super_admin' && (
            <button
              onClick={fetchStats}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              title="Actualizar datos"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {systemRole !== 'super_admin' ? (
            <AccessDenied userEmail={userEmail} />
          ) : loading ? (
            <div className="max-w-5xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-36 bg-white/60 animate-pulse rounded-2xl border border-gray-100" />
                ))}
              </div>
              <div className="h-64 bg-white/60 animate-pulse rounded-2xl border border-gray-100" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          ) : stats && (
            <div className="max-w-5xl mx-auto space-y-8">

              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard
                  icon={<MessageSquare size={20} className="text-indigo-600" />}
                  label="Conversaciones totales"
                  value={stats.conversations.total}
                  color="bg-indigo-50"
                />
                <StatCard
                  icon={<TrendingUp size={20} className="text-emerald-600" />}
                  label="Conversaciones hoy"
                  value={stats.conversations.today}
                  color="bg-emerald-50"
                />
                <StatCard
                  icon={<TrendingUp size={20} className="text-sky-600" />}
                  label="Promedio por día"
                  value={stats.conversations.avgPerDay}
                  sub="Últimos 30 días"
                  color="bg-sky-50"
                />
                <StatCard
                  icon={<BookOpen size={20} className="text-violet-600" />}
                  label="Entradas de conocimiento"
                  value={stats.knowledge.entries}
                  color="bg-violet-50"
                />
                <StatCard
                  icon={<Users size={20} className="text-amber-600" />}
                  label="Miembros activos"
                  value={stats.members}
                  color="bg-amber-50"
                />
              </div>

              {/* Second row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  icon={<Layers size={20} className="text-rose-600" />}
                  label="Áreas"
                  value={stats.knowledge.areas}
                  color="bg-rose-50"
                />
                <StatCard
                  icon={<Grid size={20} className="text-orange-600" />}
                  label="Colecciones"
                  value={stats.knowledge.collections}
                  color="bg-orange-50"
                />
                <StatCard
                  icon={<MessageSquare size={20} className="text-teal-600" />}
                  label="Conversaciones (30 días)"
                  value={stats.conversations.last30Total}
                  sub={`~${stats.conversations.avgPerDay} por día`}
                  color="bg-teal-50"
                />
              </div>

              {/* Activity chart */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-950">Actividad — últimos 30 días</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Conversaciones iniciadas por día</p>
                  </div>
                  <span className="text-2xl font-bold text-gray-950">{stats.conversations.last30Total}</span>
                </div>

                <div className="flex items-end gap-px h-24">
                  {stats.activity.map((day) => (
                    <div key={day.date} className="flex-1 h-full group relative" title={`${day.date}: ${day.count}`}>
                      <MiniBar value={day.count} max={maxActivity} />
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-[10px] rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                        {day.count}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-medium">
                  <span>{stats.activity[0]?.date.slice(5)}</span>
                  <span>{stats.activity[14]?.date.slice(5)}</span>
                  <span>{stats.activity[29]?.date.slice(5)}</span>
                </div>
              </div>

              {/* Role badge */}
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-full font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
                  super_admin
                </span>
                <span>{userEmail}</span>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  )
}
