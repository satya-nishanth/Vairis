/**
 * Create an admin user on cloud Supabase + print ADMIN_EMAILS line to add in Vercel.
 *
 * Setup:
 *   cp .env.prod.example .env.prod
 *   # fill PROD_SUPABASE_URL + PROD_SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   node scripts/create-cloud-admin.mjs --email newadmin@thevairis.com --password 'SecurePass1!'
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}

loadEnvFile(resolve(ROOT, '.env.prod'))

const args = process.argv.slice(2)
function getArg(name) {
  const i = args.indexOf(name)
  return i === -1 ? null : args[i + 1]
}

const email = getArg('--email')?.trim().toLowerCase()
const password = getArg('--password')

const PROD_URL = process.env.PROD_SUPABASE_URL ?? 'https://ohnydotpayefvaurtiyy.supabase.co'
const PROD_KEY = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY

if (!email || !password) {
  console.error('Usage: node scripts/create-cloud-admin.mjs --email you@thevairis.com --password "YourPass1!"')
  process.exit(1)
}
if (password.length < 6) {
  console.error('Password must be at least 6 characters.')
  process.exit(1)
}
if (!PROD_KEY) {
  console.error('Missing PROD_SUPABASE_SERVICE_ROLE_KEY in .env.prod')
  console.error('Get it from: Supabase Dashboard → ohnydotpayefvaurtiyy → Settings → API → service_role')
  process.exit(1)
}

const supabase = createClient(PROD_URL, PROD_KEY, { auth: { persistSession: false } })

const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
const existing = list?.users?.find((u) => u.email?.toLowerCase() === email)

if (existing) {
  const { error } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  })
  if (error) {
    console.error('Update failed:', error.message)
    process.exit(1)
  }
  console.log(`Updated password for existing user: ${email}`)
} else {
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) {
    console.error('Create failed:', error.message)
    process.exit(1)
  }
  console.log(`Created user: ${email}`)
}

const current = (process.env.ADMIN_EMAILS ?? 'anil@thevairis.com,nish99.sn@gmail.com')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean)
if (!current.includes(email)) current.push(email)

console.log('\nAdd this to Vercel → Environment Variables → ADMIN_EMAILS (then redeploy):')
console.log(current.join(','))
console.log('\nLogin: https://vairis-ten.vercel.app/auth/admin')
