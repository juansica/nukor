export const dynamic = 'force-dynamic'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check system_role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('last_workspace_id, system_role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.system_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const workspaceId = profile.last_workspace_id
    if (!workspaceId) {
      return Response.json({ error: 'No workspace' }, { status: 404 })
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Run all counts in parallel
    const [
      convTotal,
      convToday,
      convLast30,
      entriesCount,
      areasCount,
      collectionsCount,
      membersCount,
    ] = await Promise.all([
      supabaseAdmin.from('conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabaseAdmin.from('conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', todayStart),
      supabaseAdmin.from('conversations').select('created_at').eq('workspace_id', workspaceId).gte('created_at', thirtyDaysAgo),
      supabaseAdmin.from('entries').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).is('deleted_at', null),
      supabaseAdmin.from('areas').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabaseAdmin
        .from('collections')
        .select('areas!inner(workspace_id)', { count: 'exact', head: true })
        .eq('areas.workspace_id', workspaceId),
      supabaseAdmin.from('workspace_members').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    ])

    // Build daily activity map for last 30 days
    const dailyCounts: Record<string, number> = {}
    const last30Rows = convLast30.data ?? []
    for (const row of last30Rows) {
      const day = row.created_at.slice(0, 10)
      dailyCounts[day] = (dailyCounts[day] ?? 0) + 1
    }

    // Fill in zeros for days with no activity
    const activity: { date: string; count: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      activity.push({ date: key, count: dailyCounts[key] ?? 0 })
    }

    const totalLast30 = last30Rows.length
    const avgPerDay = Math.round((totalLast30 / 30) * 10) / 10

    return Response.json({
      conversations: {
        total: convTotal.count ?? 0,
        today: convToday.count ?? 0,
        avgPerDay,
        last30Total: totalLast30,
      },
      knowledge: {
        areas: areasCount.count ?? 0,
        collections: collectionsCount.count ?? 0,
        entries: entriesCount.count ?? 0,
      },
      members: membersCount.count ?? 0,
      activity,
    })
  } catch (err) {
    console.error('[dashboard/stats]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
