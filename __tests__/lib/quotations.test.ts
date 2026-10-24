import { generateQuotationDisplayId, createWithUniqueDisplayId, QUOTATION_TRANSITIONS } from '@/lib/quotations'
import { Prisma } from '@prisma/client'

describe('generateQuotationDisplayId', () => {
  it('produces a Q-XXXX id even with no customer info at all', () => {
    const id = generateQuotationDisplayId({})
    expect(id).toMatch(/^Q-[0-9A-Z]{4}$/)
  })

  it('produces a different id for different seeds', () => {
    const a = generateQuotationDisplayId({ customerName: 'Asha', customerMobile: '9876543210' })
    const b = generateQuotationDisplayId({ customerName: 'Kiran', customerMobile: '9123456780' })
    expect(a).not.toBe(b)
  })

  it('produces consistent format with partial info', () => {
    const id1 = generateQuotationDisplayId({ customerName: 'Ram' })
    const id2 = generateQuotationDisplayId({ customerMobile: '9876543210' })
    const id3 = generateQuotationDisplayId({ sku: 'GOLD-001' })
    expect(id1).toMatch(/^Q-[0-9A-Z]{4}$/)
    expect(id2).toMatch(/^Q-[0-9A-Z]{4}$/)
    expect(id3).toMatch(/^Q-[0-9A-Z]{4}$/)
  })
})

describe('createWithUniqueDisplayId', () => {
  function p2002() {
    return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    })
  }

  it('returns the created record on the first successful attempt', async () => {
    const create = jest.fn(async (displayId: string) => ({ id: '1', displayId }))
    const result = await createWithUniqueDisplayId({}, create)
    expect(result.id).toBe('1')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('retries with a new displayId on a unique constraint violation', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(p2002())
      .mockRejectedValueOnce(p2002())
      .mockResolvedValueOnce({ id: '1', displayId: 'Q-ABCD' })
    const result = await createWithUniqueDisplayId({}, create)
    expect(result.id).toBe('1')
    expect(create).toHaveBeenCalledTimes(3)
  })

  it('gives up after 5 attempts of persistent conflicts', async () => {
    const create = jest.fn().mockRejectedValue(p2002())
    await expect(createWithUniqueDisplayId({}, create)).rejects.toThrow()
    expect(create).toHaveBeenCalledTimes(5)
  })

  it('rethrows immediately on a non-conflict error', async () => {
    const create = jest.fn().mockRejectedValue(new Error('db down'))
    await expect(createWithUniqueDisplayId({}, create)).rejects.toThrow('db down')
    expect(create).toHaveBeenCalledTimes(1)
  })
})

describe('QUOTATION_TRANSITIONS', () => {
  it('allows REQUESTED to move to QUOTED or CANCELLED only', () => {
    expect(QUOTATION_TRANSITIONS.REQUESTED).toEqual(['QUOTED', 'CANCELLED'])
  })

  it('allows QUOTED to re-quote, accept, or cancel (convert requires ACCEPTED)', () => {
    expect(QUOTATION_TRANSITIONS.QUOTED).toEqual(['QUOTED', 'ACCEPTED', 'CANCELLED'])
  })

  it('allows ACCEPTED to convert, cancel, or return to QUOTED', () => {
    expect(QUOTATION_TRANSITIONS.ACCEPTED).toEqual(['CONVERTED', 'CANCELLED', 'QUOTED'])
  })

  it('has no transitions out of terminal states', () => {
    expect(QUOTATION_TRANSITIONS.CONVERTED).toBeUndefined()
    expect(QUOTATION_TRANSITIONS.CANCELLED).toBeUndefined()
  })
})

