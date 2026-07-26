import { NextRequest, NextResponse } from 'next/server'

/**
 * Simple in-memory sliding-window rate limiter for public API routes.
 * Per serverless instance — not a distributed guarantee, but enough to
 * blunt scripted abuse of track-order, contact, reviews, search, promo.
 * Swap for Upstash/Redis if traffic outgrows a single instance.
 */

type Bucket = { timestamps: number[] }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 10_000

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

/**
 * Returns a 429 response when over limit, else null.
 * `key` namespaces the route; `limit` requests per `windowMs`.
 */
export function rateLimit(
  req: NextRequest,
  key: string,
  limit: number,
  windowMs = 60_000,
): NextResponse | null {
  const now = Date.now()
  const id = `${key}:${clientIp(req)}`

  // Cheap global cleanup guard
  if (buckets.size > MAX_BUCKETS) buckets.clear()

  const bucket = buckets.get(id) ?? { timestamps: [] }
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs)

  if (bucket.timestamps.length >= limit) {
    buckets.set(id, bucket)
    return NextResponse.json(
      { error: 'Too many requests — please slow down and try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) } },
    )
  }

  bucket.timestamps.push(now)
  buckets.set(id, bucket)
  return null
}
