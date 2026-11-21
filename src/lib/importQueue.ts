/**
 * Local import queue for paste/upload captures.
 * Survives across pulls until consumed; never sent to a server.
 */
import type { EventCandidate, SourceKind } from '../types'

const KEY = 'lumina_capture_import_queue_v1'

export type QueuedImport = {
  id: string
  source: SourceKind
  candidate: EventCandidate
  queuedAt: string
}

function readAll(): QueuedImport[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as QueuedImport[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(items: QueuedImport[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* quota / private mode */
  }
}

export function enqueueImports(candidates: EventCandidate[]): number {
  if (!candidates.length) return 0
  const now = new Date().toISOString()
  const existing = readAll()
  const next = [
    ...existing,
    ...candidates.map((candidate) => ({
      id: candidate.id,
      source: candidate.source,
      candidate,
      queuedAt: now,
    })),
  ]
  writeAll(next)
  return candidates.length
}

/** Peek without removing. */
export function peekImports(source?: SourceKind): EventCandidate[] {
  const all = readAll()
  return all
    .filter((q) => (source ? q.source === source : true))
    .map((q) => q.candidate)
}

/**
 * Take queued imports for a source (or all) and clear them from the queue.
 */
export function takeImports(source?: SourceKind): EventCandidate[] {
  const all = readAll()
  const taken = all.filter((q) => (source ? q.source === source : true))
  const remain = source ? all.filter((q) => q.source !== source) : []
  writeAll(remain)
  return taken.map((q) => q.candidate)
}

export function clearImportQueue(): void {
  writeAll([])
}

export function importQueueCount(source?: SourceKind): number {
  return peekImports(source).length
}
