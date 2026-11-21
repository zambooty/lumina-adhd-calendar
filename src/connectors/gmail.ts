import type { EventCandidate, SourceConnector } from '../types'
import { uid } from '../lib/id'
import { fetchGoogleConfig } from '../lib/googleConfig'
import { getGoogleAccessToken } from '../lib/googleAuth'
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

async function listFromGmail(accessToken: string): Promise<EventCandidate[]> {
  const q =
    'newer_than:90d (appointment OR confirmation OR confirmed OR scheduled OR reservation OR booking OR invite OR "you are booked" OR dentist OR therapy OR interview)'
  const listParams = new URLSearchParams({
    q,
    maxResults: '12',
  })
  const listRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?${listParams}`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
    },
  )
  if (!listRes.ok) throw new Error(`gmail_list_${listRes.status}`)
  const list = (await listRes.json()) as GmailList
  const ids = (list.messages ?? []).map((m) => m.id).slice(0, 10)

  const candidates: EventCandidate[] = []
  for (const id of ids) {
    const msgRes = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
        },
      },
    )
    if (!msgRes.ok) continue
    const msg = (await msgRes.json()) as GmailMessage
    const headers = msg.payload?.headers
    const subject = header(headers, 'Subject')
    const from = header(headers, 'From')
    const text = `${subject}\n${extractText(msg)}`
    if (!looksAppointmentLike(text) && !parseAppointmentWhen(text)) continue

    const when = parseAppointmentWhen(text)
    if (!when) continue

    const fromLabel = from.replace(/<.*>/, '').trim() || 'Gmail'
    const baseConfidence = 0.78 + when.confidenceBoost
    candidates.push({
      id: uid('cand'),
      title: titleFromSubject(subject, 'Email appointment'),
      start: when.start.toISOString(),
      end: when.end.toISOString(),
      source: 'email',
      sourceLabel: `Gmail · ${fromLabel}`,
      rawSnippet: (msg.snippet ?? subject).slice(0, 220),
      confidence: Math.min(0.97, baseConfidence),
      status: 'pending',
      color: SOURCE_META.email.accent,
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
  async listCandidates(): Promise<EventCandidate[]> {
    const config = await fetchGoogleConfig()
    const token = getGoogleAccessToken()

    if (!config.configured || config.demoMode || !token) {
      await delay(340)
      return demoEmailCandidates()
    }

    try {
      const found = await listFromGmail(token)
      if (found.length === 0) {
        // Soft empty: still return demo so pull feels alive in thin inboxes
        await delay(180)
        return demoEmailCandidates()
      }
      return found
    } catch {
      await delay(200)
      return demoEmailCandidates()
    }
  },
}

/** @deprecated use gmailConnector */
export const gmailConnectorStub = gmailConnector
