import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function diagnostic() {
  console.log('--- Ultimas 10 entradas ---')
  const { data: entries, error } = await supabase
    .from('entries')
    .select('id, title, workspace_id, created_at, embedding')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error fetching entries:', error)
    return
  }

  entries.forEach(e => {
    console.log(`ID: ${e.id} | Workspace: ${e.workspace_id} | Title: ${e.title} | Embedding: ${e.embedding ? 'HAS EMBEDDING' : 'NO EMBEDDING'}`)
  })
}

diagnostic()
