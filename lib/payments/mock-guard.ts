/**
 * Guard for mock payment routes (/mock-pay and /api/mock-pay).
 * Mock payments are only permitted when PAYMENT_GATEWAY=mock.
 * In production (NODE_ENV=production or VERCEL_ENV=production), mock payments
 * are strictly disabled and return 404 unless explicitly allowed via ALLOW_MOCK_PAYMENTS=true.
 */
export function isMockPayAllowed(): boolean {
  if (process.env.PAYMENT_GATEWAY !== 'mock') {
    return false;
  }
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (isProduction && process.env.ALLOW_MOCK_PAYMENTS !== 'true') {
    return false;
  }
  return true;
}
