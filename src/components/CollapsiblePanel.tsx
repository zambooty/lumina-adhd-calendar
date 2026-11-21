import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

type Props = {
  id: string
  title: string
  hint?: string
  open: boolean
  onToggle: () => void
  badge?: ReactNode
  headerActions?: ReactNode
  children: ReactNode
  className?: string
  accent?: 'cyan' | 'coral' | 'lime' | 'amber' | 'sky'
}

export function CollapsiblePanel({
  id,
  title,
  hint,
  open,
  onToggle,
  badge,
  headerActions,
  children,
  className = '',
  accent = 'cyan',
}: Props) {
  const bodyId = `${id}-body`
  const headerId = `${id}-header`

  return (
    <section
      className={`panel collapsible-panel collapsible-panel--${accent}${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
    >
      <h2 className="collapsible-heading">
        <button
          type="button"
          id={headerId}
          className="collapsible-trigger"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <span className="collapsible-trigger-main">
            <span className="collapsible-title-row">
              <span className="panel-title collapsible-title">{title}</span>
              {badge}
            </span>
            {hint ? <span className="panel-hint collapsible-hint">{hint}</span> : null}
          </span>
          <motion.span
            className="collapsible-chevron"
            aria-hidden
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          >
            ▾
          </motion.span>
        </button>
      </h2>

      {headerActions ? (
        <div className="collapsible-actions" onClick={(e) => e.stopPropagation()}>
          {headerActions}
        </div>
      ) : null}

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={bodyId}
            role="region"
            aria-labelledby={headerId}
            className="collapsible-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="panel-body collapsible-body-inner">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
