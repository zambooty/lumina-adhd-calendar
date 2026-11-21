import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  clearGoogleToken,
  connectGoogle,
  isGoogleConnected,
} from '../lib/googleAuth'
import {
  fetchGoogleConfig,
  type GoogleRuntimeConfig,
} from '../lib/googleConfig'

type Props = {
  onChange?: () => void
}

export function GoogleConnect({ onChange }: Props) {
  const [config, setConfig] = useState<GoogleRuntimeConfig | null>(null)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const cfg = await fetchGoogleConfig()
      if (cancelled) return
      setConfig(cfg)
      setConnected(isGoogleConnected())
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const demo = !config || config.demoMode || !config.configured

  const handleConnect = async () => {
    setBusy(true)
    setError(null)
    const result = await connectGoogle()
    setBusy(false)
    if (result.demoMode) {
      setError('Google secrets not bound yet — using demo pull.')
      onChange?.()
      return
    }
    if (!result.ok) {
      setError(
        result.error === 'auth_denied'
          ? 'Google access was denied.'
          : 'Could not connect to Google.',
      )
      return
    }
    setConnected(true)
    onChange?.()
  }

  const handleDisconnect = () => {
    clearGoogleToken()
    setConnected(false)
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
      {error && <p className="google-connect-error">{error}</p>}
    </motion.div>
  )
}
