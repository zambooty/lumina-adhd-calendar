import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGoogleConnectAction } from '../hooks/useGoogleConnectAction'
import { isGoogleConnected } from '../lib/googleAuth'

type Step = 'welcome' | 'accounts' | 'pull'

type Props = {
  onEnter: () => void
  onPullAndEnter: () => void | Promise<void>
}

const STEPS: { id: Step; label: string }[] = [
  { id: 'welcome', label: '1 · Meet' },
  { id: 'accounts', label: '2 · Sign in' },
  { id: 'pull', label: '3 · Pull' },
]

/**
 * First-run account sign-in — short ADHD steps: Meet → Connect Google → Pull.
 * Uses the same Cap Custom Tabs OAuth path as Menu → Google connect.
 */
export function OnboardingSignIn({ onEnter, onPullAndEnter }: Props) {
  const [step, setStep] = useState<Step>(() =>
    isGoogleConnected() ? 'pull' : 'welcome',
  )
  const [pulling, setPulling] = useState(false)

  const advanceToPull = useCallback(() => setStep('pull'), [])

  const {
    connected,
    busy,
    error,
    hint,
    demo,
    connect,
  } = useGoogleConnectAction({
    onConnected: advanceToPull,
  })

  const activeStep: Step =
    connected && (step === 'welcome' || step === 'accounts') ? 'pull' : step

  const handlePullAndEnter = async () => {
    setPulling(true)
    try {
      await onPullAndEnter()
    } finally {
      setPulling(false)
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.id === activeStep)

  return (
    <section className="hero-screen onboarding-screen" aria-label="Sign in">
      <div className="hero-orb" aria-hidden />
      <div className="mix-aurora onboarding-aurora" aria-hidden>
        <span className="mix-aurora-orb mix-aurora-orb--cyan" />
        <span className="mix-aurora-orb mix-aurora-orb--coral" />
        <span className="mix-aurora-orb mix-aurora-orb--lime" />
      </div>

      <div className="onboarding-shell">
        <motion.h1
          className="hero-brand"
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          LUMINA
        </motion.h1>

        <ol className="onboarding-steps" aria-label="Sign-in steps">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              className={`onboarding-step-chip${
                i === stepIndex ? ' is-active' : ''
              }${i < stepIndex ? ' is-done' : ''}`}
            >
              {s.label}
            </li>
          ))}
        </ol>

        <AnimatePresence mode="wait">
          {activeStep === 'welcome' && (
            <motion.div
              key="welcome"
              className="onboarding-panel mix-glass"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
            >
              <p className="onboarding-kicker">ADHD calendar companion</p>
              <h2 className="onboarding-title">Sign in to pull appointments</h2>
              <p className="onboarding-copy">
                Connect Google (Calendar + Gmail), then Pull. Short steps — no
                demo tour.
              </p>
              <div className="onboarding-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setStep('accounts')}
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {activeStep === 'accounts' && (
            <motion.div
              key="accounts"
              className="onboarding-panel mix-glass"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
            >
              <p className="onboarding-kicker">Step 2</p>
              <h2 className="onboarding-title">Connect an account</h2>
              <p className="onboarding-copy">
                {demo
                  ? 'Google secrets aren’t bound yet — you can still open the app and use demo Pull.'
                  : 'Google first. Calendar + Gmail open together. More accounts later.'}
              </p>

              <ul className="onboarding-account-list">
                <li className="onboarding-account-row">
                  <div>
                    <p className="onboarding-account-name">Google</p>
                    <p className="onboarding-account-hint">
                      Calendar · Gmail
                      {connected ? ' · connected' : ''}
                    </p>
                  </div>
                  {demo ? (
                    <span className="mode-chip mode-chip-demo">Demo</span>
                  ) : connected ? (
                    <span className="mode-chip mode-chip-live">Connected</span>
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
                </li>
                <li className="onboarding-account-row is-soon" aria-disabled>
                  <div>
                    <p className="onboarding-account-name">More accounts</p>
                    <p className="onboarding-account-hint">Coming later</p>
                  </div>
                  <span className="mode-chip">Soon</span>
                </li>
              </ul>

              {hint && !error && (
                <p className="google-connect-hint success">{hint}</p>
              )}
              {error && <p className="google-connect-error">{error}</p>}

              <div className="onboarding-actions">
                {(connected || demo) && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setStep('pull')}
                  >
                    Next · Pull
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onEnter}
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}

          {activeStep === 'pull' && (
            <motion.div
              key="pull"
              className="onboarding-panel mix-glass"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
            >
              <p className="onboarding-kicker">Step 3</p>
              <h2 className="onboarding-title">
                {connected ? 'You’re signed in' : 'Pull when ready'}
              </h2>
              <p className="onboarding-copy">
                {connected
                  ? 'Tap Pull to load Calendar + Gmail into LUMINA. You can Pull again anytime from the top bar.'
                  : demo
                    ? 'Demo mode uses sample appointments. Connect Google later from the menu.'
                    : 'Connect Google anytime from Menu → Google connect, then Pull.'}
              </p>
              <div className="onboarding-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handlePullAndEnter()}
                  disabled={pulling}
                >
                  {pulling ? 'Pulling…' : 'Pull & open'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onEnter}
                  disabled={pulling}
                >
                  Open calendar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
