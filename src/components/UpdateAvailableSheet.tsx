import { AnimatePresence, motion } from 'framer-motion'
import type { DownloadInstallResult, LatestUpdateInfo, InstalledVersion } from '../lib/appUpdate'

type Phase = 'idle' | 'checking' | 'ready' | 'downloading' | 'permission' | 'done' | 'error'

type Props = {
  open: boolean
  phase: Phase
  progress: number
  installed: InstalledVersion | null
  latest: LatestUpdateInfo | null
  message?: string | null
  lastResult?: DownloadInstallResult | null
  onClose: () => void
  onDownload: () => void
  onOpenRelease: () => void
  onRetryInstall: () => void
  onCheckAgain: () => void
}

/**
 * Mix glass sheet — Update available → download → system installer.
 */
export function UpdateAvailableSheet({
  open,
  phase,
  progress,
  installed,
  latest,
  message,
  lastResult,
  onClose,
  onDownload,
  onOpenRelease,
  onRetryInstall,
  onCheckAgain,
}: Props) {
  const title =
    phase === 'checking'
      ? 'Checking…'
      : phase === 'downloading'
        ? 'Downloading…'
        : phase === 'permission'
          ? 'Allow installs'
          : phase === 'error'
            ? 'Update issue'
            : phase === 'done'
              ? 'Installer opened'
              : latest && (latest.versionCode > (installed?.versionCode ?? 0))
                ? 'Update available'
                : 'You’re up to date'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="update-sheet-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-sheet-title"
        >
          <button
            type="button"
            className="update-sheet-backdrop"
            aria-label="Close update"
            onClick={onClose}
          />
          <motion.div
            className="update-sheet"
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <div className="update-sheet-head">
              <h2 id="update-sheet-title">{title}</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onClose}
              >
                Close
              </button>
            </div>
            <p className="update-sheet-lead">
              Sideload updates from GitHub Releases — same dark glass shell, no
              Play Store required. If Android says the package conflicts,
              uninstall LUMINA once, then install this build (one-time signing
              change); later updates install in place.
            </p>

            <section className="mix-glass update-card">
              {phase === 'checking' && (
                <p className="update-meta" role="status">
                  Looking for the latest android-debug-* APK…
                </p>
              )}

              {latest?.ok && (
                <>
                  <h3 className="update-label">
                    {latest.channel === 'release' ? 'Release' : 'Debug'} channel
                  </h3>
                  <p className="update-title">{latest.versionName || latest.tag}</p>
                  <p className="update-meta">
                    Installed{' '}
                    {installed
                      ? `${installed.versionName} (${installed.versionCode})`
                      : '—'}
                    {' → '}
                    latest {latest.versionCode}
                    {latest.tag ? ` · ${latest.tag}` : ''}
                  </p>
                  {latest.sha256 && (
                    <p className="update-meta update-meta--mono">
                      SHA-256 {latest.sha256.slice(0, 16)}…
                    </p>
                  )}
                </>
              )}

              {phase === 'downloading' && (
                <div className="update-progress" role="progressbar" aria-valuenow={progress}>
                  <div
                    className="update-progress-bar"
                    style={{ width: `${Math.max(4, progress)}%` }}
                  />
                  <span>{progress}%</span>
                </div>
              )}

              {message && (
                <p
                  className={`update-status ${
                    phase === 'error' ? 'update-status--warn' : 'update-status--ok'
                  }`}
                  role="status"
                >
                  {message}
                </p>
              )}

              {phase === 'ready' &&
                latest &&
                latest.versionCode > (installed?.versionCode ?? 0) && (
                  <button
                    type="button"
                    className="btn btn-primary update-cta"
                    onClick={onDownload}
                  >
                    Download & install
                  </button>
                )}

              {(phase === 'ready' || phase === 'error' || phase === 'done') &&
                !(
                  phase === 'ready' &&
                  latest &&
                  latest.versionCode > (installed?.versionCode ?? 0)
                ) && (
                  <button
                    type="button"
                    className="btn btn-primary update-cta"
                    onClick={onCheckAgain}
                  >
                    Check again
                  </button>
                )}

              {phase === 'permission' && (
                <button
                  type="button"
                  className="btn btn-primary update-cta"
                  onClick={onRetryInstall}
                >
                  Install again
                </button>
              )}

              {lastResult?.path && phase === 'permission' && (
                <p className="update-meta">
                  APK saved — allow unknown apps for LUMINA, then install.
                </p>
              )}

              {(phase === 'error' ||
                phase === 'ready' ||
                phase === 'permission') && (
                <button
                  type="button"
                  className="update-secondary"
                  onClick={onOpenRelease}
                >
                  Open GitHub release
                </button>
              )}
            </section>

            <div className="update-blink-row">
              <span className="update-blink-orb" aria-hidden />
              <span>
                Same signing key required for in-place upgrades. Package
                conflict → uninstall once, then install 1.1.2+. Pull / SMS /
                Google stay untouched.
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
