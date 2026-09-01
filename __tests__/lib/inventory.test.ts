import { InventoryError, inventoryDisplayName } from '@/lib/inventory'

describe('inventoryDisplayName', () => {
  it('uses product name when linked', () => {
    expect(
      inventoryDisplayName({
        customName: null,
        product: { name: 'Heart Solitaire' },
        variant: { sku: 'VR-R-1', metalType: 'GOLD_18K', size: '12' },
      }),
    ).toContain('Heart Solitaire')
    expect(
      inventoryDisplayName({
        customName: null,
        product: { name: 'Heart Solitaire' },
        variant: { sku: 'VR-R-1', metalType: 'GOLD_18K', size: '12' },
      }),
    ).toContain('VR-R-1')
  })

  it('uses custom name when unlinked', () => {
    expect(
      inventoryDisplayName({
        customName: 'Custom kada',
        product: null,
        variant: null,
      }),
    ).toBe('Custom kada')
  })
})

describe('InventoryError', () => {
  it('carries code', () => {
    const err = new InventoryError('INSUFFICIENT', 'nope')
    expect(err.code).toBe('INSUFFICIENT')
    expect(err.message).toBe('nope')
  })
})
