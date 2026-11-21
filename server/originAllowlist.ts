/**
 * CSRF / origin gate for /api/google/exchange and /api/google/refresh.
 *
 * Cursor's published host often serves handlers with an *internal* request.url
 * (not https://….apps.grok.bot). Comparing browser Origin to that URL always
 * fails → forbidden_origin — including mobile after redirect OAuth.
 *
 * Allow when Origin/Referer matches a known public app origin (or the
 * Host / X-Forwarded-* public host), plus common mobile / Capacitor cases.
 * Do not accept arbitrary origins.
 */

/** Published Lumina app (no trailing slash — URL.origin form). */
export const PUBLISHED_APP_ORIGIN = 'https://lumina-calendar-f5eb.apps.grok.bot'

/** Local Vite defaults (McKale's Cloud Console already has 5173 + 4173). */
export const LOCAL_DEV_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
] as const

/**
 * Capacitor / Ionic WebView origins (future Android wrap + some in-app browsers).
 * Only localhost hosts — never arbitrary capacitor:// hosts.
 */
export const CAPACITOR_ORIGINS = [
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
] as const

const TRUSTED_SCHEMES = new Set(['http:', 'https:', 'capacitor:', 'ionic:'])

export type OriginCheckHeaders = {
  origin?: string | string[] | null
  referer?: string | string[] | null
  host?: string | string[] | null
  'x-forwarded-host'?: string | string[] | null
  'x-forwarded-proto'?: string | string[] | null
  'sec-fetch-site'?: string | string[] | null
}

function headerValue(
  value: string | string[] | null | undefined,
): string | null {
  if (value == null) return null
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length ? trimmed : null
}

/** First hop of a possibly comma-separated forwarded header. */
function firstForwarded(value: string | null): string | null {
  if (!value) return null
  return value.split(',')[0]?.trim() || null
}

/**
 * Normalize an Origin or Referer-like value to scheme://host[:port].
 * Trailing slashes and paths are stripped (Referer often includes `/`).
 * Returns null for opaque/`null`/untrusted schemes.
 */
export function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'null') return null
  try {
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
      ? trimmed
      : `https://${trimmed}`
    const url = new URL(withScheme)
    if (!TRUSTED_SCHEMES.has(url.protocol)) return null
    // Capacitor / Ionic: only localhost (no open capacitor://evil).
    // Non-http(s) schemes are "opaque" — url.origin is the string "null".
    if (url.protocol === 'capacitor:' || url.protocol === 'ionic:') {
      if (url.hostname !== 'localhost') return null
      return `${url.protocol}//localhost`
    }
    return url.origin
  } catch {
    return null
  }
}

/** Strip or add www. so www.example and example match. */
export function hostAliases(host: string): string[] {
  const h = host.toLowerCase()
  if (h.startsWith('www.')) {
    return [h, h.slice(4)]
  }
  return [h, `www.${h}`]
}

/** Origins that should be treated as equivalent (www ↔ apex). */
export function originAliases(origin: string): string[] {
  const normalized = normalizeOrigin(origin)
  if (!normalized) return []
  try {
    const url = new URL(normalized)
    return hostAliases(url.host).map((host) => {
      const u = new URL(normalized)
      u.host = host
      return u.origin
    })
  } catch {
    return [normalized]
  }
}

function originsFromEnv(): string[] {
  const raw = [
    process.env.PUBLIC_APP_ORIGIN ?? '',
    process.env.ALLOWED_ORIGINS ?? '',
  ].join(',')
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeOrigin)
    .filter((o): o is string => Boolean(o))
}

function addOriginAndAliases(target: Set<string>, origin: string): void {
  for (const alias of originAliases(origin)) {
    target.add(alias)
  }
}

/**
 * Public origins we trust for this deployment.
 * Includes published app (+ www), local Vite, Capacitor, env overrides,
 * and Host / X-Forwarded-* public host.
 */
