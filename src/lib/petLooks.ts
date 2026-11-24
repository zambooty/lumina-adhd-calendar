/**
 * Map pet stage + Sparks store cosmetics → WebGL appearance tokens.
 * Keeps mesh code free of catalog IDs.
 */
import type { PetStage, PetStoreState } from '../types'
import { catalogItem, ensurePetStore } from './petStore'

export type PetAnimalKind = 'fox' | 'cat' | 'bunny' | 'dragon'
export type PetSkinKind = 'glass' | 'aurora' | 'midnight' | 'candy'
export type PetClothesKind = 'none' | 'scarf' | 'hoodie' | 'crown'
export type PetCompanionKind = 'none' | 'moth' | 'egg' | 'orb'

export type PetLooks = {
  stage: PetStage
  animal: PetAnimalKind
  skin: PetSkinKind
  clothes: PetClothesKind
  companion: PetCompanionKind
  /** Body / accent hex from equipped color. */
  accent: string
  /** Soft secondary from skin. */
  secondary: string
  /** Ear / tip tint. */
  tip: string
}

const SKIN_SECONDARY: Record<PetSkinKind, string> = {
  glass: '#7dd3fc',
  aurora: '#5CE1E6',
  midnight: '#3d5a80',
  candy: '#ff8fab',
}

const SKIN_TIP: Record<PetSkinKind, string> = {
  glass: '#c8ff4d',
  aurora: '#3dffd4',
  midnight: '#94a3b8',
  candy: '#ffb020',
}

function animalFromId(id: string): PetAnimalKind {
  if (id.includes('cat')) return 'cat'
  if (id.includes('bunny')) return 'bunny'
  if (id.includes('dragon')) return 'dragon'
  return 'fox'
}

function skinFromId(id: string): PetSkinKind {
  if (id.includes('aurora')) return 'aurora'
  if (id.includes('midnight')) return 'midnight'
  if (id.includes('candy')) return 'candy'
  return 'glass'
}

function clothesFromId(id: string): PetClothesKind {
  if (id.includes('scarf')) return 'scarf'
  if (id.includes('hoodie')) return 'hoodie'
  if (id.includes('crown')) return 'crown'
  return 'none'
}

function companionFromId(id: string): PetCompanionKind {
  if (id.includes('moth')) return 'moth'
  if (id.includes('egg')) return 'egg'
  if (id.includes('orb')) return 'orb'
  return 'none'
}

export function resolvePetLooks(
  stage: PetStage,
  store?: PetStoreState | null,
): PetLooks {
  const s = ensurePetStore(store)
  const color = catalogItem(s.equipped.colorId)?.accent ?? '#3dffd4'
  const skin = skinFromId(s.equipped.skinId)
  return {
    stage,
    animal: animalFromId(s.equipped.animalId),
    skin,
    clothes: clothesFromId(s.equipped.clothesId),
    companion: companionFromId(s.equipped.companionId),
    accent: color,
    secondary: SKIN_SECONDARY[skin],
    tip: SKIN_TIP[skin],
  }
}

/** Stage scale — egg tiny → legend slightly larger. */
export function stageScale(stage: PetStage): number {
  switch (stage) {
    case 'egg':
      return 0.86
    case 'hatchling':
      return 0.92
    case 'cub':
      return 1
    case 'glowfox':
      return 1.06
    case 'legend':
      return 1.12
  }
}
