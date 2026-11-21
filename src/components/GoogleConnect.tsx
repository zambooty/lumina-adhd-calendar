import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  clearGoogleToken,
  connectGoogle,
  consumeGoogleAuthFlash,
  getOAuthRedirectUri,
  isGoogleConnected,
  prefersRedirectOAuth,
  recommendedRedirectUris,
} from '../lib/googleAuth'
import {
  fetchGoogleConfig,
  type GoogleRuntimeConfig,
} from '../lib/googleConfig'
import { isNativeCapacitor } from '../lib/platform'

type Props = {
  onChange?: () => void
}

function flashMessage(flash: string): string {
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

export function GoogleConnect({ onChange }: Props) {
  const [config, setConfig] = useState<GoogleRuntimeConfig | null>(null)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [redirectUri, setRedirectUri] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const flash = consumeGoogleAuthFlash()
      const cfg = await fetchGoogleConfig()
      if (cancelled) return
      setConfig(cfg)
      setConnected(isGoogleConnected())
      setRedirectUri(getOAuthRedirectUri())
      if (flash === 'connected') {
        setHint('Google connected — tap Pull from sources.')
        onChange?.()
      } else if (flash) {
        setError(flashMessage(flash))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [onChange])

  const demo = !config || config.demoMode || !config.configured

  const handleConnect = async () => {
    setBusy(true)
    setError(null)
    setHint(null)
    const result = await connectGoogle()
    if (result.redirectUri) setRedirectUri(result.redirectUri)
    if (result.pendingRedirect) {
      setHint(
        isNativeCapacitor()
          ? `Google sign-in opened in Chrome Custom Tabs (redirect ${result.redirectUri ?? getOAuthRedirectUri()}). Finish there — this is not the phone’s system account picker alone.`
          : `Redirecting to Google… (${result.redirectUri ?? getOAuthRedirectUri()})`,
      )
      if (isNativeCapacitor()) {
        // Cap Custom Tabs keep the WebView alive — do not leave the button stuck
        // on “Connecting…” if the user closes the tab without finishing.
        void (async () => {
          try {
            const { Browser } = await import('@capacitor/browser')
            const handle = await Browser.addListener('browserFinished', () => {
              setBusy(false)
              void handle.remove()
            })
            window.setTimeout(() => {
              setBusy(false)
              void handle.remove()
            }, 120_000)
          } catch {
            setBusy(false)
          }
        })()
        return
      }
      // Web mobile redirect — page is navigating away; stay busy.
      return
    }
    setBusy(false)
    if (result.demoMode) {
      setError('Google secrets not bound yet — using demo pull.')
      onChange?.()
      return
    }
    if (!result.ok) {
      setError(
        result.error === 'auth_denied' || result.error === 'access_denied'
          ? 'Google access was denied.'
          : result.error === 'gis_unavailable'
            ? 'Google sign-in unavailable. Check network / popup blockers.'
            : result.error === 'browser_open_timeout'
              ? flashMessage('browser_open_timeout')
              : result.error === 'redirect_uri_mismatch'
                ? flashMessage('redirect_uri_mismatch')
                : result.error?.startsWith('missing_scopes:')
                  ? flashMessage(result.error)
                  : 'Could not connect to Google.',
      )
      return
    }
    setConnected(true)
    setHint(
      prefersRedirectOAuth()
        ? 'Connected. Pull from sources to load Calendar + Gmail.'
        : 'Connected. Pull from sources anytime.',
    )
    onChange?.()
  }

  const handleDisconnect = () => {
    clearGoogleToken()
    setConnected(false)
    setHint(null)
    onChange?.()
  }

  return (
    <motion.div
      className="google-connect"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="google-connect-row">
        <div>
          <p className="google-connect-label">
            {demo ? 'Demo mode' : connected ? 'Google connected' : 'Google ready'}
          </p>
          <p className="google-connect-hint">
            {demo
              ? 'Calendar + Gmail use sample data until secrets are set in Cursor Apps.'
              : connected
                ? 'Live pulls use Google Calendar + Gmail with ADHD reminder stacks.'
                : prefersRedirectOAuth()
                  ? 'Connect Google (mobile-safe redirect) to pull real appointments.'
                  : 'Connect Google to pull real appointments into LUMINA.'}
          </p>
        </div>
        {demo ? (
          <span className="mode-chip mode-chip-demo">Demo</span>
        ) : connected ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void handleConnect()}
            disabled={busy}
          >
            {busy ? 'Connecting…' : 'Connect Google'}
          </button>
        )}
      </div>
      {hint && !error && <p className="google-connect-hint success">{hint}</p>}
      {error && <p className="google-connect-error">{error}</p>}
      {!demo && !connected && redirectUri && (
        <p className="google-connect-hint oauth-uri" title="Exact redirect_uri the app sends">
          OAuth redirect_uri: <code>{redirectUri}</code>
        </p>
      )}
    </motion.div>
  )
}
