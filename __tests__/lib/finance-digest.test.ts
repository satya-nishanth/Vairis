import { formatFinanceDigestMessage, runFinanceDigest } from '@/lib/finance-digest'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    orderFinance: { findMany: jest.fn().mockResolvedValue([]) },
    financeTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  },
}))

jest.mock('@/lib/finance-order-search', () => ({
  countPendingOrderSheets: jest.fn().mockResolvedValue(0),
}))

describe('formatFinanceDigestMessage', () => {
  const now = new Date('2026-08-25T03:30:00.000Z')

  it('reports all-clear when no warnings', () => {
    const msg = formatFinanceDigestMessage(
      { pendingSheetsCount: 0, forReviewCount: 0, mismatches: [] },
      { baseUrl: 'https://stage.example', now },
    )
    expect(msg).toContain('Finance daily digest')
    expect(msg).toContain('no open warnings today')
  })

  it('lists incomplete sheets, mismatches, and review counts with links', () => {
    const msg = formatFinanceDigestMessage(
      {
        pendingSheetsCount: 1,
        forReviewCount: 3,
        mismatches: [
          {
            orderId: 'cmt72slog0001yzi5z87gzznh',
            orderLabel: 'cmt72slog0001yzi5z87gzznh',
            sheetSelling: 45000,
            inflowTotal: 40000,
          },
        ],
      },
      { baseUrl: 'https://stage.example/', now },
    )
    expect(msg).toContain('Incomplete order sheets: 1')
    expect(msg).toContain('https://stage.example/admin/finance/orders')
    expect(msg).toContain('SP ↔ inflow mismatches: 1 order')
    expect(msg).toContain('Sheet SP ₹45,000')
    expect(msg).toContain('Inflows ₹40,000')
    expect(msg).toContain('Transactions needing review: 3')
    expect(msg).toContain('https://stage.example/admin/finance/transactions')
  })
})

describe('runFinanceDigest', () => {
  const originalEnv = process.env.DISCORD_FINANCE_WEBHOOK_URL

  afterEach(() => {
    process.env.DISCORD_FINANCE_WEBHOOK_URL = originalEnv
  })

  it('skips posting without error when DISCORD_FINANCE_WEBHOOK_URL is "disabled"', async () => {
    process.env.DISCORD_FINANCE_WEBHOOK_URL = 'disabled'
    const result = await runFinanceDigest()
    expect(result.posted).toBe(false)
    expect(result.content).toContain('Finance daily digest')
  })

  it('skips posting without error when DISCORD_FINANCE_WEBHOOK_URL is empty', async () => {
    delete process.env.DISCORD_FINANCE_WEBHOOK_URL
    const result = await runFinanceDigest()
    expect(result.posted).toBe(false)
  })
})

