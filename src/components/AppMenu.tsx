import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useEffect, useId, useState } from 'react'

export type MenuSectionId =
  | 'inbox'
  | 'upcoming'
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
  const [active, setActive] = useState<MenuSectionId>('inbox')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  useEffect(() => {
    if (open && sections.length && !sections.some((s) => s.id === active)) {
      setActive(sections[0].id)
    }
  }, [open, sections, active])

  const current = sections.find((s) => s.id === active) ?? sections[0]

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
            className="app-menu-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ x: '105%' }}
            animate={{ x: 0 }}
            exit={{ x: '105%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <header className="app-menu-header">
              <div>
                <p id={titleId} className="app-menu-title">
                  Menu
                </p>
                <p className="app-menu-sub">Inbox · Upcoming · Connect · Stacks</p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onClose}
              >
                Close
              </button>
            </header>

            <nav className="app-menu-nav" aria-label="App sections">
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`app-menu-nav-btn app-menu-nav-btn--${s.accent}${active === s.id ? ' is-active' : ''}`}
                  aria-current={active === s.id ? 'page' : undefined}
                  onClick={() => setActive(s.id)}
                >
                  <span className="app-menu-nav-label">{s.title}</span>
                  {s.badge}
                </button>
              ))}
            </nav>

            {current && (
              <div className="app-menu-panel">
                <div className="app-menu-panel-head">
                  <h2 className="panel-title">{current.title}</h2>
                  <p className="panel-hint">{current.hint}</p>
                </div>
                <div className="app-menu-panel-body">{current.children}</div>
              </div>
            )}

            {footer && <footer className="app-menu-footer">{footer}</footer>}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
