import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGoogleConnectAction } from '../hooks/useGoogleConnectAction'

type Props = {
  /** Compact for nested empty copy; default = home NOW panel. */
  compact?: boolean
  onPull: () => void | Promise<void>
  className?: string
}

/**
 * Empty / first-use guide: Connect Google → Pull (not a demo tour).
 */
export function ConnectPullGuide({ compact, onPull, className }: Props) {
  const [pulling, setPulling] = useState(false)

  const { connected, busy, error, hint, demo, connect } =
    useGoogleConnectAction()

  const handlePull = async () => {
    setPulling(true)
    try {
      await onPull()
    } finally {
      setPulling(false)
    }
  }

  const ready = connected || demo

  return (
    <motion.div
      className={`connect-pull-guide${compact ? ' connect-pull-guide--compact' : ''}${
        className ? ` ${className}` : ''
      }`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {!compact && (
        <ol className="connect-pull-steps" aria-label="Get started">
          <li className={ready ? 'is-done' : 'is-active'}>
            <span className="connect-pull-num">1</span>
            Connect Google
          </li>
          <li className={ready ? 'is-active' : ''}>
            <span className="connect-pull-num">2</span>
            Pull
          </li>
        </ol>
      )}

      <p className="connect-pull-copy">
        {demo
          ? 'Demo mode — Pull samples, or bind Google later.'
          : connected
            ? 'Signed in — Pull Calendar + Gmail.'
            : 'Connect Google, then Pull.'}
      </p>

      <div className="connect-pull-actions">
        {!demo && !connected ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void connect()}
            disabled={busy}
          >
            {busy ? 'Connecting…' : 'Connect Google'}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handlePull()}
            disabled={pulling}
          >
            {pulling ? 'Pulling…' : 'Pull'}
          </button>
        )}
      </div>

      {hint && !error && (
        <p className="google-connect-hint success">{hint}</p>
      )}
      {error && <p className="google-connect-error">{error}</p>}
    </motion.div>
  )
}
