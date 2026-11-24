/**
 * Pet gamification store — currency (Spark), catalog unlocks, buy/equip.
 * Kept separate from CompanionPet UI so floating-pet work can land cleanly.
 */
import type { PetStage, PetStoreItemKind, PetStoreState } from '../types'
import { petStage, petXp } from './pet'

export const PET_STORE_CATALOG_VERSION = 1

export type PetStoreCatalogItem = {
  id: string
  kind: PetStoreItemKind
  name: string
  blurb: string
  /** Spark price (0 = free starter). */
  price: number
  /** Min pet stage required to unlock in the shop. */
  unlockStage: PetStage
  /** Accent hex for swatches / preview. */
  accent: string
  /** Glyph / short label shown in glass tiles. */
  glyph: string
}

const STAGE_ORDER: PetStage[] = [
  'egg',
  'hatchling',
  'cub',
  'glowfox',
  'legend',
]

export function stageReached(current: PetStage, need: PetStage): boolean {
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(need)
}

/** Full shop catalog — skins, animals, clothes, colors, pet-for-pet. */
export const PET_STORE_CATALOG: PetStoreCatalogItem[] = [
  // Animals
  {
    id: 'animal-blink',
    kind: 'animal',
    name: 'Blink fox',
    blurb: 'Your default chaos companion.',
    price: 0,
    unlockStage: 'egg',
    accent: '#3dffd4',
    glyph: 'Fx',
  },
  {
    id: 'animal-nebula-cat',
    kind: 'animal',
    name: 'Nebula cat',
    blurb: 'Soft paws. Sharp calendar takes.',
    price: 40,
    unlockStage: 'hatchling',
    accent: '#a78bfa',
    glyph: 'Ct',
  },
  {
    id: 'animal-pixel-bunny',
    kind: 'animal',
    name: 'Pixel bunny',
    blurb: 'Hop through the backlog.',
    price: 55,
    unlockStage: 'cub',
    accent: '#ff7ad9',
    glyph: 'Bn',
  },
  {
    id: 'animal-orbit-dragon',
    kind: 'animal',
    name: 'Orbit dragon',
    blurb: 'Legend energy. Tiny fire.',
    price: 90,
    unlockStage: 'glowfox',
    accent: '#ffb020',
    glyph: 'Dr',
  },

  // Skins
  {
    id: 'skin-classic',
    kind: 'skin',
    name: 'Classic glass',
    blurb: 'Clean Mix shell look.',
    price: 0,
    unlockStage: 'egg',
    accent: '#7dd3fc',
    glyph: '◇',
  },
  {
    id: 'skin-aurora',
    kind: 'skin',
    name: 'Aurora ribbon',
    blurb: 'Liquid focus shimmer.',
    price: 30,
    unlockStage: 'hatchling',
    accent: '#5CE1E6',
    glyph: '∿',
  },
  {
    id: 'skin-midnight',
    kind: 'skin',
    name: 'Midnight ink',
    blurb: 'Deep navy drama.',
    price: 35,
    unlockStage: 'cub',
    accent: '#1e3a5f',
    glyph: '◆',
  },
  {
    id: 'skin-candy',
    kind: 'skin',
    name: 'Candy orbit',
    blurb: 'Sweet sparkle overload.',
    price: 50,
    unlockStage: 'glowfox',
    accent: '#ff5c6c',
    glyph: '★',
  },

  // Clothes
  {
    id: 'clothes-none',
    kind: 'clothes',
    name: 'No fit',
    blurb: 'Just vibes.',
    price: 0,
    unlockStage: 'egg',
    accent: '#94a3b8',
    glyph: '·',
  },
  {
    id: 'clothes-scarf',
    kind: 'clothes',
    name: 'Focus scarf',
    blurb: 'Warm neck. Clear mind.',
    price: 25,
    unlockStage: 'hatchling',
    accent: '#c8ff4d',
    glyph: 'Sc',
  },
  {
    id: 'clothes-hoodie',
    kind: 'clothes',
    name: 'Soft hoodie',
    blurb: 'ADHD comfort mode.',
    price: 40,
    unlockStage: 'cub',
    accent: '#4db8ff',
    glyph: 'Hd',
  },
  {
    id: 'clothes-crown',
    kind: 'clothes',
    name: 'Tiny crown',
    blurb: 'Main-character tax.',
    price: 70,
    unlockStage: 'legend',
    accent: '#ffb020',
    glyph: 'Cr',
  },

  // Colors
  {
    id: 'color-teal',
    kind: 'color',
    name: 'Teal pulse',
    blurb: 'Signature cyan glow.',
    price: 0,
    unlockStage: 'egg',
    accent: '#3dffd4',
    glyph: '●',
  },
  {
    id: 'color-coral',
    kind: 'color',
    name: 'Coral pop',
    blurb: 'Warm nudge energy.',
    price: 20,
    unlockStage: 'hatchling',
    accent: '#ff5c6c',
    glyph: '●',
  },
  {
    id: 'color-lime',
    kind: 'color',
    name: 'Lime zap',
    blurb: 'Task-done electricity.',
    price: 20,
    unlockStage: 'hatchling',
    accent: '#c8ff4d',
    glyph: '●',
  },
  {
    id: 'color-amber',
    kind: 'color',
    name: 'Amber glow',
    blurb: 'Golden hour focus.',
    price: 25,
    unlockStage: 'cub',
    accent: '#ffb020',
    glyph: '●',
  },
  {
    id: 'color-magenta',
    kind: 'color',
    name: 'Magenta beam',
    blurb: 'Loud and proud.',
    price: 30,
    unlockStage: 'glowfox',
    accent: '#ff7ad9',
    glyph: '●',
  },

  // Pet-for-pet companions
  {
    id: 'companion-none',
    kind: 'companion',
    name: 'Solo mode',
    blurb: 'Just you and Blink.',
    price: 0,
    unlockStage: 'egg',
    accent: '#64748b',
    glyph: '○',
  },
  {
    id: 'companion-spark-moth',
    kind: 'companion',
    name: 'Spark moth',
    blurb: 'Tiny pet for your pet.',
    price: 45,
    unlockStage: 'cub',
    accent: '#fbbf24',
    glyph: 'Mt',
  },
  {
    id: 'companion-tiny-egg',
    kind: 'companion',
    name: 'Pocket egg',
    blurb: 'Next-gen chaos incubating.',
    price: 60,
    unlockStage: 'glowfox',
    accent: '#fef08a',
    glyph: 'Eg',
  },
  {
    id: 'companion-orbit-orb',
    kind: 'companion',
    name: 'Orbit orb',
    blurb: 'Floaty hype particle.',
    price: 80,
    unlockStage: 'legend',
    accent: '#38bdf8',
    glyph: 'Or',
  },
]

