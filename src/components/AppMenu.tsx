import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useEffect, useId, useState } from 'react'

export type MenuSectionId =
  | 'inbox'
  | 'google'
  | 'reminders'
  | 'blink'

type Section = {
  id: MenuSectionId
  title: string
  hint: string
  accent: 'coral' | 'cyan' | 'sky' | 'lime' | 'amber'
  badge?: ReactNode
  children: ReactNode
}

type Props = {
  open: boolean
  onClose: () => void
  sections: Section[]
  footer?: ReactNode
  inboxCount?: number
}

export function AppMenu({ open, onClose, sections, footer }: Props) {
  const titleId = useId()
  const [active, setActive] = useState<MenuSectionId | null>(null)

  useEffect(() => {
    if (!open) {
      setActive(null)
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (active) setActive(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose, active])

  useEffect(() => {
    if (open && active && !sections.some((s) => s.id === active)) {
      setActive(null)
    }
  }, [open, sections, active])

  const current = active
    ? (sections.find((s) => s.id === active) ?? null)
    : null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="app-menu-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            type="button"
            className="app-menu-backdrop"
            aria-label="Close menu"
            onClick={onClose}
          />
          <motion.aside
            className="app-menu-screen"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ y: '8%', opacity: 0.85 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '6%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <span id={titleId} className="sr-only">
              Menu
            </span>

            <button
              type="button"
              className="app-menu-dismiss"
              aria-label={current ? 'Back to menu' : 'Close menu'}
              onClick={() => {
                if (current) setActive(null)
                else onClose()
              }}
            >
              {current ? '←' : '✕'}
            </button>

            <div className="app-menu-scroll">
              {!current ? (
                <nav className="app-menu-list" aria-label="App sections">
                  {sections.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`app-menu-list-item app-menu-list-item--${s.accent}`}
                      onClick={() => setActive(s.id)}
                    >
                      <span className="app-menu-list-copy">
                        <span className="app-menu-list-title">{s.title}</span>
                        <span className="app-menu-list-hint">{s.hint}</span>
                      </span>
                      {s.badge}
                    </button>
                  ))}
                  {footer && (
                    <div className="app-menu-list-footer">{footer}</div>
                  )}
                </nav>
              ) : (
                <div className="app-menu-section">
                  <h2 className="app-menu-section-title">{current.title}</h2>
                  <p className="app-menu-section-hint">{current.hint}</p>
                  <div className="app-menu-section-body">{current.children}</div>
                </div>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
