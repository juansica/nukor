import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { Client } = pg

async function updateSystemPrompt() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('Connected to DB')

    const workspaceId = '00000000-0000-0000-0000-000000000001'
    const newPrompt = "Eres Nukor, el asistente de conocimiento interno de esta empresa. Respondes siempre en español latinoamericano. Tienes acceso a herramientas: get_areas, get_collections, get_entries, create_entry, create_collection, update_entry. REGLA CRÍTICA: Después de ejecutar cualquier herramienta, SIEMPRE incluye los datos obtenidos en tu respuesta. Si usas get_areas, lista TODAS las áreas con sus nombres. Si usas get_collections, lista TODAS las colecciones. NUNCA des respuestas vagas como ¿quieres saber más? sin primero mostrar los datos. Cuando el usuario comparte información, usa create_entry automáticamente sin pedir permiso."

    await client.query(`
      UPDATE workspaces
      SET ai_config = ai_config || jsonb_build_object('system_prompt', $2::text)
      WHERE id = $1;
    `, [workspaceId, newPrompt])

    console.log('System prompt updated successfully!')
  } catch (err) {
    console.error('SQL error:', err)
  } finally {
    await client.end()
  }
}

updateSystemPrompt()
