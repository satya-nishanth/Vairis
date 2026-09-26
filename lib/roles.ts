import fs from 'fs'
import path from 'path'
import { getSupabaseAdmin } from './supabase-admin'

export type UserRole = 'USER' | 'ADMIN' | 'FINANCE'

export interface RoleAssignmentRecord {
  id: string
  email: string
  role: 'ADMIN' | 'FINANCE'
  createdBy?: string | null
  createdAt: string
  updatedAt: string
}

type CachedRoles = {
  adminEmails: Set<string>
  financeEmails: Set<string>
  assignments: RoleAssignmentRecord[]
  expiresAt: number
}

let roleCache: CachedRoles | null = null

const ROLES_FILE_PATH = path.join(process.cwd(), 'data', 'roles.json')

export function invalidateRoleCache(): void {
  roleCache = null
}

export function getEnvAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function getEnvFinanceEmails(): string[] {
  return (process.env.FINANCE_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Read dynamic roles persisted in data/roles.json (fallback persistent store).
 */
function readRolesFile(): RoleAssignmentRecord[] {
  try {
    if (!fs.existsSync(ROLES_FILE_PATH)) {
      return []
    }
    const raw = fs.readFileSync(ROLES_FILE_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
    }
    if (parsed && Array.isArray(parsed.assignments)) {
      return parsed.assignments
    }
    return []
  } catch (err) {
    console.warn('[roles.readRolesFile] could not read data/roles.json', err)
    return []
  }
}

/**
 * Write dynamic roles to data/roles.json.
 */
function writeRolesFile(assignments: RoleAssignmentRecord[]): void {
  try {
    const dir = path.dirname(ROLES_FILE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(
      ROLES_FILE_PATH,
      JSON.stringify({ assignments, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8',
    )
  } catch (err) {
    console.warn('[roles.writeRolesFile] could not write data/roles.json', err)
  }
}

/**
 * Refresh in-memory cache of dynamic & env roles (30s TTL).
 */
export async function refreshRoleCache(): Promise<CachedRoles> {
  const adminEmails = new Set<string>(getEnvAdminEmails())
  const financeEmails = new Set<string>(getEnvFinanceEmails())

  // Any finance email in env is automatically also an admin
  for (const f of financeEmails) {
    adminEmails.add(f)
  }

  // 1. Read persistent dynamic assignments
  const fileAssignments = readRolesFile()
  const assignmentMap = new Map<string, RoleAssignmentRecord>()

  for (const a of fileAssignments) {
    const e = a.email.toLowerCase()
    assignmentMap.set(e, a)
    if (a.role === 'FINANCE') {
      financeEmails.add(e)
      adminEmails.add(e)
    } else if (a.role === 'ADMIN') {
      adminEmails.add(e)
    }
  }

  // 2. Query Supabase Auth app_metadata if accessible
  try {
    const admin = getSupabaseAdmin()
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 })
    if (data?.users) {
      for (const u of data.users) {
        if (!u.email) continue
        const e = u.email.toLowerCase()
        const metaRole = (u.app_metadata?.role || u.user_metadata?.role || '').toString().toUpperCase()
        if (metaRole === 'FINANCE') {
          financeEmails.add(e)
          adminEmails.add(e)
          if (!assignmentMap.has(e)) {
            assignmentMap.set(e, {
              id: u.id,
              email: e,
              role: 'FINANCE',
              createdBy: 'Supabase Auth',
              createdAt: u.created_at || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
          }
        } else if (metaRole === 'ADMIN') {
          adminEmails.add(e)
          if (!assignmentMap.has(e)) {
            assignmentMap.set(e, {
              id: u.id,
              email: e,
              role: 'ADMIN',
              createdBy: 'Supabase Auth',
              createdAt: u.created_at || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
          }
        }
      }
    }
  } catch (err) {
    // Supabase auth service not reached or offline, fallback to env & file
  }

  roleCache = {
    adminEmails,
    financeEmails,
    assignments: Array.from(assignmentMap.values()),
    expiresAt: Date.now() + 30_000,
  }

  return roleCache
}

export function isCachedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const lower = email.trim().toLowerCase()
  if (getEnvAdminEmails().includes(lower) || getEnvFinanceEmails().includes(lower)) return true
  if (roleCache && Date.now() < roleCache.expiresAt) {
    return roleCache.adminEmails.has(lower)
  }
  return false
}

export function isCachedFinanceEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const lower = email.trim().toLowerCase()
  if (getEnvFinanceEmails().includes(lower)) return true
  if (roleCache && Date.now() < roleCache.expiresAt) {
    return roleCache.financeEmails.has(lower)
  }
  return false
}

/**
 * Asynchronously resolve the effective role of an email address.
 */
export async function getEffectiveRole(email: string | null | undefined): Promise<UserRole> {
  if (!email) return 'USER'
  const lower = email.trim().toLowerCase()

  // 1. Infallible root: env FINANCE_EMAILS
  if (getEnvFinanceEmails().includes(lower)) return 'FINANCE'

  // 2. Refresh / query cache
  const cache = await refreshRoleCache()
  if (cache.financeEmails.has(lower)) return 'FINANCE'
  if (cache.adminEmails.has(lower)) return 'ADMIN'

  return 'USER'
}

/**
 * Check whether caller has permission to grant, revoke, or mutate a target role.
 * Rule:
 * - FINANCE callers can manage USER, ADMIN, and FINANCE.
 * - ADMIN callers can only manage USER and ADMIN (they CANNOT touch FINANCE).
 * - USER callers have no management rights.
 */
export function canManageTargetRole(
  callerRole: UserRole,
  targetCurrentOrNewRole: UserRole,
): boolean {
  if (callerRole === 'FINANCE') return true
  if (callerRole === 'ADMIN') {
    return targetCurrentOrNewRole !== 'FINANCE'
  }
  return false
}

/**
 * Assign or update a dynamic role.
 */
export async function assignDynamicRole(
  email: string,
  role: 'ADMIN' | 'FINANCE',
  createdBy?: string,
): Promise<RoleAssignmentRecord> {
  const lower = email.trim().toLowerCase()
  const assignments = readRolesFile()
  const existingIdx = assignments.findIndex((a) => a.email.toLowerCase() === lower)

  const record: RoleAssignmentRecord = {
    id: existingIdx >= 0 ? assignments[existingIdx].id : `role_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: lower,
    role,
    createdBy: createdBy || 'Dashboard',
    createdAt: existingIdx >= 0 ? assignments[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  if (existingIdx >= 0) {
    assignments[existingIdx] = record
  } else {
    assignments.push(record)
  }

  writeRolesFile(assignments)

  // Also sync to Supabase Auth metadata if user exists
  try {
    const admin = getSupabaseAdmin()
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 })
    const found = data?.users?.find((u) => u.email?.toLowerCase() === lower)
    if (found) {
      await admin.auth.admin.updateUserById(found.id, {
        app_metadata: { role },
      })
    }
  } catch (err) {
    console.warn('[roles.assignDynamicRole] Supabase sync warning:', err)
  }

  invalidateRoleCache()
  return record
}

/**
 * Revoke a dynamic role assignment.
 */
export async function revokeDynamicRole(email: string): Promise<boolean> {
  const lower = email.trim().toLowerCase()
  const assignments = readRolesFile()
  const filtered = assignments.filter((a) => a.email.toLowerCase() !== lower)

  writeRolesFile(filtered)

  // Remove from Supabase Auth app_metadata
  try {
    const admin = getSupabaseAdmin()
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 })
    const found = data?.users?.find((u) => u.email?.toLowerCase() === lower)
    if (found) {
      await admin.auth.admin.updateUserById(found.id, {
        app_metadata: { role: 'USER' },
      })
    }
  } catch (err) {
    console.warn('[roles.revokeDynamicRole] Supabase sync warning:', err)
  }

  invalidateRoleCache()
  return true
}

/**
 * Retrieve all dynamic role assignment records.
 */
export async function getDynamicRoleAssignments(): Promise<RoleAssignmentRecord[]> {
  const cache = await refreshRoleCache()
  return cache.assignments
}
