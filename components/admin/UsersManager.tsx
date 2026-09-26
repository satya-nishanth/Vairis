'use client'

import React, { useState, useMemo } from 'react'

export type UserRole = 'USER' | 'ADMIN' | 'FINANCE'

export interface UserRow {
  id: string
  name: string
  email: string
  mobile: string | null
  role: UserRole
  createdAt: string
  orderCount: number
  isEnvAdmin: boolean
  isEnvFinance: boolean
  canManage: boolean
}

export interface RoleEmailEntry {
  email: string
  source: 'env' | 'database'
  id?: string
  name?: string
  userId?: string
  createdBy?: string | null
  createdAt?: string
  isRemovable: boolean
}

interface UsersManagerProps {
  initialUsers: UserRow[]
  initialAdminEmails: RoleEmailEntry[]
  initialFinanceEmails: RoleEmailEntry[]
  callerRole: UserRole
  callerEmail: string
}

function generateSecurePassword(length = 16): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+'
  let pass = ''
  const array = new Uint32Array(length)
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array)
    for (let i = 0; i < length; i++) {
      pass += charset[array[i] % charset.length]
    }
  } else {
    for (let i = 0; i < length; i++) {
      pass += charset[Math.floor(Math.random() * charset.length)]
    }
  }
  return pass
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

async function parseJsonResponse<T = Record<string, any>>(
  res: Response,
): Promise<{ ok: boolean; status: number; data: T }> {
  const text = await res.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { error: text || `Server returned error (${res.status} ${res.statusText || 'Error'})` }
  }
  return { ok: res.ok, status: res.status, data }
}