export function allowedAppOrigins(
  headers: OriginCheckHeaders,
  requestUrl?: string | null,
): Set<string> {
  const allowed = new Set<string>()

  addOriginAndAliases(allowed, PUBLISHED_APP_ORIGIN)
  for (const o of LOCAL_DEV_ORIGINS) addOriginAndAliases(allowed, o)
  for (const o of CAPACITOR_ORIGINS) {
    const n = normalizeOrigin(o)
    if (n) allowed.add(n)
  }
  for (const o of originsFromEnv()) addOriginAndAliases(allowed, o)

  if (requestUrl) {
    try {
      addOriginAndAliases(allowed, new URL(requestUrl).origin)
    } catch {
      /* ignore malformed */
    }
  }

  const xfHost = firstForwarded(headerValue(headers['x-forwarded-host']))
  const host = xfHost || firstForwarded(headerValue(headers.host))
  if (host) {
    const xfProto = firstForwarded(headerValue(headers['x-forwarded-proto']))
    let proto = xfProto
    if (!proto && requestUrl) {
      try {
        proto = new URL(requestUrl).protocol.replace(':', '')
      } catch {
        proto = null
      }
    }
    if (!proto) {
      // Published Cursor apps are HTTPS; bare Host without proto → assume https
      // unless it's clearly loopback / capacitor.
      proto = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host) ? 'http' : 'https'
    }
    const fromHost = normalizeOrigin(`${proto}://${host}`)
    if (fromHost) addOriginAndAliases(allowed, fromHost)
  }

  return allowed
}

function claimMatchesAllowlist(
  claim: string | null,
  allowed: Set<string>,
): boolean {
  if (!claim) return false
  const origin = normalizeOrigin(claim)
  if (!origin) return false
  if (allowed.has(origin)) return true
  // www ↔ apex equivalence even if only one form was seeded
  return originAliases(origin).some((alias) => allowed.has(alias))
}

function hostIsAllowlisted(host: string, allowed: Set<string>): boolean {
  const aliases = new Set(hostAliases(host))
  for (const entry of allowed) {
    try {
      if (aliases.has(new URL(entry).host.toLowerCase())) return true
    } catch {
      /* ignore */
    }
  }
  return false
}

/**
 * True when the request is from an allowlisted app origin.
 *
 * Order:
 * 1. Origin header (standard CORS) — must be allowlisted
 * 2. Referer fallback (some mobile browsers omit Origin on same-origin POST)
 * 3. No Origin/Referer — allow only when Sec-Fetch-Site is `same-origin` and
 *    the request Host / X-Forwarded-Host is itself allowlisted (privacy-mode
 *    mobile browsers). Never allow cross-site or missing metadata here.
 */
export function isAllowedAppOrigin(
  headers: OriginCheckHeaders,
  requestUrl?: string | null,
): boolean {
  const allowed = allowedAppOrigins(headers, requestUrl)

  const origin = headerValue(headers.origin)
  if (origin) {
    return claimMatchesAllowlist(origin, allowed)
  }

  const referer = headerValue(headers.referer)
  if (referer) {
    return claimMatchesAllowlist(referer, allowed)
  }

  const site = (headerValue(headers['sec-fetch-site']) || '').toLowerCase()
  if (site !== 'same-origin') return false

  const xfHost = firstForwarded(headerValue(headers['x-forwarded-host']))
  const host = xfHost || firstForwarded(headerValue(headers.host))
  if (!host) return false

  return hostIsAllowlisted(host, allowed)
}

/** Fetch Request helper used by api/google/* route handlers. */
export function isAllowedRequestOrigin(request: Request): boolean {
  return isAllowedAppOrigin(
    {
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      host: request.headers.get('host'),
      'x-forwarded-host': request.headers.get('x-forwarded-host'),
      'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
      'sec-fetch-site': request.headers.get('sec-fetch-site'),
    },
    request.url,
  )
}

/**
 * Exact Cloud Console strings for the published app + local Vite.
 * McKale's client already has the published + 127.0.0.1 entries; listed here
 * for docs / future slug changes.
 */
export function googleCloudConsoleUris(publishedOrigin = PUBLISHED_APP_ORIGIN): {
  javascriptOrigins: string[]
  redirectUris: string[]
} {
  const published = normalizeOrigin(publishedOrigin) || PUBLISHED_APP_ORIGIN
  // Cloud Console JS origins McKale already registered (no localhost name needed
  // if only 127.0.0.1 is used — we still list both for completeness).
  const javascriptOrigins = [
    published,
    'http://127.0.0.1:5173',
    'http://127.0.0.1:4173',
    'http://localhost:5173',
    'http://localhost:4173',
  ]
  const redirectUris = [
    published,
    `${published}/`,
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5173/',
    'http://127.0.0.1:4173',
    'http://127.0.0.1:4173/',
    'http://localhost:5173',
    'http://localhost:5173/',
    'http://localhost:4173',
    'http://localhost:4173/',
  ]
  return { javascriptOrigins, redirectUris }
}
