import type { CalendarEvent, EventCandidate, SourceKind } from '../types'

/** How far ahead Google Calendar (and post-filter caps) look. */
export const PULL_WINDOW_DAYS = 14
/** Soft lookback so in-progress / just-started events still appear. */
export const PULL_LOOKBACK_DAYS = 1
/** Max events requested per Google Calendar. */
export const PULL_MAX_PER_CALENDAR = 25
/** Hard cap after dedupe / dismiss filtering across all sources. */
export const PULL_MAX_ITEMS = 30
/** Bound dismissed-key memory so localStorage stays sensible. */
export const MAX_DISMISSED_KEYS = 400

export type PullSkipStats = {
  dismissed: number
  duplicates: number
  capped: number
  seriesCollapsed: number
}

export function emptySkipStats(): PullSkipStats {
  return { dismissed: 0, duplicates: 0, capped: 0, seriesCollapsed: 0 }
}

/** Stable fingerprint: source + normalized title + start (minute precision). */
export function candidateFingerprint(input: {
  title: string
  start: string
  source: SourceKind | string
}): string {
  const title = input.title.trim().toLowerCase().replace(/\s+/g, ' ')
  const startMs = Date.parse(input.start)
  const startKey = Number.isNaN(startMs)
    ? input.start
    : new Date(startMs).toISOString().slice(0, 16)
  return `${input.source}|${title}|${startKey}`
}

export function externalDismissKey(
  source: SourceKind | string,
  externalId: string,
): string {
  return `ext:${source}:${externalId}`
}

export function seriesDismissKey(
  source: SourceKind | string,
  seriesId: string,
): string {
  return `series:${source}:${seriesId}`
}

/** All keys that should be remembered when the user dismisses a candidate. */
export function dismissKeysFor(c: EventCandidate): string[] {
  const keys = [candidateFingerprint(c)]
  if (c.externalId) keys.push(externalDismissKey(c.source, c.externalId))
  if (c.seriesId) keys.push(seriesDismissKey(c.source, c.seriesId))
  return keys
}

export function rememberDismissed(
  existing: string[] | undefined,
  keys: string[],
): string[] {
  const next = [...(existing ?? [])]
  const seen = new Set(next)
  for (const key of keys) {
    if (seen.has(key)) continue
    seen.add(key)
    next.push(key)
  }
  if (next.length <= MAX_DISMISSED_KEYS) return next
  return next.slice(next.length - MAX_DISMISSED_KEYS)
}

export function isDismissed(
  c: EventCandidate,
  dismissed: ReadonlySet<string>,
): boolean {
  if (dismissed.has(candidateFingerprint(c))) return true
  if (c.externalId && dismissed.has(externalDismissKey(c.source, c.externalId))) {
    return true
  }
  if (c.seriesId && dismissed.has(seriesDismissKey(c.source, c.seriesId))) {
    return true
  }
  return false
}

function occupancyKey(title: string, start: string, source?: string): string {
  const fp = candidateFingerprint({
    title,
    start,
    source: source ?? 'any',
  })
  // Title+start alone catches cross-source identicals already scheduled.
  const titleStart = fp.includes('|')
    ? fp.slice(fp.indexOf('|') + 1)
    : fp
  return titleStart
}

/**
 * Collapse Google recurring series to the soonest upcoming instance.
 * Non-series events pass through; identical title+start within a batch are dropped.
 */
export function collapseRecurringCandidates(
  candidates: EventCandidate[],
): { kept: EventCandidate[]; collapsed: number } {
  const bySeries = new Map<string, EventCandidate>()
  const nonSeries: EventCandidate[] = []
  let collapsed = 0

  for (const c of candidates) {
    if (!c.seriesId) {
      nonSeries.push(c)
      continue
    }
    const key = `${c.source}:${c.seriesId}`
    const prev = bySeries.get(key)
    if (!prev) {
      bySeries.set(key, c)
      continue
    }
    collapsed += 1
    if (+new Date(c.start) < +new Date(prev.start)) {
      bySeries.set(key, c)
    }
  }

  const merged = [...nonSeries, ...bySeries.values()].sort(
    (a, b) => +new Date(a.start) - +new Date(b.start),
  )

  // Intra-batch title+start dedupe (same meeting pulled from two calendars, etc.)
  const seen = new Set<string>()
  const kept: EventCandidate[] = []
  for (const c of merged) {
    const key = occupancyKey(c.title, c.start, c.source)
    if (seen.has(key)) {
      collapsed += 1
      continue
    }
    seen.add(key)
    kept.push(c)
  }

  return { kept, collapsed }
}

export type FilterPullInput = {
  found: EventCandidate[]
  dismissedKeys: string[]
  existingCandidates: EventCandidate[]
  existingEvents: CalendarEvent[]
  maxItems?: number
}

export type FilterPullResult = {
  fresh: EventCandidate[]
  stats: PullSkipStats
}

/**
 * Drop dismissed + already-inbox/scheduled duplicates, then apply a hard item cap.
 */
export function filterPulledCandidates({
  found,
  dismissedKeys,
  existingCandidates,
  existingEvents,
  maxItems = PULL_MAX_ITEMS,
}: FilterPullInput): FilterPullResult {
  const dismissed = new Set(dismissedKeys)
  const occupied = new Set<string>()

  for (const c of existingCandidates) {
    occupied.add(occupancyKey(c.title, c.start, c.source))
    if (c.externalId) occupied.add(externalDismissKey(c.source, c.externalId))
    if (c.seriesId) occupied.add(seriesDismissKey(c.source, c.seriesId))
  }
  for (const e of existingEvents) {
    occupied.add(occupancyKey(e.title, e.start, e.source))
  }

  const stats = emptySkipStats()
  const accepted: EventCandidate[] = []

  for (const c of found) {
    if (isDismissed(c, dismissed)) {
      stats.dismissed += 1
      continue
    }
    const occ = occupancyKey(c.title, c.start, c.source)
    const ext =
      c.externalId != null
        ? externalDismissKey(c.source, c.externalId)
        : null
    const series =
      c.seriesId != null ? seriesDismissKey(c.source, c.seriesId) : null
    if (
      occupied.has(occ) ||
      (ext && occupied.has(ext)) ||
      (series && occupied.has(series))
    ) {
      stats.duplicates += 1
      continue
    }
    occupied.add(occ)
    if (ext) occupied.add(ext)
    if (series) occupied.add(series)
    accepted.push(c)
  }

  if (accepted.length <= maxItems) {
    return { fresh: accepted, stats }
  }

  stats.capped = accepted.length - maxItems
  return { fresh: accepted.slice(0, maxItems), stats }
}

export function formatSkipFeedback(stats: PullSkipStats): string | null {
  const bits: string[] = []
  if (stats.dismissed > 0) {
    bits.push(
      `skipped ${stats.dismissed} dismissed`,
    )
  }
  if (stats.duplicates > 0) {
    bits.push(
      `skipped ${stats.duplicates} duplicate${stats.duplicates === 1 ? '' : 's'}`,
    )
  }
  if (stats.seriesCollapsed > 0) {
    bits.push(
      `collapsed ${stats.seriesCollapsed} repeat${stats.seriesCollapsed === 1 ? '' : 's'}`,
    )
  }
  if (stats.capped > 0) {
    bits.push(`capped ${stats.capped} beyond limit`)
  }
  if (!bits.length) return null
  return bits.join(' · ')
}
