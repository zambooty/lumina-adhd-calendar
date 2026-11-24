import {
  getOAuthRedirectUri,
  recommendedRedirectUris,
} from './googleAuth'

/** Human copy for OAuth flash / error codes from redirect hydrate or connect. */
export function googleAuthFlashMessage(flash: string): string {
  if (flash.startsWith('missing_scopes:')) {
    return 'Google connected without Calendar + Gmail access. Reconnect and allow both permissions.'
  }
  switch (flash) {
    case 'connected':
      return ''
    case 'auth_denied':
    case 'access_denied':
      return 'Google access was denied.'
    case 'state_mismatch':
      return 'OAuth state mismatch — try Connect Google again.'
    case 'redirect_uri_mismatch':
      return `Google rejected redirect_uri. Register exactly: ${recommendedRedirectUris().join(' and ')}`
    case 'exchange_failed':
    case 'exchange_no_token':
      return 'Could not finish Google sign-in. Try again.'
    case 'token_exchange_failed':
      return `Google token exchange failed. redirect_uri must be ${getOAuthRedirectUri()}`
    case 'redirect_uri_required':
      return 'Missing redirect_uri on token exchange — try Connect Google again.'
    case 'redirect_uri_forbidden':
    case 'redirect_uri_invalid':
      return `redirect_uri was rejected. Use exactly: ${getOAuthRedirectUri()}`
    case 'rate_limited':
      return 'Too many Google sign-in attempts — wait a minute and try again.'
    case 'forbidden_origin':
      return 'This page origin is not allowed for Google Connect.'
    case 'client_secret_missing':
      return 'Google client secret is not bound on the host.'
    case 'browser_open_timeout':
      return 'Could not open Google sign-in (Custom Tabs timed out). Tap Connect Google again.'
    default:
      return `Google sign-in issue (${flash}).`
  }
}

export function googleConnectFailureMessage(error: string | undefined): string {
  if (!error) return 'Could not connect to Google.'
  if (error === 'auth_denied' || error === 'access_denied') {
    return 'Google access was denied.'
  }
  if (error === 'gis_unavailable') {
    return 'Google sign-in unavailable. Check network / popup blockers.'
  }
  if (error === 'browser_open_timeout') {
    return googleAuthFlashMessage('browser_open_timeout')
  }
  if (error === 'redirect_uri_mismatch') {
    return googleAuthFlashMessage('redirect_uri_mismatch')
  }
  if (error.startsWith('missing_scopes:')) {
    return googleAuthFlashMessage(error)
  }
  return 'Could not connect to Google.'
}
