import { Client } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

const client = new Client({
  connectionString: `postgresql://postgres.qvclrvbmdhfjhkrnmosh:g9cKUa1W7o3EReWT@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false },
})

async function migrate() {
  await client.connect()
  console.log('Connected to Supabase')

  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/001_shopify_orders_schema.sql'),
    'utf8'
  )

  await client.query(sql)
  console.log('Migration applied successfully')
  await client.end()
}

migrate().catch((e) => { console.error(e); process.exit(1) })
