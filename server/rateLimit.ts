/**
 * Tiny in-memory sliding-window rate limiter for serverless-ish / single-process
 * hosts (Cursor app + Vite middleware). Not shared across instances — still
 * blunt brute-force protection for unauthenticated token routes.
 */

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSec: number
  limit: number
}

type Bucket = {
  /** Epoch-ms timestamps of recent takes within the window. */
  hits: number[]
}

const buckets = new Map<string, Bucket>()

let lastPrune = 0
const PRUNE_EVERY_MS = 60_000

function prune(now: number, windowMs: number): void {
  if (now - lastPrune < PRUNE_EVERY_MS) return
  lastPrune = now
  const cutoff = now - windowMs
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => t > cutoff)
    if (bucket.hits.length === 0) buckets.delete(key)
  }
}

/**
 * Record one attempt for `key`. Returns whether it is still under `max` in
 * the sliding `windowMs`.
 */
export function takeRateLimit(
  key: string,
  max: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  prune(now, windowMs)
  const cutoff = now - windowMs
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { hits: [] }
    buckets.set(key, bucket)
  }
  bucket.hits = bucket.hits.filter((t) => t > cutoff)

  if (bucket.hits.length >= max) {
    const oldest = bucket.hits[0] ?? now
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
      limit: max,
    }
  }

  bucket.hits.push(now)
  return {
    allowed: true,
    remaining: Math.max(0, max - bucket.hits.length),
    retryAfterSec: 0,
    limit: max,
  }
}

/** Test helper — clears all buckets. */
export function resetRateLimits(): void {
  buckets.clear()
  lastPrune = 0
}
