import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearGoogleToken,
  connectGoogle,
  consumeGoogleAuthFlash,
  getOAuthRedirectUri,
  isGoogleConnected,
  prefersRedirectOAuth,
} from '../lib/googleAuth'
import {
  googleAuthFlashMessage,
  googleConnectFailureMessage,
} from '../lib/googleAuthFlash'
import {
  fetchGoogleConfig,
  type GoogleRuntimeConfig,
} from '../lib/googleConfig'
import { isNativeCapacitor } from '../lib/platform'

type Options = {
  onChange?: () => void
  /** Called when a fresh connect succeeds (including redirect hydrate flash). */
  onConnected?: () => void
}

/**
 * Shared Connect Google action for menu + first-run onboarding.
 * Preserves Cap Custom Tabs busy handling (browserFinished / timeout).
 */
export function useGoogleConnectAction(options: Options = {}) {
  const onChangeRef = useRef(options.onChange)
  const onConnectedRef = useRef(options.onConnected)

  useEffect(() => {
    onChangeRef.current = options.onChange
    onConnectedRef.current = options.onConnected
  }, [options.onChange, options.onConnected])

  const [config, setConfig] = useState<GoogleRuntimeConfig | null>(null)
  const [connected, setConnected] = useState(() => isGoogleConnected())
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
      const nowConnected = isGoogleConnected()
      setConnected(nowConnected)
      setRedirectUri(getOAuthRedirectUri())
      if (flash === 'connected') {
        setHint('Google connected — tap Pull.')
        onChangeRef.current?.()
        onConnectedRef.current?.()
      } else if (flash) {
        setError(googleAuthFlashMessage(flash))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const demo = !config || config.demoMode || !config.configured

  const connect = useCallback(async () => {
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
      return
    }
    setBusy(false)
    if (result.demoMode) {
      setError('Google secrets not bound yet — using demo pull.')
      onChangeRef.current?.()
      return
    }
    if (!result.ok) {
      setError(googleConnectFailureMessage(result.error))
      return
    }
    setConnected(true)
    setHint(
      prefersRedirectOAuth()
        ? 'Connected. Pull to load Calendar + Gmail.'
        : 'Connected. Pull anytime.',
    )
    onChangeRef.current?.()
    onConnectedRef.current?.()
  }, [])

  const disconnect = useCallback(() => {
    clearGoogleToken()
    setConnected(false)
    setHint(null)
    onChangeRef.current?.()
  }, [])

  return {
    config,
    connected,
    busy,
    error,
    hint,
    redirectUri,
    demo,
    connect,
    disconnect,
    prefersRedirect: prefersRedirectOAuth(),
  }
}
