import { getShippingProvider } from '@/lib/shipping'

describe('getShippingProvider', () => {
  const original = process.env.SHIPPING_PROVIDER

  afterEach(() => {
    if (original === undefined) delete process.env.SHIPPING_PROVIDER
    else process.env.SHIPPING_PROVIDER = original
  })

  it('returns the configured provider when no country is given', () => {
    process.env.SHIPPING_PROVIDER = 'sequel247'
    expect(getShippingProvider().name).toBe('sequel247')
  })

  it('returns the configured provider for an India order', () => {
    process.env.SHIPPING_PROVIDER = 'sequel247'
    expect(getShippingProvider('IN').name).toBe('sequel247')
  })

  it('always returns manual for a non-IN order, even when SHIPPING_PROVIDER=sequel247', () => {
    process.env.SHIPPING_PROVIDER = 'sequel247'
    expect(getShippingProvider('United States').name).toBe('manual')
  })

  it('always returns manual for a non-IN order regardless of which provider is configured', () => {
    process.env.SHIPPING_PROVIDER = 'dtdc'
    expect(getShippingProvider('United States').name).toBe('manual')
  })
})
