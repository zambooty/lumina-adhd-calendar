import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState, type CSSProperties } from 'react'
import type { PetState, PetStoreItemKind, PetStoreState } from '../types'
import { petStage, petXp } from '../lib/pet'
import {
  STORE_KIND_LABEL,
  STORE_KIND_ORDER,
  catalogItem,
  equippedPreview,
  itemsForKind,
} from '../lib/petStore'

type Props = {
  pet: PetState
  store: PetStoreState
  onBuy: (itemId: string) => void
  onEquip: (itemId: string) => void
}

export function PetStorePanel({ pet, store, onBuy, onEquip }: Props) {
  const [kind, setKind] = useState<PetStoreItemKind>('animal')
  const xp = petXp(pet)
  const stage = petStage(xp)
  const preview = equippedPreview(store)
  const stageItems = useMemo(() => itemsForKind(kind, stage), [kind, stage])

  const equippedId =
    kind === 'animal'
      ? store.equipped.animalId
      : kind === 'skin'
        ? store.equipped.skinId
        : kind === 'clothes'
          ? store.equipped.clothesId
          : kind === 'color'
            ? store.equipped.colorId
            : store.equipped.companionId

  return (
    <div className="pet-store-panel">
      <div className="pet-store-wallet" aria-live="polite">
        <span className="pet-store-spark">
          <span className="pet-store-spark-glyph" aria-hidden>
            *
          </span>
          {store.spark} spark
        </span>
        <span
          className="pet-store-preview"
          style={{ '--pet-accent': preview.accent } as CSSProperties}
        >
          <span className="pet-store-preview-glyph" aria-hidden>
            {preview.animal}
          </span>
          <span>
            {pet.name} · {preview.skin}
            {preview.companion !== '○' ? ` + ${preview.companion}` : ''}
          </span>
        </span>
      </div>

      <div className="pet-store-tabs" role="tablist" aria-label="Store categories">
        {STORE_KIND_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            className={`pet-store-tab${kind === k ? ' is-active' : ''}`}
            onClick={() => setKind(k)}
          >
            {STORE_KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <ul className="pet-store-grid">
        <AnimatePresence mode="popLayout">
          {stageItems.map((item) => {
            const owned = store.ownedItemIds.includes(item.id)
            const equipped = equippedId === item.id
            const canBuy = !owned && store.spark >= item.price
            return (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className={`pet-store-tile${equipped ? ' is-equipped' : ''}${owned ? ' is-owned' : ''}`}
                style={{ '--tile-accent': item.accent } as CSSProperties}
              >
                <div className="pet-store-tile-top">
                  <span className="pet-store-tile-glyph" aria-hidden>
                    {item.glyph}
                  </span>
                  <strong>{item.name}</strong>
                </div>
                <p>{item.blurb}</p>
                <div className="pet-store-tile-actions">
                  {owned ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={equipped}
                      onClick={() => onEquip(item.id)}
                    >
                      {equipped ? 'Equipped' : 'Equip'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!canBuy}
                      onClick={() => onBuy(item.id)}
                    >
                      {item.price === 0 ? 'Claim' : `Buy · ${item.price}`}
                    </button>
                  )}
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>

      {stageItems.length === 0 && (
        <p className="pet-store-empty">
          Grow your companion to unlock more of this aisle.
        </p>
      )}

      <p className="pet-store-hint">
        Spark from pulls, schedules, todos, journal, and mood check-ins. New
        aisles open as Blink levels up.
      </p>
    </div>
  )
}

export function storeItemName(id: string): string {
  return catalogItem(id)?.name ?? id
}