export const STORE_KIND_ORDER: PetStoreItemKind[] = [
  'animal',
  'skin',
  'clothes',
  'color',
  'companion',
]

export const STORE_KIND_LABEL: Record<PetStoreItemKind, string> = {
  animal: 'Animals',
  skin: 'Skins',
  clothes: 'Clothes',
  color: 'Colors',
  companion: 'Pet-for-pet',
}

const FREE_STARTERS = PET_STORE_CATALOG.filter((i) => i.price === 0).map(
  (i) => i.id,
)

export function createDefaultPetStore(): PetStoreState {
  return {
    spark: 12,
    ownedItemIds: [...FREE_STARTERS],
    equipped: {
      animalId: 'animal-blink',
      skinId: 'skin-classic',
      clothesId: 'clothes-none',
      colorId: 'color-teal',
      companionId: 'companion-none',
    },
    seenCatalogVersion: 0,
    promptedItemIds: [],
  }
}

export function ensurePetStore(
  raw: PetStoreState | undefined | null,
): PetStoreState {
  const base = createDefaultPetStore()
  if (!raw || typeof raw !== 'object') return base
  const owned = Array.isArray(raw.ownedItemIds)
    ? Array.from(new Set([...FREE_STARTERS, ...raw.ownedItemIds]))
    : base.ownedItemIds
  return {
    spark: typeof raw.spark === 'number' && raw.spark >= 0 ? raw.spark : base.spark,
    ownedItemIds: owned,
    equipped: {
      animalId: raw.equipped?.animalId || base.equipped.animalId,
      skinId: raw.equipped?.skinId || base.equipped.skinId,
      clothesId: raw.equipped?.clothesId || base.equipped.clothesId,
      colorId: raw.equipped?.colorId || base.equipped.colorId,
      companionId: raw.equipped?.companionId || base.equipped.companionId,
    },
    seenCatalogVersion:
      typeof raw.seenCatalogVersion === 'number'
        ? raw.seenCatalogVersion
        : 0,
    promptedItemIds: Array.isArray(raw.promptedItemIds)
      ? raw.promptedItemIds
      : [],
  }
}

export function catalogItem(id: string): PetStoreCatalogItem | undefined {
  return PET_STORE_CATALOG.find((i) => i.id === id)
}

