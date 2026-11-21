/**
 * Shared text → EventCandidate heuristics for Notes / IMAP paste / SMS / voicemail.
 */
import { addDays, addHours, setHours, setMinutes, setSeconds } from 'date-fns'
import type { EventCandidate, SourceKind } from '../types'
import { uid } from './id'
import {
  looksAppointmentLike,
  parseAppointmentWhen,
} from './appointmentParse'
import { SOURCE_META } from '../connectors/demoData'

function softFallback(now = new Date()): { start: Date; end: Date } {
  const start = setSeconds(
    setMinutes(setHours(addDays(now, 2), 10), 0),
    0,
  )
  return { start, end: addHours(start, 1) }
}

function titleFromLine(line: string, fallback: string): string {
  const cleaned = line
    .replace(/^(re|fwd|fw|subject):\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return fallback
  return cleaned.length > 72 ? `${cleaned.slice(0, 69)}…` : cleaned
}

export type TextIngestOptions = {
  source: SourceKind
  sourceLabel: string
  /** Override accent; defaults to SOURCE_META[source].accent */
  color?: string
  fallbackTitle?: string
}

/**
 * Parse free text (note dump, email body, SMS thread, voicemail transcript)
 * into zero-or-more appointment candidates.
 */
export function textToCandidates(
  text: string,
  opts: TextIngestOptions,
): EventCandidate[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const color = opts.color ?? SOURCE_META[opts.source].accent
  const chunks = splitIntoChunks(trimmed)
  const out: EventCandidate[] = []

  for (const chunk of chunks) {
    const appointmentLike = looksAppointmentLike(chunk)
    const when = parseAppointmentWhen(chunk)
    if (!appointmentLike && !when) continue

    const soft = softFallback()
    const resolved = when ?? {
      start: soft.start,
      end: soft.end,
      confidenceBoost: -0.12,
    }
    if (Number.isNaN(resolved.start.getTime())) continue

    const firstLine =
      chunk
        .split(/\n/)
        .map((l) => l.trim())
        .find(Boolean) ?? opts.fallbackTitle ?? 'Imported appointment'

    const baseConfidence = 0.7 + (when ? when.confidenceBoost : -0.1)
    out.push({
      id: uid('cand'),
      title: titleFromLine(firstLine, opts.fallbackTitle ?? 'Imported appointment'),
      start: resolved.start.toISOString(),
      end: resolved.end.toISOString(),
      source: opts.source,
      sourceLabel: opts.sourceLabel,
      rawSnippet: chunk.slice(0, 220),
      confidence: Math.min(0.92, Math.max(0.55, baseConfidence)),
      status: 'pending',
      color,
    })
  }

  // If nothing matched but text has a weekday/time, still try whole blob once.
  if (out.length === 0) {
    const when = parseAppointmentWhen(trimmed)
    if (when) {
      out.push({
        id: uid('cand'),
        title: titleFromLine(
          trimmed.split(/\n/).find((l) => l.trim()) ?? 'Imported item',
          opts.fallbackTitle ?? 'Imported item',
        ),
        start: when.start.toISOString(),
        end: when.end.toISOString(),
        source: opts.source,
        sourceLabel: opts.sourceLabel,
        rawSnippet: trimmed.slice(0, 220),
        confidence: Math.min(0.88, 0.68 + when.confidenceBoost),
        status: 'pending',
        color,
      })
    }
  }

  return out
}

/** Split dumps into paragraph / bullet / SMS-ish chunks. */
function splitIntoChunks(text: string): string[] {
  const byBlank = text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (byBlank.length > 1) return byBlank

  const byBullet = text
    .split(/\n(?=[-*•]|\d+\.\s)/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (byBullet.length > 1) return byBullet

  // SMS-style: lines starting with Name:
  const bySpeaker = text
    .split(/\n(?=[A-Za-z][\w .'-]{0,24}:\s)/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (bySpeaker.length > 1) return bySpeaker

  return [text.trim()]
}
