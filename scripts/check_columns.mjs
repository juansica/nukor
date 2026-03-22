import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkColumns() {
  console.log('--- Checking workspaces columns ---')
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'workspaces' })
  
  if (error) {
    // If RPC doesn't exist, try a simple select
    console.log('RPC failed, trying select *')
    const { data: ws, error: selectError } = await supabase
      .from('workspaces')
      .select('*')
      .limit(1)
    
    if (selectError) {
      console.error('Select failed:', selectError)
    } else if (ws && ws.length > 0) {
      console.log('Columns found:', Object.keys(ws[0]))
    } else {
      console.log('No data found in workspaces')
    }
  } else {
    console.log('Columns:', data)
  }
}

checkColumns()
