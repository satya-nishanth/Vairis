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
  const isStrictProduction =
    process.env.AZURE_ENV_NAME === 'prod' ||
    process.env.ENVIRONMENT_IS_PROD === 'true' ||
    process.env.VERCEL_ENV === 'production';

  if (isStrictProduction) {
    return false;
  }

  const isProdNode = process.env.NODE_ENV === 'production';
  if (isProdNode && process.env.ALLOW_MOCK_PAYMENTS !== 'true') {
    return false;
  }

  return true;
}
