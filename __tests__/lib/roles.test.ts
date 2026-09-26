import {
  canManageTargetRole,
  getEffectiveRole,
  assignDynamicRole,
  revokeDynamicRole,
  invalidateRoleCache,
} from '@/lib/roles'

jest.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({
    auth: {
      admin: {
        listUsers: jest.fn().mockResolvedValue({ data: { users: [] } }),
        updateUserById: jest.fn().mockResolvedValue({}),
      },
    },
  }),
}))

describe('canManageTargetRole delegation rules', () => {
  it('allows FINANCE callers to manage all roles (USER, ADMIN, FINANCE)', () => {
    expect(canManageTargetRole('FINANCE', 'USER')).toBe(true)
    expect(canManageTargetRole('FINANCE', 'ADMIN')).toBe(true)
    expect(canManageTargetRole('FINANCE', 'FINANCE')).toBe(true)
  })

  it('allows ADMIN callers to manage USER and ADMIN roles only', () => {
    expect(canManageTargetRole('ADMIN', 'USER')).toBe(true)
    expect(canManageTargetRole('ADMIN', 'ADMIN')).toBe(true)
  })

  it('PREVENTS ADMIN callers from granting or managing FINANCE role', () => {
    expect(canManageTargetRole('ADMIN', 'FINANCE')).toBe(false)
  })

  it('PREVENTS USER callers from managing any roles', () => {
    expect(canManageTargetRole('USER', 'USER')).toBe(false)
    expect(canManageTargetRole('USER', 'ADMIN')).toBe(false)
    expect(canManageTargetRole('USER', 'FINANCE')).toBe(false)
  })
})

describe('getEffectiveRole and dynamic role assignment', () => {
  beforeEach(async () => {
    invalidateRoleCache()
    process.env.ADMIN_EMAILS = 'admin@thevairis.com'
    process.env.FINANCE_EMAILS = 'finance@thevairis.com'
    await revokeDynamicRole('dynamicfinance@thevairis.com')
    await revokeDynamicRole('dynamicadmin@thevairis.com')
  })

  it('resolves env FINANCE_EMAILS as FINANCE', async () => {
    const role = await getEffectiveRole('finance@thevairis.com')
    expect(role).toBe('FINANCE')
  })

  it('resolves env ADMIN_EMAILS as ADMIN', async () => {
    const role = await getEffectiveRole('admin@thevairis.com')
    expect(role).toBe('ADMIN')
  })

  it('resolves unlisted email as USER', async () => {
    const role = await getEffectiveRole('customer@example.com')
    expect(role).toBe('USER')
  })

  it('allows dynamic assignment and revocation of roles', async () => {
    await assignDynamicRole('dynamicfinance@thevairis.com', 'FINANCE', 'test')
    expect(await getEffectiveRole('dynamicfinance@thevairis.com')).toBe('FINANCE')

    await assignDynamicRole('dynamicadmin@thevairis.com', 'ADMIN', 'test')
    expect(await getEffectiveRole('dynamicadmin@thevairis.com')).toBe('ADMIN')

    await revokeDynamicRole('dynamicfinance@thevairis.com')
    expect(await getEffectiveRole('dynamicfinance@thevairis.com')).toBe('USER')
  })
})
