import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  clearGoogleToken,
  connectGoogle,
  consumeGoogleAuthFlash,
  isGoogleConnected,
  prefersRedirectOAuth,
} from '../lib/googleAuth'
import {
  fetchGoogleConfig,
  type GoogleRuntimeConfig,
} from '../lib/googleConfig'

type Props = {
  onChange?: () => void
}

function flashMessage(flash: string): string {
  switch (flash) {
    case 'connected':
      return ''
    case 'auth_denied':
    case 'access_denied':
      return 'Google access was denied.'
    case 'state_mismatch':
      return 'OAuth state mismatch — try Connect Google again.'
    case 'exchange_failed':
    case 'exchange_no_token':
      return 'Could not finish Google sign-in. Try again.'
    case 'token_exchange_failed':
      return 'Google token exchange failed. Check OAuth redirect URI.'
    case 'client_secret_missing':
      return 'Google client secret is not bound on the host.'
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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const flash = consumeGoogleAuthFlash()
      const cfg = await fetchGoogleConfig()
      if (cancelled) return
      setConfig(cfg)
      setConnected(isGoogleConnected())
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
    if (result.pendingRedirect) {
      setHint('Redirecting to Google…')
      // Stay busy — page is navigating away.
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
    </motion.div>
  )
}
