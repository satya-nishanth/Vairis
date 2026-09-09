import { addressSchema, partialAddressSchema } from '@/lib/address-schema'

const baseIndia = {
  contactName: 'Surya Teja',
  contactPhone: '9876543210',
  line1: 'Flat 101, Some Building',
  city: 'Hyderabad',
  state: 'Telangana',
  pincode: '502300',
}

describe('addressSchema', () => {
  it('accepts a valid India address with no country field (defaults to IN)', () => {
    const result = addressSchema.safeParse(baseIndia)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.country).toBe('IN')
  })

  it('accepts a valid India address with country explicitly "IN"', () => {
    const result = addressSchema.safeParse({ ...baseIndia, country: 'IN' })
    expect(result.success).toBe(true)
  })

  it('rejects a 9-digit phone number for an India address', () => {
    const result = addressSchema.safeParse({ ...baseIndia, contactPhone: '987654321' })
    expect(result.success).toBe(false)
  })

  it('rejects a 5-digit pincode for an India address', () => {
    const result = addressSchema.safeParse({ ...baseIndia, pincode: '50230' })
    expect(result.success).toBe(false)
  })

  it('accepts a non-10-digit phone and free-text pincode for an international address', () => {
    const result = addressSchema.safeParse({
      contactName: 'Jane Doe',
      contactPhone: '+1-415-555-0199',
      line1: '1 Market St',
      city: 'San Francisco',
      state: 'CA',
      pincode: '94105',
      country: 'United States',
    })
    expect(result.success).toBe(true)
  })

  it('still requires city/state/pincode to be non-empty for international addresses', () => {
    const result = addressSchema.safeParse({
      contactName: 'Jane Doe',
      contactPhone: '+1-415-555-0199',
      line1: '1 Market St',
      city: '',
      state: 'CA',
      pincode: '94105',
      country: 'United States',
    })
    expect(result.success).toBe(false)
  })

  it('partialAddressSchema accepts a partial payload without throwing', () => {
    expect(() => partialAddressSchema.safeParse({ pincode: '502300' })).not.toThrow()
    const result = partialAddressSchema.safeParse({ pincode: '502300' })
    expect(result.success).toBe(true)
  })
})
