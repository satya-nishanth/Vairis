import fs from 'fs'
import path from 'path'
import { getSupabaseAdmin } from './supabase-admin'
import { prisma } from './prisma'

export type UserRole = 'USER' | 'ADMIN' | 'FINANCE'

export interface RoleAssignmentRecord {
  id: string
  email: string
  role: UserRole
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
 * Read dynamic roles persisted in data/roles.json.
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
 * Precedence:
 * 1. Explicit dashboard dynamic assignment (roles.json) wins.
 * 2. Baseline fallback: server environment variables (ADMIN_EMAILS / FINANCE_EMAILS).
 * 3. Supabase Auth app_metadata.
 */
export async function refreshRoleCache(): Promise<CachedRoles> {
  const adminEmails = new Set<string>()
  const financeEmails = new Set<string>()

  // 1. Load env variables as baseline defaults
  for (const f of getEnvFinanceEmails()) {
    financeEmails.add(f)
    adminEmails.add(f)
  }
  for (const a of getEnvAdminEmails()) {
    adminEmails.add(a)
  }

  // 2. Read persistent dynamic assignments (takes precedence over env defaults)
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
      financeEmails.delete(e) // explicitly demoted or set as ADMIN
    } else if (a.role === 'USER') {
      adminEmails.delete(e)
      financeEmails.delete(e) // explicitly revoked
    }
  }

  // 3. Query Supabase Auth app_metadata if accessible
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
          financeEmails.delete(e)
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

/**
 * Synchronous check for Admin access (used by UI helpers / sync callers).
 * Fallback guarantees cold workers / servers recognize newly assigned dynamic roles.
 */
export function isCachedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const lower = email.trim().toLowerCase()

  // 1. Check active cache
  if (roleCache && Date.now() < roleCache.expiresAt) {
    return roleCache.adminEmails.has(lower)
  }

  // 2. Synchronous file fallback
  const fileAssignments = readRolesFile()
  const assignment = fileAssignments.find((a) => a.email.toLowerCase() === lower)
  if (assignment) {
    return assignment.role === 'ADMIN' || assignment.role === 'FINANCE'
  }

  // 3. Fallback to environment variables
  return getEnvAdminEmails().includes(lower) || getEnvFinanceEmails().includes(lower)
}

/**
 * Synchronous check for Finance access (used by layout and navigation).
 */
export function isCachedFinanceEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const lower = email.trim().toLowerCase()

  // 1. Check active cache
  if (roleCache && Date.now() < roleCache.expiresAt) {
    return roleCache.financeEmails.has(lower)
  }

  // 2. Synchronous file fallback
  const fileAssignments = readRolesFile()
  const assignment = fileAssignments.find((a) => a.email.toLowerCase() === lower)
  if (assignment) {
    return assignment.role === 'FINANCE'
  }

  // 3. Fallback to environment variables
  return getEnvFinanceEmails().includes(lower)
}

/**
 * Asynchronously resolve the effective role of an email address.
 * Precedence:
 * 1. Dynamic assignments (from dashboard / roles.json / Supabase)
 * 2. Environment variables baseline (FINANCE_EMAILS -> FINANCE, ADMIN_EMAILS -> ADMIN)
 * 3. Default: USER
 */
export async function getEffectiveRole(email: string | null | undefined): Promise<UserRole> {
  if (!email) return 'USER'
  const lower = email.trim().toLowerCase()

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
  role: UserRole,
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

  // Ensure Prisma user exists so foreign keys and directory listings work seamlessly
  try {
    await prisma.user.upsert({
      where: { email: lower },
      update: {},
      create: {
        email: lower,
        name: lower.split('@')[0],
      },
    })
  } catch (dbErr) {
    console.warn('[roles.assignDynamicRole] prisma user upsert warning:', dbErr)
  }

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
  const existingIdx = assignments.findIndex((a) => a.email.toLowerCase() === lower)

  // If email is also in env variables, we must record role: 'USER' to override the env baseline!
  const isEnv = getEnvAdminEmails().includes(lower) || getEnvFinanceEmails().includes(lower)

  let updated: RoleAssignmentRecord[]
  if (isEnv) {
    const record: RoleAssignmentRecord = {
      id: existingIdx >= 0 ? assignments[existingIdx].id : `role_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      email: lower,
      role: 'USER',
      createdBy: 'Dashboard Revocation',
      createdAt: existingIdx >= 0 ? assignments[existingIdx].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    if (existingIdx >= 0) {
      assignments[existingIdx] = record
      updated = assignments
    } else {
      updated = [...assignments, record]
    }
  } else {
    updated = assignments.filter((a) => a.email.toLowerCase() !== lower)
  }

  writeRolesFile(updated)

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
