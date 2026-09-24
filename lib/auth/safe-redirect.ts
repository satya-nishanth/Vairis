/**
 * Sanitizes redirect target URLs to prevent Open Redirect attacks.
 * Only allows relative paths starting with a single '/' (e.g. '/account', '/cart').
 * Rejects protocol-relative URLs ('//evil.com'), backslash bypasses ('/\evil.com'),
 * and absolute URLs ('https://evil.com').
 */
export function sanitizeRedirect(target: string | null | undefined, fallback: string = '/'): string {
  if (!target || typeof target !== 'string') return fallback;

  const trimmed = target.trim();
  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.startsWith('/\\') &&
    !trimmed.includes('\\')
  ) {
    return trimmed;
  }

  return fallback;
}
