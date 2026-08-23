import { checkPincodeServiceability, __resetServiceabilityCache } from '@/lib/shipping/sequel247-validate'

const originalFetch = global.fetch

describe('checkPincodeServiceability', () => {
  beforeEach(() => {
    process.env.SEQUEL247_TOKEN = 'test-token'
    process.env.SEQUEL247_BASE_URL = 'https://test.sequel247.com'
    __resetServiceabilityCache()
  })
  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('returns city/state for a serviceable pincode', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'true',
        data: { city: 'BELGAUM', state: 'KARNATAKA' },
      }),
    }) as unknown as typeof fetch

    const result = await checkPincodeServiceability('560078')
    expect(result).toEqual({ ok: true, city: 'BELGAUM', state: 'KARNATAKA' })
  })

  it('returns not_found for an unserviceable pincode', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'false', message: 'Pincode not found.', errorInfo: [] }),
    }) as unknown as typeof fetch

    const result = await checkPincodeServiceability('000000')
    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('soft-fails (skipped) when the network call throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout')) as unknown as typeof fetch

    const result = await checkPincodeServiceability('560078')
    expect(result).toEqual({ ok: true, skipped: true })
  })

  it('caches per pincode — second call does not hit fetch again', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'true', data: { city: 'BELGAUM', state: 'KARNATAKA' } }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await checkPincodeServiceability('560078')
    await checkPincodeServiceability('560078')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not cache a skipped (soft-fail) result — retries next call', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'true', data: { city: 'BELGAUM', state: 'KARNATAKA' } }),
      })
    global.fetch = fetchMock as unknown as typeof fetch

    const first = await checkPincodeServiceability('560078')
    expect(first).toEqual({ ok: true, skipped: true })
    const second = await checkPincodeServiceability('560078')
    expect(second).toEqual({ ok: true, city: 'BELGAUM', state: 'KARNATAKA' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('soft-fails on a non-ok HTTP status without throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }) as unknown as typeof fetch

    const result = await checkPincodeServiceability('560078')
    expect(result).toEqual({ ok: true, skipped: true })
  })
})