export function itemsForKind(
  kind: PetStoreItemKind,
  stage: PetStage,
): PetStoreCatalogItem[] {
  return PET_STORE_CATALOG.filter(
    (i) => i.kind === kind && stageReached(stage, i.unlockStage),
  )
}

/** Newly unlocked items the user hasn't been prompted about yet. */
export function newlyAvailableItems(
  store: PetStoreState,
  xp: number,
): PetStoreCatalogItem[] {
  const stage = petStage(xp)
  const prompted = new Set(store.promptedItemIds)
  return PET_STORE_CATALOG.filter(
    (i) =>
      i.price > 0 &&
      stageReached(stage, i.unlockStage) &&
      !store.ownedItemIds.includes(i.id) &&
      !prompted.has(i.id),
  )
}

export function countAffordableNew(
  store: PetStoreState,
  xp: number,
): number {
  return newlyAvailableItems(store, xp).filter((i) => store.spark >= i.price)
    .length
}

export type BuyResult =
  | { ok: true; store: PetStoreState }
  | { ok: false; reason: 'missing' | 'locked' | 'owned' | 'broke' }

export function buyStoreItem(
  store: PetStoreState,
  itemId: string,
  xp: number,
): BuyResult {
  const item = catalogItem(itemId)
  if (!item) return { ok: false, reason: 'missing' }
  if (!stageReached(petStage(xp), item.unlockStage)) {
    return { ok: false, reason: 'locked' }
  }
  if (store.ownedItemIds.includes(itemId)) {
    return { ok: false, reason: 'owned' }
  }
  if (store.spark < item.price) return { ok: false, reason: 'broke' }
  return {
    ok: true,
    store: {
      ...store,
      spark: store.spark - item.price,
      ownedItemIds: [...store.ownedItemIds, itemId],
    },
  }
}

export function equipStoreItem(
  store: PetStoreState,
  itemId: string,
): PetStoreState | null {
  const item = catalogItem(itemId)
  if (!item || !store.ownedItemIds.includes(itemId)) return null
  const equipped = { ...store.equipped }
  switch (item.kind) {
    case 'animal':
      equipped.animalId = itemId
      break
    case 'skin':
      equipped.skinId = itemId
      break
    case 'clothes':
      equipped.clothesId = itemId
      break
    case 'color':
      equipped.colorId = itemId
      break
    case 'companion':
      equipped.companionId = itemId
      break
  }
  return { ...store, equipped }
}

export function markItemsPrompted(
  store: PetStoreState,
  itemIds: string[],
): PetStoreState {
  if (!itemIds.length) return store
  return {
    ...store,
    seenCatalogVersion: PET_STORE_CATALOG_VERSION,
    promptedItemIds: Array.from(
      new Set([...store.promptedItemIds, ...itemIds]),
    ),
  }
}

/** Spark rewards for ADHD-friendly actions. */
export const SPARK_REWARDS = {
  schedule: 3,
  pullBatch: 2,
  completeTodo: 2,
  completeEvent: 2,
  journal: 4,
  mood: 3,
  react: 1,
} as const

export function addSpark(
  store: PetStoreState,
  amount: number,
): PetStoreState {
  if (amount <= 0) return store
  return { ...store, spark: store.spark + amount }
}

export function equippedAccent(store: PetStoreState): string {
  return catalogItem(store.equipped.colorId)?.accent ?? '#3dffd4'
}

export function equippedPreview(store: PetStoreState): {
  animal: string
  skin: string
  clothes: string
  color: string
  companion: string
  accent: string
} {
  const animal = catalogItem(store.equipped.animalId)
  const skin = catalogItem(store.equipped.skinId)
  const clothes = catalogItem(store.equipped.clothesId)
  const color = catalogItem(store.equipped.colorId)
  const companion = catalogItem(store.equipped.companionId)
  return {
    animal: animal?.glyph ?? 'Fx',
    skin: skin?.name ?? 'Classic',
    clothes: clothes?.name ?? 'No fit',
    color: color?.name ?? 'Teal',
    companion: companion?.glyph ?? '○',
    accent: color?.accent ?? '#3dffd4',
  }
}

/** Widget-friendly one-liner. */
export function petWidgetLine(
  petName: string,
  store: PetStoreState,
  eventsPulled: number,
  eventsScheduled: number,
): string {
  const xp = petXp({
    name: petName,
    eventsPulled,
    eventsScheduled,
    tasksCompleted: 0,
    journalsLogged: 0,
    moodsLogged: 0,
  })
  const stage = petStage(xp)
  const preview = equippedPreview(store)
  return `${preview.animal} ${petName} · ${stage} · spark ${store.spark}`
}
