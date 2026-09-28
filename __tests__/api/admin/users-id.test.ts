import { NextRequest } from 'next/server'
import { PATCH, DELETE } from '@/app/api/admin/users/[id]/route'
import { requireAdminApi } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as rolesModule from '@/lib/roles'

jest.mock('@/lib/auth', () => ({
  requireAdminApi: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/lib/admin-user-service', () => ({
  setUserPassword: jest.fn().mockResolvedValue({ success: true, userId: 'u-1' }),
  sendPasswordResetLink: jest.fn().mockResolvedValue({ message: 'Reset email dispatched' }),
}))

const mockRequireAdminApi = requireAdminApi as jest.MockedFunction<typeof requireAdminApi>

describe('PATCH & DELETE /api/admin/users/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(rolesModule, 'getEnvAdminEmails').mockReturnValue(['admin@env.com'])
    jest.spyOn(rolesModule, 'getEnvFinanceEmails').mockReturnValue(['finance@env.com'])
  })

  describe('PATCH /api/admin/users/[id]', () => {
    it('returns 401 JSON when caller is unauthenticated', async () => {
      mockRequireAdminApi.mockResolvedValueOnce({
        error: {
          status: 401,
          json: async () => ({ error: 'Unauthorized: Session missing or expired. Please sign in.' }),
        } as any,
      })

      const req = new NextRequest('http://localhost:3000/api/admin/users/user-1', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'ADMIN' }),
      })

      const res = await PATCH(req, { params: Promise.resolve({ id: 'user-1' }) })
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error).toContain('Unauthorized')
    })

    it('returns 403 JSON when ADMIN caller attempts to modify a FINANCE user', async () => {
      mockRequireAdminApi.mockResolvedValueOnce({
        session: { user: { id: 'admin-id', email: 'admin@env.com' } } as any,
        role: 'ADMIN',
        email: 'admin@env.com',
      })

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'fin-user-id',
        email: 'finance@other.com',
        name: 'Finance User',
        mobile: null,
        createdAt: new Date(),
        _count: { orders: 0 },
      })

      jest.spyOn(rolesModule, 'getEffectiveRole').mockResolvedValueOnce('FINANCE')
      jest.spyOn(rolesModule, 'canManageTargetRole').mockReturnValueOnce(false)

      const req = new NextRequest('http://localhost:3000/api/admin/users/fin-user-id', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'ADMIN' }),
      })

      const res = await PATCH(req, { params: Promise.resolve({ id: 'fin-user-id' }) })
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toContain('Forbidden: Admins cannot modify Finance users')
    })

    it('allows FINANCE caller to change role of server env FINANCE_EMAILS user', async () => {
      mockRequireAdminApi.mockResolvedValueOnce({
        session: { user: { id: 'fin-boss-id', email: 'finance@env.com' } } as any,
        role: 'FINANCE',
        email: 'finance@env.com',
      })

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'fin-env-user-id',
        email: 'finance@env.com',
        name: 'Root Finance',
        mobile: null,
        createdAt: new Date(),
        _count: { orders: 0 },
      })

      jest.spyOn(rolesModule, 'getEffectiveRole').mockResolvedValueOnce('FINANCE')
      jest.spyOn(rolesModule, 'canManageTargetRole').mockReturnValue(true)
      const assignDynamicRoleSpy = jest.spyOn(rolesModule, 'assignDynamicRole').mockResolvedValueOnce({
        id: 'role-env',
        email: 'finance@env.com',
        role: 'ADMIN',
        createdBy: 'finance@env.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      ;(prisma.user.update as jest.Mock).mockResolvedValueOnce({
        id: 'fin-env-user-id',
        email: 'finance@env.com',
        name: 'Root Finance',
        mobile: null,
        createdAt: new Date(),
        _count: { orders: 0 },
      })

      const req = new NextRequest('http://localhost:3000/api/admin/users/fin-env-user-id', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'ADMIN' }),
      })

      const res = await PATCH(req, { params: Promise.resolve({ id: 'fin-env-user-id' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.role).toBe('ADMIN')
      expect(assignDynamicRoleSpy).toHaveBeenCalledWith('finance@env.com', 'ADMIN', 'finance@env.com')
    })

    it('allows FINANCE caller to change a dynamic finance user to ADMIN', async () => {
      mockRequireAdminApi.mockResolvedValueOnce({
        session: { user: { id: 'fin-boss-id', email: 'finance@env.com' } } as any,
        role: 'FINANCE',
        email: 'finance@env.com',
      })

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'dyn-fin-id',
        email: 'dynfin@vairis.com',
        name: 'Dynamic Finance',
        mobile: null,
        createdAt: new Date('2026-01-01'),
        _count: { orders: 0 },
      })

      jest.spyOn(rolesModule, 'getEffectiveRole').mockResolvedValueOnce('FINANCE')
      jest.spyOn(rolesModule, 'canManageTargetRole').mockReturnValue(true)
      const assignDynamicRoleSpy = jest.spyOn(rolesModule, 'assignDynamicRole').mockResolvedValueOnce({
        id: 'role-1',
        email: 'dynfin@vairis.com',
        role: 'ADMIN',
        createdBy: 'finance@env.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      ;(prisma.user.update as jest.Mock).mockResolvedValueOnce({
        id: 'dyn-fin-id',
        email: 'dynfin@vairis.com',
        name: 'Dynamic Finance',
        mobile: null,
        createdAt: new Date('2026-01-01'),
        _count: { orders: 0 },
      })

      const req = new NextRequest('http://localhost:3000/api/admin/users/dyn-fin-id', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'ADMIN' }),
      })

      const res = await PATCH(req, { params: Promise.resolve({ id: 'dyn-fin-id' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.role).toBe('ADMIN')
      expect(assignDynamicRoleSpy).toHaveBeenCalledWith('dynfin@vairis.com', 'ADMIN', 'finance@env.com')
    })

    it('returns 500 JSON when unexpected exception occurs without crashing Next.js', async () => {
      mockRequireAdminApi.mockResolvedValueOnce({
        session: { user: { id: 'fin-boss-id', email: 'finance@env.com' } } as any,
        role: 'FINANCE',
        email: 'finance@env.com',
      })

      ;(prisma.user.findUnique as jest.Mock).mockRejectedValueOnce(new Error('Database connection dropped'))

      const req = new NextRequest('http://localhost:3000/api/admin/users/any-id', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'ADMIN' }),
      })

      const res = await PATCH(req, { params: Promise.resolve({ id: 'any-id' }) })
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Database connection dropped')
    })
  })

  describe('DELETE /api/admin/users/[id]', () => {
    it('returns 403 JSON when ADMIN caller tries to delete a FINANCE user', async () => {
      mockRequireAdminApi.mockResolvedValueOnce({
        session: { user: { id: 'admin-id', email: 'admin@env.com' } } as any,
        role: 'ADMIN',
        email: 'admin@env.com',
      })

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'fin-id',
        email: 'finance@corp.com',
        _count: { orders: 0 },
      })

      jest.spyOn(rolesModule, 'getEffectiveRole').mockResolvedValueOnce('FINANCE')
      jest.spyOn(rolesModule, 'canManageTargetRole').mockReturnValueOnce(false)

      const req = new NextRequest('http://localhost:3000/api/admin/users/fin-id', {
        method: 'DELETE',
      })

      const res = await DELETE(req, { params: Promise.resolve({ id: 'fin-id' }) })
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toContain('Forbidden: Admins cannot delete Finance users')
    })

    it('returns 400 JSON when trying to delete user with existing orders', async () => {
      mockRequireAdminApi.mockResolvedValueOnce({
        session: { user: { id: 'fin-boss-id', email: 'finance@env.com' } } as any,
        role: 'FINANCE',
        email: 'finance@env.com',
      })

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'cust-id',
        email: 'customer@buyer.com',
        _count: { orders: 3 },
      })

      jest.spyOn(rolesModule, 'getEffectiveRole').mockResolvedValueOnce('USER')
      jest.spyOn(rolesModule, 'canManageTargetRole').mockReturnValueOnce(true)

      const req = new NextRequest('http://localhost:3000/api/admin/users/cust-id', {
        method: 'DELETE',
      })

      const res = await DELETE(req, { params: Promise.resolve({ id: 'cust-id' }) })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('Cannot delete user with 3 order(s)')
    })
  })
})
