import { sanitizeRedirect } from '@/lib/auth/safe-redirect';

describe('sanitizeRedirect (SEC-06)', () => {
  it('allows safe relative paths', () => {
    expect(sanitizeRedirect('/account')).toBe('/account');
    expect(sanitizeRedirect('/cart?step=shipping')).toBe('/cart?step=shipping');
    expect(sanitizeRedirect('/all-products/rings')).toBe('/all-products/rings');
    expect(sanitizeRedirect('/')).toBe('/');
  });

  it('rejects external absolute URLs', () => {
    expect(sanitizeRedirect('https://evil.com')).toBe('/');
    expect(sanitizeRedirect('http://attacker.com/steal')).toBe('/');
    expect(sanitizeRedirect('ftp://evil.com')).toBe('/');
  });

  it('rejects protocol-relative and scheme-relative URLs', () => {
    expect(sanitizeRedirect('//evil.com')).toBe('/');
    expect(sanitizeRedirect('//evil.com/login')).toBe('/');
    expect(sanitizeRedirect('/\\evil.com')).toBe('/');
    expect(sanitizeRedirect('/evil.com\\payload')).toBe('/');
  });

  it('handles null, undefined, and empty string fallbacks', () => {
    expect(sanitizeRedirect(null)).toBe('/');
    expect(sanitizeRedirect(undefined)).toBe('/');
    expect(sanitizeRedirect('')).toBe('/');
    expect(sanitizeRedirect(null, '/account')).toBe('/account');
  });
});
