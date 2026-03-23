'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/dashboard/Sidebar'
import IntegrationsTab from '@/components/settings/IntegrationsTab'
import { Menu } from 'lucide-react'

export default function IntegrationsPage() {
  const supabase = createClient()

  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [workspaceName, setWorkspaceName] = useState('Mi workspace')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario')
      setUserEmail(user.email ?? '')
      const { data: profile } = await supabase.from('profiles').select('last_workspace_id').eq('id', user.id).maybeSingle()
      if (profile?.last_workspace_id) {
        setWorkspaceId(profile.last_workspace_id)
        const { data: ws } = await supabase.from('workspaces').select('name').eq('id', profile.last_workspace_id).maybeSingle()
        if (ws?.name) setWorkspaceName(ws.name)
      }
    }
    init()
  }, [])

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
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

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-8">
            <button className="md:hidden p-2 text-gray-400" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
          </div>
          <Suspense>
            {workspaceId ? (
              <IntegrationsTab
                workspaceId={workspaceId}
                redirectTo="/dashboard/settings/integrations"
              />
            ) : (
              <div className="h-40 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </Suspense>
        </div>
      </main>
    </div>
  )
}
