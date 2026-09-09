/**
 * Sequel247 pincode-serviceability check, used as India address validation
 * for both the address book and checkout (see lib/address-schema.ts callers).
 * Chosen over a third-party pincode API because it's free with credentials
 * we already have, and it confirms Sequel247 can actually deliver there —
 * not just that the pincode is real.
 *
 * Soft-fails on any network problem: never block a sale because a
 * third-party call was slow or down (see design doc, section 4).
 */

export type ServiceabilityResult =
  | { ok: true; city: string; state: string }
  | { ok: true; skipped: true }
  | { ok: false; reason: 'not_found' }

const cache = new Map<string, ServiceabilityResult>()

/** Test-only: clears the in-process cache between test cases. Not for application use. */
export function __resetServiceabilityCache(): void {
  cache.clear()
}

function baseUrl(): string {
  return process.env.SEQUEL247_BASE_URL ?? 'https://test.sequel247.com'
}

export async function checkPincodeServiceability(pincode: string): Promise<ServiceabilityResult> {
  const cached = cache.get(pincode)
  if (cached) return cached

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    let res: Response
    try {
      res = await fetch(`${baseUrl()}/api/checkServiceability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: process.env.SEQUEL247_TOKEN ?? '', pin_code: pincode }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!res.ok) {
      console.error(`[sequel247] checkServiceability HTTP ${res.status}, skipping validation`)
      return { ok: true, skipped: true }
    }

    const data = (await res.json()) as {
      status: string
      data?: { city: string; state: string }
      message?: string
    }

    const result: ServiceabilityResult =
      data.status === 'true' && data.data
        ? { ok: true, city: data.data.city, state: data.data.state }
        : { ok: false, reason: 'not_found' }

    cache.set(pincode, result)
    return result
  } catch (err) {
    console.error('[sequel247] checkServiceability failed, skipping validation', err)
    return { ok: true, skipped: true }
  }
}
