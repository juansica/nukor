'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { CheckCircle2, RefreshCcw, Unplug, Plug } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'

function ConnectedToast({ onConnected, redirectTo }: { onConnected: () => void; redirectTo: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      toast.success('¡Fuente conectada exitosamente!')
      router.replace(redirectTo)
      onConnected()
    }
  }, [searchParams])

  return null
}

interface Connection {
  id: string
  name: string
  type: string
  enabled: boolean
  lastSyncedAt: Date | null
  syncing: boolean | null
  partition?: string | null
}

const CONNECTORS = [
  { id: 'google_drive', label: 'Google Drive', emoji: '📁', description: 'Sincroniza documentos de Google Drive' },
  { id: 'notion', label: 'Notion', emoji: '📝', description: 'Sincroniza páginas y bases de datos de Notion' },
  { id: 'confluence', label: 'Confluence', emoji: '📚', description: 'Sincroniza espacios y páginas de Confluence' },
  { id: 'onedrive', label: 'OneDrive', emoji: '💼', description: 'Sincroniza archivos de Microsoft OneDrive' },
  { id: 'salesforce', label: 'Salesforce', emoji: '📊', description: 'Sincroniza registros de Salesforce' },
  { id: 'slack', label: 'Slack', emoji: '💬', description: 'Sincroniza mensajes y canales de Slack' },
  { id: 'gmail', label: 'Gmail', emoji: '✉️', description: 'Sincroniza correos de Gmail' },
  { id: 'jira', label: 'Jira', emoji: '🎯', description: 'Sincroniza tickets e incidencias de Jira' },
]

interface IntegrationsTabProps {
  workspaceId: string
  redirectTo?: string
}

export default function IntegrationsTab({ workspaceId, redirectTo = '/dashboard/settings?tab=integrations' }: IntegrationsTabProps) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  const fetchConnections = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/integrations?workspace_id=${workspaceId}`)
      if (res.ok) {
        const data = await res.json()
        setConnections(data.connections ?? [])
      }
    } catch (err) {
      console.error('Error fetching connections:', err)
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    if (workspaceId) fetchConnections()
  }, [fetchConnections])

  const handleConnect = async (provider: string) => {
    setConnecting(provider)
    try {
      const res = await fetch('/api/integrations/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, workspaceId }),
      })
      if (!res.ok) throw new Error('Failed to create connection')
      const { authUrl } = await res.json()
      window.location.href = authUrl
    } catch {
      toast.error('Error al conectar la fuente. Inténtalo de nuevo.')
      setConnecting(null)
    }
  }

  const handleDisconnect = async (connectionId: string) => {
    setDisconnecting(connectionId)
    try {
      const res = await fetch('/api/integrations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })
      if (!res.ok) throw new Error('Failed to delete connection')
      toast.success('Fuente desconectada')
      setConnections(prev => prev.filter(c => c.id !== connectionId))
    } catch {
      toast.error('Error al desconectar. Inténtalo de nuevo.')
    } finally {
      setDisconnecting(null)
    }
  }

  const getConnectorMeta = (type: string) =>
    CONNECTORS.find(c => c.id === type) ?? { id: type, label: type, emoji: '🔌', description: '' }

  const connectedTypes = new Set(connections.map(c => c.type))

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Nunca sincronizado'
    const d = new Date(date)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diff < 60) return 'hace menos de 1 minuto'
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} minutos`
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} horas`
    return `hace ${Math.floor(diff / 86400)} días`
  }

  return (
    <div>
      <Suspense>
        <ConnectedToast onConnected={fetchConnections} redirectTo={redirectTo} />
      </Suspense>

      <h2 className="text-lg font-bold text-gray-950 tracking-tight mb-1">Integraciones</h2>
      <p className="text-sm text-gray-500 mb-6">Conecta tus fuentes de datos para sincronizarlas automáticamente con Nukor.</p>

      {/* Connected sources */}
      {connections.length > 0 && (
        <section className="mb-8">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Fuentes conectadas</h3>
          <div className="space-y-3">
            {connections.map(conn => {
              const meta = getConnectorMeta(conn.type)
              const isDisconnecting = disconnecting === conn.id
              return (
                <div key={conn.id} className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
                  <span className="text-2xl">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-950">{conn.name || meta.label}</p>
                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <CheckCircle2 size={12} />
                        Conectado
                      </span>
                      {conn.syncing && (
                        <span className="flex items-center gap-1 text-xs text-indigo-500 font-medium">
                          <RefreshCcw size={12} className="animate-spin" />
                          Sincronizando
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Última sincronización: {formatLastSync(conn.lastSyncedAt)}</p>
                  </div>
                  <button
                    onClick={() => handleDisconnect(conn.id)}
                    disabled={isDisconnecting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Unplug size={13} />
                    {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Available connectors */}
      <section>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          {connections.length > 0 ? 'Añadir más fuentes' : 'Fuentes disponibles'}
        </h3>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CONNECTORS.filter(c => !connectedTypes.has(c.id)).map(connector => {
              const isConnecting = connecting === connector.id
              return (
                <div key={connector.id} className="flex items-start gap-4 bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 hover:border-indigo-200 hover:shadow-sm transition-all">
                  <span className="text-2xl mt-0.5">{connector.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-950">{connector.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{connector.description}</p>
                  </div>
                  <button
                    onClick={() => handleConnect(connector.id)}
                    disabled={isConnecting || !!connecting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 whitespace-nowrap mt-0.5 shadow-sm"
                  >
                    <Plug size={12} />
                    {isConnecting ? 'Redirigiendo...' : 'Conectar'}
                  </button>
                </div>
              )
            })}
            {CONNECTORS.filter(c => !connectedTypes.has(c.id)).length === 0 && (
              <p className="col-span-2 text-sm text-gray-400 py-4 text-center">Todas las fuentes disponibles están conectadas.</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
