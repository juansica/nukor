import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { Client } = pg

async function runSql() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('Connected to DB')

    console.log('Adding column ai_config if not exists...')
    await client.query(`
      ALTER TABLE workspaces 
      ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{}'::jsonb;
    `)

    console.log('Updating max_messages...')
    const workspaceId = '00000000-0000-0000-0000-000000000001'
    await client.query(`
      UPDATE workspaces
      SET ai_config = ai_config || '{"max_messages": 20}'::jsonb
      WHERE id = $1;
    `, [workspaceId])

    console.log('Done!')
  } catch (err) {
    console.error('SQL error:', err)
  } finally {
    await client.end()
  }
}

runSql()
