import { formatFinanceDigestMessage } from '@/lib/finance-digest'

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
