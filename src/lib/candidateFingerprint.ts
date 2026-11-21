/**
 * Stable fingerprint for pull / dismiss memory.
 *
 * Sibling PR owns persisted dismiss sets + “no repeat pulls”.
 * Multi-source uses the same key shape so imports, Gmail, and demo pulls
 * dedupe consistently: `${source}|${normalizedTitle}|${startIso}`.
 */
import type { EventCandidate, SourceKind } from '../types'

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function candidateFingerprint(
  source: SourceKind,
  title: string,
  startIso: string,
): string {
  return `${source}|${normalizeTitle(title)}|${startIso}`
}

export function fingerprintFromCandidate(
  c: Pick<EventCandidate, 'source' | 'title' | 'start'>,
): string {
  return candidateFingerprint(c.source, c.title, c.start)
}

/** Legacy key used before source-aware fingerprints (title|start). */
export function legacyCandidateKey(
  title: string,
  startIso: string,
): string {
  return `${title}|${startIso}`
}

/**
 * Filter fresh candidates against already-seen keys.
 * Accepts both fingerprint and legacy keys so dismiss-memory PR can
 * pass a Set of either (or both) without breaking multi-source.
 */
export function filterUnseenCandidates<
  T extends Pick<EventCandidate, 'source' | 'title' | 'start'>,
>(candidates: T[], seenKeys: Set<string>): T[] {
  return candidates.filter((c) => {
    const fp = fingerprintFromCandidate(c)
    const legacy = legacyCandidateKey(c.title, c.start)
    return !seenKeys.has(fp) && !seenKeys.has(legacy)
  })
}
