/** Shared scope string — safe for client (not a secret). */
export const CALENDAR_READONLY_SCOPE =
  'https://www.googleapis.com/auth/calendar.readonly'

export const GMAIL_READONLY_SCOPE =
  'https://www.googleapis.com/auth/gmail.readonly'

/** Needed so tokeninfo returns email for speech-to-text allowlisting. */
export const OPENID_SCOPE = 'openid'
export const EMAIL_SCOPE = 'email'

export const GOOGLE_SCOPES = [
  OPENID_SCOPE,
  EMAIL_SCOPE,
  CALENDAR_READONLY_SCOPE,
  GMAIL_READONLY_SCOPE,
].join(' ')

export function parseScopeString(scope?: string | null): string[] {
  if (!scope || typeof scope !== 'string') return []
  return scope
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function scopeSetHas(
  granted: string[] | string | null | undefined,
  required: string,
): boolean {
  const list = Array.isArray(granted) ? granted : parseScopeString(granted)
  return list.some(
    (s) => s === required || s.endsWith(required.replace(/^https:\/\//, '')),
  )
}

export function hasCalendarScope(
  granted: string[] | string | null | undefined,
): boolean {
  return scopeSetHas(granted, CALENDAR_READONLY_SCOPE)
}

export function hasGmailScope(
  granted: string[] | string | null | undefined,
): boolean {
  return scopeSetHas(granted, GMAIL_READONLY_SCOPE)
}

export function hasRequiredGoogleScopes(
  granted: string[] | string | null | undefined,
): boolean {
  return hasCalendarScope(granted) && hasGmailScope(granted)
}

export function missingGoogleScopes(
  granted: string[] | string | null | undefined,
): string[] {
  const missing: string[] = []
  if (!hasCalendarScope(granted)) missing.push(CALENDAR_READONLY_SCOPE)
  if (!hasGmailScope(granted)) missing.push(GMAIL_READONLY_SCOPE)
  return missing
}