export function UsersManager({
  initialUsers,
  initialAdminEmails,
  initialFinanceEmails,
  callerRole,
  callerEmail,
}: UsersManagerProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'admin_emails' | 'finance_emails'>('users')
  const [users, setUsers] = useState<UserRow[]>(initialUsers)
  const [adminEmails, setAdminEmails] = useState<RoleEmailEntry[]>(initialAdminEmails)
  const [financeEmails, setFinanceEmails] = useState<RoleEmailEntry[]>(initialFinanceEmails)

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL')

  // Notification message
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // User modal state (create or edit)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    role: 'USER' as UserRole,
    password: '',
  })
  const [showFormPassword, setShowFormPassword] = useState(false)
  const [isSubmittingUser, setIsSubmittingUser] = useState(false)

  // Password Modal state
  const [passwordModalUser, setPasswordModalUser] = useState<UserRow | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPasswordText, setShowPasswordText] = useState(false)
  const [isSettingPassword, setIsSettingPassword] = useState(false)
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Add Role Email modal state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [targetRoleToAdd, setTargetRoleToAdd] = useState<'ADMIN' | 'FINANCE'>('ADMIN')
  const [roleEmailInput, setRoleEmailInput] = useState('')
  const [isSubmittingRole, setIsSubmittingRole] = useState(false)

  function showMsg(type: 'success' | 'error', message: string) {
    setNotification({ type, message })
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr))
    }, 6000)
  }

  function copyToClipboard(text: string, key = 'password') {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2500)
    })
  }

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.mobile && u.mobile.includes(q))
      )
    })
  }, [users, roleFilter, searchQuery])

  // --- Handlers for User Modal ---
  function openCreateUserModal() {
    setEditingUser(null)
    setUserFormData({
      name: '',
      email: '',
      mobile: '',
      role: 'USER',
      password: '',
    })
    setShowFormPassword(false)
    setIsUserModalOpen(true)
  }

  function openEditUserModal(user: UserRow) {
    setEditingUser(user)
    setUserFormData({
      name: user.name,
      email: user.email,
      mobile: user.mobile || '',
      role: user.role,
      password: '',
    })
    setShowFormPassword(false)
    setIsUserModalOpen(true)
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmittingUser(true)

    try {
      if (editingUser) {
        // PATCH
        const res = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: userFormData.name.trim(),
            email: userFormData.email.trim(),
            mobile: userFormData.mobile.trim() || null,
            role: userFormData.role,
          }),
        })
        const { ok, data } = await parseJsonResponse(res)
        if (!ok) throw new Error(data.error || 'Failed to update user')

        setUsers((prev) =>
          prev.map((u) => (u.id === editingUser.id ? ({ ...u, ...data, canManage: true } as UserRow) : u)),
        )
        // Refresh role email lists if role changed
        if (userFormData.role !== editingUser.role) {
          fetchRoles()
        }
        showMsg('success', `User ${data.email} updated successfully.`)
      } else {
        // POST
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: userFormData.name.trim(),
            email: userFormData.email.trim(),
            mobile: userFormData.mobile.trim() || null,
            role: userFormData.role,
            password: userFormData.password ? userFormData.password.trim() : null,
          }),
        })
        const { ok, data } = await parseJsonResponse(res)
        if (!ok) throw new Error(data.error || 'Failed to create user')

        const createdUser: UserRow = {
          id: data.id,
          name: data.name || userFormData.name.trim(),
          email: data.email || userFormData.email.trim(),
          mobile: data.mobile ?? null,
          role: data.role || userFormData.role,
          createdAt: data.createdAt || new Date().toISOString(),
          orderCount: 0,
          isEnvAdmin: false,
          isEnvFinance: false,
          canManage: true,
        }
        setUsers((prev) => [createdUser, ...prev])
        if (data.role === 'ADMIN' || data.role === 'FINANCE') {
          fetchRoles()
        }
        showMsg(
          'success',
          `User created successfully! ${data.passwordSet ? 'Password was set.' : ''} ${data.passwordWarning || ''}`,
        )
      }
      setIsUserModalOpen(false)
    } catch (err: unknown) {
      showMsg('error', err instanceof Error ? err.message : 'Operation failed')
    } finally {
      setIsSubmittingUser(false)
    }
  }

  // --- Handlers for Password Modal ---
  function openPasswordModal(user: UserRow) {
    setPasswordModalUser(user)
    setNewPassword(generateSecurePassword())
    setShowPasswordText(true)
    setGeneratedLink(null)
  }

  async function handleDirectSetPassword() {
    if (!passwordModalUser) return
    if (!newPassword || newPassword.trim().length < 6) {
      showMsg('error', 'Password must be at least 6 characters.')
      return
    }

    setIsSettingPassword(true)
    try {
      const res = await fetch(`/api/admin/users/${passwordModalUser.id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set',
          password: newPassword.trim(),
        }),
      })
      const { ok, data } = await parseJsonResponse(res)
      if (!ok) throw new Error(data.error || 'Failed to set password')

      showMsg('success', data.message || 'Password successfully set.')
    } catch (err: unknown) {
      showMsg('error', err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setIsSettingPassword(false)
    }
  }

  async function handleSendResetEmail() {
    if (!passwordModalUser) return

    setIsSendingReset(true)
    setGeneratedLink(null)
    try {
      const res = await fetch(`/api/admin/users/${passwordModalUser.id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset',
        }),
      })
      const { ok, data } = await parseJsonResponse(res)
      if (!ok) throw new Error(data.error || 'Failed to trigger reset')

      if (data.recoveryLink) {
        setGeneratedLink(data.recoveryLink)
      }
      showMsg('success', data.message || 'Password reset link dispatched.')
    } catch (err: unknown) {
      showMsg('error', err instanceof Error ? err.message : 'Failed to send reset link')
    } finally {
      setIsSendingReset(false)
    }
  }

  // --- Handlers for Role Emails ---
  async function fetchRoles() {
    try {
      const res = await fetch('/api/admin/roles')
      const { ok, data } = await parseJsonResponse(res)
      if (ok) {
        setAdminEmails(data.adminList || [])
        setFinanceEmails(data.financeList || [])
      }
    } catch (err) {
      console.error('Failed to refresh roles', err)
    }
  }

  async function handleAddRoleEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!roleEmailInput.trim()) return

    setIsSubmittingRole(true)
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: roleEmailInput.trim().toLowerCase(),
          role: targetRoleToAdd,
        }),
      })
      const { ok, data } = await parseJsonResponse(res)
      if (!ok) throw new Error(data.error || 'Failed to assign role')

      showMsg('success', data.message || 'Role assigned successfully.')
      setIsRoleModalOpen(false)
      setRoleEmailInput('')
      await fetchRoles()
      // Also update user list in memory
      setUsers((prev) =>
        prev.map((u) =>
          u.email.toLowerCase() === roleEmailInput.trim().toLowerCase()
            ? { ...u, role: targetRoleToAdd }
            : u,
        ),
      )
    } catch (err: unknown) {
      showMsg('error', err instanceof Error ? err.message : 'Failed to assign role')
    } finally {
      setIsSubmittingRole(false)
    }
  }

  async function handleRevokeRoleEmail(email: string, roleName: string) {
    if (!confirm(`Are you sure you want to revoke ${roleName} access for ${email}?`)) {
      return
    }

    try {
      const res = await fetch('/api/admin/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const { ok, data } = await parseJsonResponse(res)
      if (!ok) throw new Error(data.error || 'Failed to revoke role')

      showMsg('success', data.message || `Revoked ${roleName} role from ${email}.`)
      await fetchRoles()
      setUsers((prev) =>
        prev.map((u) => (u.email.toLowerCase() === email.toLowerCase() ? { ...u, role: 'USER' } : u)),
      )
    } catch (err: unknown) {
      showMsg('error', err instanceof Error ? err.message : 'Failed to revoke role')
    }
  }

  const isFinanceUser = callerRole === 'FINANCE'

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: '4rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            Users & Roles Management
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                padding: '3px 8px',
                borderRadius: '4px',
                backgroundColor: isFinanceUser ? '#7e22ce' : '#2563eb',
                color: '#fff',
                textTransform: 'uppercase',
              }}
            >
              Your Role: {callerRole}
            </span>
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.375rem', marginBottom: 0 }}>
            Manage user accounts, set or reset credentials, and administer access delegation for Admin and Finance teams.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {activeTab === 'users' && (
            <button
              onClick={openCreateUserModal}
              style={{
                backgroundColor: '#111827',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              + Create User
            </button>
          )}

          {activeTab === 'admin_emails' && (
            <button
              onClick={() => {
                setTargetRoleToAdd('ADMIN')
                setRoleEmailInput('')
                setIsRoleModalOpen(true)
              }}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + Add Admin Email
            </button>
          )}

          {activeTab === 'finance_emails' && (
            <button
              onClick={() => {
                setTargetRoleToAdd('FINANCE')
                setRoleEmailInput('')
                setIsRoleModalOpen(true)
              }}
              disabled={!isFinanceUser}
              title={!isFinanceUser ? 'Only Finance users can assign Finance privileges' : ''}
              style={{
                backgroundColor: isFinanceUser ? '#7e22ce' : '#9ca3af',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: 500,
                border: 'none',
                cursor: isFinanceUser ? 'pointer' : 'not-allowed',
              }}
            >
              + Add Finance Email
            </button>
          )}
        </div>
      </div>

      {/* Delegation Policy Banner */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '1.5rem',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          fontSize: '0.8125rem',
          color: '#334155',
        }}
      >
        <span style={{ fontSize: '1.25rem' }}>🛡️</span>
        <div>
          <strong>Role Delegation Hierarchy:</strong>{' '}
          {isFinanceUser ? (
            <span>
              As a <strong>Finance Administrator</strong>, you possess full administrative privileges and can create, modify, or delegate permissions for <strong>Finance</strong>, <strong>Admin</strong>, and <strong>User</strong> roles.
            </span>
          ) : (
            <span>
              As an <strong>Admin</strong>, you can create and manage <strong>Admin</strong> and <strong>User</strong> accounts. Management of <strong>Finance</strong> accounts and assignment of Finance permissions is reserved exclusively for Finance team members.
            </span>
          )}
        </div>
      </div>

      {/* Notification Toast/Banner */}
      {notification && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            backgroundColor: notification.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${notification.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: notification.type === 'success' ? '#166534' : '#991b1b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem', gap: '2rem' }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '10px 4px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'users' ? '2px solid #111827' : '2px solid transparent',
            color: activeTab === 'users' ? '#111827' : '#6b7280',
            fontWeight: activeTab === 'users' ? 600 : 400,
            fontSize: '0.9375rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          All Users
          <span style={{ fontSize: '0.75rem', backgroundColor: '#f3f4f6', padding: '2px 7px', borderRadius: '12px' }}>
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('admin_emails')}
          style={{
            padding: '10px 4px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'admin_emails' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'admin_emails' ? '#2563eb' : '#6b7280',
            fontWeight: activeTab === 'admin_emails' ? 600 : 400,
            fontSize: '0.9375rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          Admin Emails (ADMIN_EMAILS)
          <span style={{ fontSize: '0.75rem', backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 7px', borderRadius: '12px' }}>
            {adminEmails.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('finance_emails')}
          style={{
            padding: '10px 4px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'finance_emails' ? '2px solid #7e22ce' : '2px solid transparent',
            color: activeTab === 'finance_emails' ? '#7e22ce' : '#6b7280',
            fontWeight: activeTab === 'finance_emails' ? 600 : 400,
            fontSize: '0.9375rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          Finance Emails (FINANCE_EMAILS)
          <span style={{ fontSize: '0.75rem', backgroundColor: '#f3e8ff', color: '#6b21a8', padding: '2px 7px', borderRadius: '12px' }}>
            {financeEmails.length}
          </span>
        </button>
      </div>

      {/* ─────────────────── TAB 1: ALL USERS ─────────────────── */}
      {activeTab === 'users' && (
        <div>
          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search by name, email, or mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: '1 1 280px',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem',
              }}
            />

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Role:</span>
              {(['ALL', 'FINANCE', 'ADMIN', 'USER'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    border: '1px solid',
                    borderColor: roleFilter === r ? '#111827' : '#e5e7eb',
                    backgroundColor: roleFilter === r ? '#111827' : '#ffffff',
                    color: roleFilter === r ? '#ffffff' : '#4b5563',
                    cursor: 'pointer',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 16px' }}>User / Email</th>
                  <th style={{ padding: '12px 16px' }}>Role</th>
                  <th style={{ padding: '12px 16px' }}>Contact</th>
                  <th style={{ padding: '12px 16px' }}>Orders</th>
                  <th style={{ padding: '12px 16px' }}>Created</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: '#9ca3af' }}>
                      No users found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = u.email.toLowerCase() === callerEmail.toLowerCase()
                    const cannotTouch = !u.canManage && !isFinanceUser

                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#111827' }}>
                            {u.name}{' '}
                            {isSelf && (
                              <span style={{ fontSize: '0.6875rem', color: '#059669', backgroundColor: '#ecfdf5', padding: '1px 6px', borderRadius: '4px' }}>
                                (You)
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{u.email}</div>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor:
                                u.role === 'FINANCE'
                                  ? '#f3e8ff'
                                  : u.role === 'ADMIN'
                                  ? '#dbeafe'
                                  : '#f3f4f6',
                              color:
                                u.role === 'FINANCE'
                                  ? '#6b21a8'
                                  : u.role === 'ADMIN'
                                  ? '#1e40af'
                                  : '#374151',
                            }}
                          >
                            {u.role === 'FINANCE' && '👑 '}
                            {u.role === 'ADMIN' && '🛡️ '}
                            {u.role}
                          </span>
                          {(u.isEnvAdmin || u.isEnvFinance) && (
                            <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '2px' }}>
                              Env Baseline
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.8125rem' }}>
                          {u.mobile || '—'}
                        </td>

                        <td style={{ padding: '12px 16px', color: '#374151', fontSize: '0.8125rem' }}>
                          {u.orderCount}
                        </td>

                        <td suppressHydrationWarning style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.8125rem' }}>
                          {formatDate(u.createdAt)}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            {/* Password Button */}
                            <button
                              onClick={() => openPasswordModal(u)}
                              disabled={cannotTouch}
                              title={
                                cannotTouch
                                  ? 'Only Finance users can modify Finance accounts'
                                  : 'Set password or send reset email'
                              }
                              style={{
                                padding: '4px 10px',
                                borderRadius: '4px',
                                border: '1px solid #d1d5db',
                                backgroundColor: '#ffffff',
                                color: cannotTouch ? '#9ca3af' : '#111827',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                cursor: cannotTouch ? 'not-allowed' : 'pointer',
                              }}
                            >
                              🔑 Password
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => openEditUserModal(u)}
                              disabled={cannotTouch}
                              title={
                                cannotTouch
                                  ? 'Only Finance users can modify Finance accounts'
                                  : 'Edit user details & role'
                              }
                              style={{
                                padding: '4px 10px',
                                borderRadius: '4px',
                                border: '1px solid #d1d5db',
                                backgroundColor: '#ffffff',
                                color: cannotTouch ? '#9ca3af' : '#111827',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                cursor: cannotTouch ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────── TAB 2: ADMIN EMAILS ─────────────────── */}
      {activeTab === 'admin_emails' && (
        <div>
          <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px', marginBottom: '1.25rem', fontSize: '0.8125rem', color: '#1e40af' }}>
            <strong>Admin Access Whitelist:</strong> Users with these email addresses are granted administrative dashboard access to manage catalog, orders, and site configurations.
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 16px' }}>Email Address</th>
                  <th style={{ padding: '12px 16px' }}>User Name</th>
                  <th style={{ padding: '12px 16px' }}>Source</th>
                  <th style={{ padding: '12px 16px' }}>Added By</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminEmails.map((entry) => (
                  <tr key={entry.email} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: '#111827' }}>
                      {entry.email}
                    </td>

                    <td style={{ padding: '12px 16px', color: '#4b5563', fontSize: '0.8125rem' }}>
                      {entry.name || '—'}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: entry.source === 'env' ? '#dbeafe' : '#f0fdf4',
                          color: entry.source === 'env' ? '#1e40af' : '#166534',
                        }}
                      >
                        {entry.source === 'env' ? 'Environment Variable (Static)' : 'Database Assignment (Dynamic)'}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.8125rem' }}>
                      {entry.source === 'env' ? 'Config / deployment' : entry.createdBy || 'Dashboard'}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {entry.isRemovable ? (
                        <button
                          onClick={() => handleRevokeRoleEmail(entry.email, 'Admin')}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #fecaca',
                            backgroundColor: '#fff',
                            color: '#dc2626',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          Revoke
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Protected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────── TAB 3: FINANCE EMAILS ─────────────────── */}
      {activeTab === 'finance_emails' && (
        <div>
          <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '12px 16px', marginBottom: '1.25rem', fontSize: '0.8125rem', color: '#6b21a8' }}>
            <strong>Finance Access Whitelist:</strong> Users with these email addresses possess root financial oversight, banking/ledger transactions, purchase bills, and role delegation control.
            {!isFinanceUser && (
              <div style={{ marginTop: '6px', fontWeight: 600, color: '#b91c1c' }}>
                Note: You are currently viewing in read-only mode. Only Finance team members can add or revoke Finance emails.
              </div>
            )}
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 16px' }}>Email Address</th>
                  <th style={{ padding: '12px 16px' }}>User Name</th>
                  <th style={{ padding: '12px 16px' }}>Source</th>
                  <th style={{ padding: '12px 16px' }}>Added By</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {financeEmails.map((entry) => (
                  <tr key={entry.email} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: '#111827' }}>
                      👑 {entry.email}
                    </td>

                    <td style={{ padding: '12px 16px', color: '#4b5563', fontSize: '0.8125rem' }}>
                      {entry.name || '—'}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: entry.source === 'env' ? '#f3e8ff' : '#f0fdf4',
                          color: entry.source === 'env' ? '#6b21a8' : '#166534',
                        }}
                      >
                        {entry.source === 'env' ? 'Environment Variable (Static)' : 'Database Assignment (Dynamic)'}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.8125rem' }}>
                      {entry.source === 'env' ? 'Config / deployment' : entry.createdBy || 'Dashboard'}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {entry.isRemovable ? (
                        <button
                          onClick={() => handleRevokeRoleEmail(entry.email, 'Finance')}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #fecaca',
                            backgroundColor: '#fff',
                            color: '#dc2626',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          Revoke
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Protected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────── MODAL: CREATE / EDIT USER ─────────────────── */}
      {isUserModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxWidth: 480,
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
              {editingUser ? 'Edit User Details' : 'Create New User'}
            </h3>

            <form onSubmit={handleSaveUser}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#4b5563', marginBottom: 4 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#4b5563', marginBottom: 4 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#4b5563', marginBottom: 4 }}>
                  Mobile (10 Digits)
                </label>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="9876543210"
                  value={userFormData.mobile}
                  onChange={(e) => setUserFormData({ ...userFormData, mobile: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#4b5563', marginBottom: 4 }}>
                  Role Permission
                </label>
                <select
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as UserRole })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value="USER">
                    User / Customer (Standard Access)
                  </option>
                  <option value="ADMIN">
                    Admin (Catalog, Orders, Operations)
                  </option>
                  <option value="FINANCE" disabled={!isFinanceUser}>
                    Finance (Ledger, Settlements, Audits) {!isFinanceUser ? '— (Finance Admins Only)' : ''}
                  </option>
                </select>
                {!isFinanceUser && (
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '4px 0 0' }}>
                    * Finance role assignment requires root Finance privileges.
                  </p>
                )}
              </div>

              {!editingUser && (
                <div style={{ marginBottom: 16, backgroundColor: '#f9fafb', padding: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#4b5563' }}>
                      Initial Password (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const pass = generateSecurePassword()
                        setUserFormData({ ...userFormData, password: pass })
                        setShowFormPassword(true)
                      }}
                      style={{ fontSize: '0.75rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Generate Secure
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type={showFormPassword ? 'text' : 'password'}
                      placeholder="Minimum 6 characters"
                      value={userFormData.password}
                      onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormPassword(!showFormPassword)}
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      {showFormPassword ? 'Hide' : 'Show'}
                    </button>
                    {userFormData.password && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(userFormData.password, 'formPass')}
                        style={{ padding: '6px 10px', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        {copiedKey === 'formPass' ? '✓ Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  style={{ padding: '8px 16px', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    backgroundColor: '#111827',
                    color: '#fff',
                    borderRadius: 4,
                    cursor: isSubmittingUser ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  {isSubmittingUser ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────── MODAL: PASSWORD MANAGEMENT ─────────────────── */}
      {passwordModalUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxWidth: 520,
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
                  Manage Password
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                  For user: <strong>{passwordModalUser.name}</strong> ({passwordModalUser.email})
                </p>
              </div>
              <button
                onClick={() => setPasswordModalUser(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }}
              >
                ✕
              </button>
            </div>

            {/* Section A: Direct Password Set */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 16, marginBottom: 16, backgroundColor: '#f9fafb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827' }}>
                  Option 1: Set New Password Directly
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setNewPassword(generateSecurePassword())
                    setShowPasswordText(true)
                  }}
                  style={{ fontSize: '0.75rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Generate Strong Password
                </button>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter or generate password"
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordText(!showPasswordText)}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {showPasswordText ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(newPassword, 'modalPass')}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {copiedKey === 'modalPass' ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              <button
                type="button"
                onClick={handleDirectSetPassword}
                disabled={isSettingPassword}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  border: 'none',
                  backgroundColor: '#111827',
                  color: '#ffffff',
                  borderRadius: 4,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: isSettingPassword ? 'not-allowed' : 'pointer',
                }}
              >
                {isSettingPassword ? 'Updating Password...' : 'Save & Set This Password'}
              </button>
            </div>

            {/* Section B: Email Recovery / Reset Link */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 16 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                Option 2: Send Password Reset Link
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 12px' }}>
                Sends a secure password reset email through Supabase Auth, or creates a one-time recovery URL you can copy directly.
              </p>

              <button
                type="button"
                onClick={handleSendResetEmail}
                disabled={isSendingReset}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  borderRadius: 4,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: isSendingReset ? 'not-allowed' : 'pointer',
                }}
              >
                {isSendingReset ? 'Sending Reset Link...' : '✉️ Send Reset Email'}
              </button>

              {generatedLink && (
                <div style={{ marginTop: 12, padding: 10, backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 4 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#065f46', marginBottom: 4 }}>
                    One-time Recovery Link Generated:
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="text"
                      readOnly
                      value={generatedLink}
                      style={{ flex: 1, padding: '4px 8px', fontSize: '0.6875rem', border: '1px solid #6ee7b7', borderRadius: 4, backgroundColor: '#fff' }}
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(generatedLink, 'recLink')}
                      style={{ padding: '4px 10px', fontSize: '0.75rem', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      {copiedKey === 'recLink' ? '✓ Copied' : 'Copy Link'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setPasswordModalUser(null)}
                style={{ padding: '8px 16px', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── MODAL: ADD ROLE EMAIL ─────────────────── */}
      {isRoleModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxWidth: 440,
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
              Add {targetRoleToAdd} Whitelist Email
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
              Add an authorized email to grant {targetRoleToAdd} privileges. If the user creates an account or logs in with this email, they will automatically receive this role.
            </p>

            <form onSubmit={handleAddRoleEmail}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#4b5563', marginBottom: 4 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="team.member@example.com"
                  value={roleEmailInput}
                  onChange={(e) => setRoleEmailInput(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  style={{ padding: '8px 16px', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRole}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    backgroundColor: targetRoleToAdd === 'FINANCE' ? '#7e22ce' : '#2563eb',
                    color: '#fff',
                    borderRadius: 4,
                    cursor: isSubmittingRole ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  {isSubmittingRole ? 'Saving...' : `Add to ${targetRoleToAdd} List`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
