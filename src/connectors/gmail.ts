import { addDays, addHours, setHours, setMinutes, setSeconds } from 'date-fns'
import type { EventCandidate } from '../types'
import type { ConnectorPullResult, SourceConnector } from './types'
import { uid } from '../lib/id'
import { fetchGoogleConfig } from '../lib/googleConfig'
import {
  clearGoogleToken,
  ensureGoogleAccessToken,
  getGoogleAccessToken,
  getGoogleGrantedScopes,
} from '../lib/googleAuth'
import {
  classifyGoogleApiError,
  googleAuthHeaders,
} from '../lib/googleApiAuth'
import { hasGmailScope } from '../lib/googleScopes'
import {
  looksAppointmentLike,
  parseAppointmentWhen,
} from '../lib/appointmentParse'
import { delay, demoEmailCandidates, SOURCE_META } from './demoData'

type GmailList = {
  messages?: { id: string; threadId: string }[]
}

type GmailHeader = { name: string; value: string }

type GmailMessage = {
  id: string
  snippet?: string
  payload?: {
    headers?: GmailHeader[]
    mimeType?: string
    body?: { data?: string }
    parts?: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }[]
  }
}

function header(headers: GmailHeader[] | undefined, name: string): string {
  const hit = headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  )
  return hit?.value ?? ''
}

function decodeBody(data?: string): string {
  if (!data) return ''
  try {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
    return decodeURIComponent(
      Array.from(atob(normalized), (c) =>
        `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`,
      ).join(''),
    )
  } catch {
    try {
      return atob(data.replace(/-/g, '+').replace(/_/g, '/'))
    } catch {
      return ''
    }
  }
}

function extractText(msg: GmailMessage): string {
  const parts: string[] = []
  if (msg.snippet) parts.push(msg.snippet)
  const payload = msg.payload
  if (!payload) return parts.join('\n')
  if (payload.body?.data) parts.push(decodeBody(payload.body.data))
  for (const part of payload.parts ?? []) {
    if (
      part.mimeType === 'text/plain' ||
      part.mimeType === 'text/html' ||
      !part.mimeType
    ) {
      parts.push(decodeBody(part.body?.data))
    }
  }
  return parts.filter(Boolean).join('\n').slice(0, 4000)
}

function titleFromSubject(subject: string, fallback: string): string {
  const cleaned = subject
    .replace(/^(re|fwd|fw):\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return fallback
  return cleaned.length > 72 ? `${cleaned.slice(0, 69)}…` : cleaned
}

/** Soft default when mail looks appointment-like but has no parseable time. */
function fallbackWhen(now = new Date()): { start: Date; end: Date } {
  const start = setSeconds(
    setMinutes(setHours(addDays(now, 2), 10), 0),
    0,
  )
  return { start, end: addHours(start, 1) }
}

async function listFromGmail(accessToken: string): Promise<EventCandidate[]> {
  const q =
    'newer_than:120d (appointment OR confirmation OR confirmed OR scheduled OR reservation OR booking OR invite OR "you are booked" OR dentist OR therapy OR interview OR checkup OR "check-up" OR meeting OR calendar OR rsvp)'
  const listParams = new URLSearchParams({
    q,
    maxResults: '15',
  })
  const listRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?${listParams}`,
    {
      headers: googleAuthHeaders(accessToken),
    },
  )
  if (listRes.status === 401 || listRes.status === 403) {
    const failure = await classifyGoogleApiError(listRes, 'Gmail')
    throw Object.assign(new Error(failure.message), { googleFailure: failure })
  }
  if (!listRes.ok) throw new Error(`gmail_list_${listRes.status}`)
  const list = (await listRes.json()) as GmailList
  const ids = (list.messages ?? []).map((m) => m.id).slice(0, 12)

  const candidates: EventCandidate[] = []
  for (const id of ids) {
    const msgRes = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      {
        headers: googleAuthHeaders(accessToken),
      },
    )
    if (!msgRes.ok) continue
    const msg = (await msgRes.json()) as GmailMessage
    const headers = msg.payload?.headers
    const subject = header(headers, 'Subject')
    const from = header(headers, 'From')
    const text = `${subject}\n${extractText(msg)}`
    const appointmentLike = looksAppointmentLike(text)
    const when = parseAppointmentWhen(text)

    // Keep appointment-like mail even without a parsed datetime (soft schedule).
    if (!appointmentLike && !when) continue

    const soft = fallbackWhen()
    const resolved = when ?? {
      start: soft.start,
      end: soft.end,
      confidenceBoost: -0.12,
    }

    if (Number.isNaN(resolved.start.getTime())) continue

    const fromLabel = from.replace(/<.*>/, '').trim() || 'Gmail'
    const baseConfidence = 0.72 + (when ? when.confidenceBoost : -0.08)
    candidates.push({
      id: uid('cand'),
      title: titleFromSubject(subject, 'Email appointment'),
      start: resolved.start.toISOString(),
      end: resolved.end.toISOString(),
      source: 'email',
      sourceLabel: `Gmail · ${fromLabel}`,
      rawSnippet: (msg.snippet ?? subject).slice(0, 220),
      confidence: Math.min(0.89, Math.max(0.55, baseConfidence)),
      status: 'pending',
      color: SOURCE_META.email.accent,
      externalId: id,
    })
  }
  return candidates
}

/**
 * Gmail connector — live when OAuth token + secrets exist;
 * otherwise demo/mock candidates.
 */
export const gmailConnector: SourceConnector = {
  id: 'email',
  label: 'Gmail',
  accent: SOURCE_META.email.accent,
  async listCandidates(): Promise<ConnectorPullResult> {
    const config = await fetchGoogleConfig()
    // Soft-refresh only — never open Cap Custom Tabs / GIS from Pull.
    if (config.configured && !config.demoMode && !getGoogleAccessToken()) {
      await ensureGoogleAccessToken({ interactive: false })
    }
    const token = getGoogleAccessToken()

    // Real Google configured: never inject demo Gmail rows — connect or pull live.
    // Pull never opens OAuth; unsigned users must use Connect Google (Custom Tabs).
    if (config.configured && !config.demoMode && !token) {
      return {
        candidates: [],
        error:
          'Not signed in — open Menu → Google connect, then Connect Google. Pull does not use the phone’s system Google account alone.',
        emptyHint: 'Connect Google to pull real Gmail appointments.',
      }
    }
    if (!config.configured || config.demoMode || !token) {
      await delay(340)
      return { candidates: demoEmailCandidates(), usedDemo: true }
    }

    const granted = getGoogleGrantedScopes()
    if (granted && !hasGmailScope(granted)) {
      return {
        candidates: [],
        error:
          'Gmail scope missing — reconnect Google and allow gmail.readonly.',
      }
    }

    try {
      const found = await listFromGmail(token)
      return {
        candidates: found,
        emptyHint:
          found.length === 0
            ? 'No appointment-like Gmail messages matched in the last ~4 months.'
            : undefined,
      }
    } catch (err) {
      const failure = (
        err as {
          googleFailure?: import('../lib/googleApiAuth').GoogleApiFailure
        }
      ).googleFailure
      if (failure) {
        if (failure.shouldClearToken) clearGoogleToken()
        return { candidates: [], error: failure.message }
      }
      const message = err instanceof Error ? err.message : 'gmail_error'
      return {
        candidates: [],
        error: `Gmail pull failed (${message}).`,
      }
    }
  },
}

/** @deprecated use gmailConnector */
export const gmailConnectorStub = gmailConnector
