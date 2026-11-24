/**
 * Trusted Cap / published origins for Google OAuth appUrlOpen returns.
 * Kept free of Capacitor imports so server-side security checks can reuse it.
 */
import { PUBLISHED_APP_ORIGIN } from './publishedOrigin'

const TRUSTED_RETURN_SCHEMES = new Set([
  'https:',
  'http:',
  'capacitor:',
  'ionic:',
])

/** Query keys Google may put on the redirect_uri return. */
const OAUTH_RETURN_QUERY_KEYS = [
  'code',
  'state',
  'error',
  'error_description',
  'scope',
] as const

/** Soft max length per OAuth query value (codes/state are short). */
const OAUTH_QUERY_VALUE_MAX = 2048

/**
 * True when an appUrlOpen URL is a plausible Google OAuth return for this app.
 * Cap androidScheme → https://localhost; also allow local Vite + published host.
 */
export function isTrustedOAuthReturnUrl(url: URL): boolean {
  if (!TRUSTED_RETURN_SCHEMES.has(url.protocol)) return false
  if (url.username || url.password) return false

  if (url.protocol === 'capacitor:' || url.protocol === 'ionic:') {
    return url.hostname === 'localhost'
  }

  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1') return true

  try {
    const published = new URL(PUBLISHED_APP_ORIGIN)
    return host === published.hostname.toLowerCase()
  } catch {
    return false
  }
}

/**
 * Build a same-origin path+query for `location.assign` from a Cap OAuth return.
 *
 * Hardening vs raw `pathname + search` assign:
 * - Only root path (redirect_uri is origin-only)
 * - Allowlisted OAuth query keys only
 * - Resolve against `baseOrigin` and require identical origin (blocks `//evil`)
 * - Drop hash / userinfo / protocol-relative tricks
 *
 * Returns null when the URL must not drive navigation.
 */
export function safeOAuthReturnAssignHref(
  url: URL,
  baseOrigin: string,
): string | null {
  if (!isTrustedOAuthReturnUrl(url)) return null

  const pathname = url.pathname === '' ? '/' : url.pathname
  // Google redirect_uri has no path; reject //evil and any non-root path.
  if (pathname !== '/') return null

  const params = new URLSearchParams()
  for (const key of OAUTH_RETURN_QUERY_KEYS) {
    if (!url.searchParams.has(key)) continue
    const value = url.searchParams.get(key)
    if (value == null) continue
    if (value.length > OAUTH_QUERY_VALUE_MAX) return null
    params.set(key, value)
  }
  if (!params.has('code') && !params.has('error')) return null

  const relative = `/?${params.toString()}`
  let resolved: URL
  let base: URL
  try {
    resolved = new URL(relative, baseOrigin)
    base = new URL(baseOrigin)
  } catch {
    return null
  }

  if (resolved.origin !== base.origin) return null
  if (resolved.username || resolved.password) return null
  if (resolved.pathname !== '/') return null

  // Path + allowlisted query only — never re-introduce hash or foreign origin.
  return `${resolved.pathname}${resolved.search}`
}
