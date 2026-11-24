import { motion } from 'framer-motion'
import { useGoogleConnectAction } from '../hooks/useGoogleConnectAction'

type Props = {
  onChange?: () => void
}

export function GoogleConnect({ onChange }: Props) {
  const {
    connected,
    busy,
    error,
    hint,
    redirectUri,
    demo,
    connect,
    disconnect,
    prefersRedirect,
  } = useGoogleConnectAction({ onChange })

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
                ? 'Live pulls use Google Calendar + Gmail with auto reminders.'
                : prefersRedirect
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
            onClick={disconnect}
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void connect()}
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
