import fs from 'fs';
import path from 'path';

describe('Security Headers (SEC-01 & SEC-09)', () => {
  const configPath = path.resolve(__dirname, '../../next.config.mjs');
  const configContent = fs.readFileSync(configPath, 'utf8');

  it('disables x-powered-by header in Next config', () => {
    expect(configContent).toMatch(/poweredByHeader:\s*false/);
  });

  it('defines Strict-Transport-Security (HSTS)', () => {
    expect(configContent).toContain("key: 'Strict-Transport-Security'");
    expect(configContent).toContain("value: 'max-age=63072000; includeSubDomains; preload'");
  });

  it('defines X-Frame-Options DENY to prevent clickjacking', () => {
    expect(configContent).toContain("key: 'X-Frame-Options'");
    expect(configContent).toContain("value: 'DENY'");
  });

  it('defines X-Content-Type-Options nosniff', () => {
    expect(configContent).toContain("key: 'X-Content-Type-Options'");
    expect(configContent).toContain("value: 'nosniff'");
  });

  it('defines Referrer-Policy', () => {
    expect(configContent).toContain("key: 'Referrer-Policy'");
    expect(configContent).toContain("value: 'strict-origin-when-cross-origin'");
  });

  it('defines Permissions-Policy', () => {
    expect(configContent).toContain("key: 'Permissions-Policy'");
    expect(configContent).toContain("camera=(), microphone=(), geolocation=()");
  });

  it('defines Content-Security-Policy-Report-Only', () => {
    expect(configContent).toContain("key: 'Content-Security-Policy-Report-Only'");
    expect(configContent).toContain("default-src 'self'");
    expect(configContent).toContain("frame-ancestors 'none'");
    expect(configContent).toContain('vairisprodmedia.blob.core.windows.net');
  });
});
