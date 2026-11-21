/**
 * Server-only Google OAuth env helpers.
 * Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (bound via Cursor app secrets).
 * Never import this module from client/browser code.
 */

export type GoogleEnvStatus = {
  configured: boolean
  demoMode: boolean
  clientId: string | null
  hasClientSecret: boolean
}

export function readGoogleEnv(): GoogleEnvStatus {
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? '').trim()
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? '').trim()
  const configured = Boolean(clientId)
  return {
    configured,
    demoMode: !configured,
    clientId: configured ? clientId : null,
    hasClientSecret: Boolean(clientSecret),
  }
}

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ')
