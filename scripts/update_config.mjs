import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function updateConfig() {
  console.log('--- Updating ai_config ---')
  const workspaceId = '00000000-0000-0000-0000-000000000001'
  
  const { data: ws, error: fetchError } = await supabase
    .from('workspaces')
    .select('ai_config')
    .eq('id', workspaceId)
    .single()

  if (fetchError) {
    console.error('Error fetching workspace:', fetchError)
    return
  }

  const currentConfig = ws.ai_config || {}
  const newConfig = {
    ...currentConfig,
    max_messages: 20
  }

  const { error: updateError } = await supabase
    .from('workspaces')
    .update({ ai_config: newConfig })
    .eq('id', workspaceId)

  if (updateError) {
    console.error('Error updating config:', updateError)
  } else {
    console.log('Successfully updated ai_config with max_messages: 20')
  }
}

updateConfig()
