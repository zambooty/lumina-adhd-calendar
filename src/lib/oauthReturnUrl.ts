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
