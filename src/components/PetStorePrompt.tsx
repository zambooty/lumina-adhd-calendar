import { AnimatePresence, motion } from 'framer-motion'
import type { PetStoreCatalogItem } from '../lib/petStore'

type Props = {
  items: PetStoreCatalogItem[]
  spark: number
  onOpenStore: () => void
  onDismiss: () => void
}

/** Soft prompt when new store items unlock with companion growth. */
export function PetStorePrompt({
  items,
  spark,
  onOpenStore,
  onDismiss,
}: Props) {
  if (!items.length) return null
  const top = items.slice(0, 3)
  const extra = items.length - top.length

  return (
    <AnimatePresence>
      <motion.div
        className="pet-store-prompt"
        role="status"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        <div className="pet-store-prompt-glow" aria-hidden />
        <p className="pet-store-prompt-kicker">New in the store</p>
        <h3 className="pet-store-prompt-title">
          {items.length === 1
            ? `${items[0].name} unlocked`
            : `${items.length} new looks unlocked`}
        </h3>
        <ul className="pet-store-prompt-list">
          {top.map((item) => (
            <li key={item.id}>
              <span
                className="pet-store-prompt-swatch"
                style={{ background: item.accent }}
                aria-hidden
              />
              <span>
                {item.name}
                <em>
                  {spark >= item.price
                    ? ` · ${item.price} spark`
                    : ` · need ${item.price}`}
                </em>
              </span>
            </li>
          ))}
          {extra > 0 && <li className="pet-store-prompt-more">+{extra} more</li>}
        </ul>
        <div className="pet-store-prompt-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenStore}>
            Open store
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDismiss}>
            Later
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
