import { isMockPayAllowed } from '@/lib/payments/mock-guard';

describe('Mock Pay Guard (SEC-02)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns false when PAYMENT_GATEWAY is razorpay or unset', () => {
    delete process.env.PAYMENT_GATEWAY;
    process.env.NODE_ENV = 'development';
    expect(isMockPayAllowed()).toBe(false);

    process.env.PAYMENT_GATEWAY = 'razorpay';
    expect(isMockPayAllowed()).toBe(false);
  });

  it('returns false in production when PAYMENT_GATEWAY is mock but ALLOW_MOCK_PAYMENTS is not set', () => {
    process.env.PAYMENT_GATEWAY = 'mock';
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_MOCK_PAYMENTS;

    expect(isMockPayAllowed()).toBe(false);
  });

  it('returns false when VERCEL_ENV is production and ALLOW_MOCK_PAYMENTS is not true', () => {
    process.env.PAYMENT_GATEWAY = 'mock';
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    delete process.env.ALLOW_MOCK_PAYMENTS;

    expect(isMockPayAllowed()).toBe(false);
  });

  it('returns true in development when PAYMENT_GATEWAY is mock', () => {
    process.env.PAYMENT_GATEWAY = 'mock';
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL_ENV;

    expect(isMockPayAllowed()).toBe(true);
  });

  it('returns true in production ONLY when ALLOW_MOCK_PAYMENTS is true', () => {
    process.env.PAYMENT_GATEWAY = 'mock';
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_MOCK_PAYMENTS = 'true';

    expect(isMockPayAllowed()).toBe(true);
  });
});
