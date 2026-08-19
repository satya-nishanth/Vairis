import { NextRequest } from 'next/server'
import { POST as createAddress } from '@/app/api/account/addresses/route'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/auth'
import { checkPincodeServiceability } from '@/lib/shipping/sequel247-validate'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    address: { count: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn((cb) => cb(prisma)),
  },
}))
jest.mock('@/lib/auth', () => ({ getAppUser: jest.fn() }))
jest.mock('@/lib/shipping/sequel247-validate', () => ({
  checkPincodeServiceability: jest.fn(),
}))

const mockAddress = prisma.address as jest.Mocked<typeof prisma.address>
const mockGetAppUser = getAppUser as jest.MockedFunction<typeof getAppUser>
const mockCheck = checkPincodeServiceability as jest.MockedFunction<typeof checkPincodeServiceability>

const fakeUser = { id: 'u1', email: 'customer@example.com' }
const validIndiaBody = {
  contactName: 'Surya Teja',
  contactPhone: '9876543210',
  line1: 'Flat 101, Some Building',
  city: 'Hyderabad',
  state: 'Telangana',
  pincode: '502300',
}

function req(body: unknown) {
  return new NextRequest('http://localhost/api/account/addresses', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/account/addresses', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAppUser.mockResolvedValue(fakeUser as never)
    mockAddress.count.mockResolvedValue(0)
    mockAddress.create.mockImplementation((args: never) => Promise.resolve({ id: 'a1', ...args.data }) as never)
  })

  it('saves a serviceable India address', async () => {
    mockCheck.mockResolvedValue({ ok: true, city: 'HYDERABAD', state: 'TELANGANA' })
    const res = await createAddress(req(validIndiaBody))
    expect(mockCheck).toHaveBeenCalledWith('502300')
    expect(res.status).toBe(201)
    expect(mockAddress.create).toHaveBeenCalled()
  })

  it('rejects an unserviceable India pincode', async () => {
    mockCheck.mockResolvedValue({ ok: false, reason: 'not_found' })
    const res = await createAddress(req(validIndiaBody))
    expect(res.status).toBe(400)
    expect(mockAddress.create).not.toHaveBeenCalled()
  })

  it('autofills city/state from Sequel247 when serviceable', async () => {
    mockCheck.mockResolvedValue({ ok: true, city: 'HYDERABAD', state: 'TELANGANA' })
    await createAddress(req({ ...validIndiaBody, city: 'hyd', state: 'ts' }))
    const createCall = mockAddress.create.mock.calls[0][0] as { data: { city: string; state: string } }
    expect(createCall.data.city).toBe('HYDERABAD')
    expect(createCall.data.state).toBe('TELANGANA')
  })

  it('does not autofill when the serviceability check was skipped (soft-fail)', async () => {
    mockCheck.mockResolvedValue({ ok: true, skipped: true })
    await createAddress(req({ ...validIndiaBody, city: 'Hyderabad', state: 'Telangana' }))
    const createCall = mockAddress.create.mock.calls[0][0] as { data: { city: string; state: string } }
    expect(createCall.data.city).toBe('Hyderabad')
    expect(createCall.data.state).toBe('Telangana')
  })

  it('skips the serviceability check for an international address', async () => {
    const res = await createAddress(
      req({
        contactName: 'Jane Doe',
        contactPhone: '+1-415-555-0199',
        line1: '1 Market St',
        city: 'San Francisco',
        state: 'CA',
        pincode: '94105',
        country: 'United States',
      }),
    )
    expect(mockCheck).not.toHaveBeenCalled()
    expect(res.status).toBe(201)
  })
})
