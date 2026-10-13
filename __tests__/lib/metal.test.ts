import {
  buildMetalSku,
  formatMetalLabel,
  formatMetalShort,
  goldRateKey,
  metalFilterLabels,
} from '@/lib/metal'

describe('lib/metal', () => {
  it('formats labels', () => {
    expect(formatMetalLabel('GOLD_18K', 'YELLOW')).toBe('18K Yellow Gold')
    expect(formatMetalLabel('GOLD_18K', 'ROSE')).toBe('18K Rose Gold')
    expect(formatMetalShort('GOLD_22K', 'WHITE')).toBe('22K · White')
  })

  it('builds SKUs with purity and color', () => {
    expect(buildMetalSku('AJLR-636', 'GOLD_18K', 'YELLOW', '15')).toBe('AJLR-636-G18K-YG-15')
    expect(buildMetalSku('AJLR', 'GOLD_14K', 'ROSE', null, 'NECKL1')).toBe(
      'AJLR-NECKL1-G14K-RG',
    )
  })

  it('maps rate key to purity', () => {
    expect(goldRateKey('GOLD_9K')).toBe('GOLD_9K')
    expect(goldRateKey('GOLD_18K')).toBe('GOLD_18K')
  })

  it('builds PLP filter labels', () => {
    expect(metalFilterLabels('GOLD_18K', 'WHITE')).toEqual(['White Gold', '18K Gold'])
  })
})
