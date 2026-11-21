/**
 * Non-Gmail email connector (Outlook / Yahoo / generic IMAP).
 *
 * Working path without secrets: paste email body / .eml text → parse → queue.
 * IMAP prefs (host/user/port) persist locally; live fetch is stubbed until
 * server-side IMAP + secrets are wired (status: imapLiveConfigured).
 *
 * Gmail stays on `gmailConnector` — this connector coexists under source `email`
 * with distinct sourceLabels (IMAP · …). Only IMAP paste uses the import queue
 * for `email`, so Gmail never collides.
 */
import type { ConnectorPullResult, SourceConnector } from './types'
import { SOURCE_META } from './demoData'
import { textToCandidates } from '../lib/textToCandidates'
import { enqueueImports, takeImports } from '../lib/importQueue'
import { fetchCaptureConfig } from '../lib/captureConfig'
import {
  getImapSessionPassword,
  loadImapPrefs,
} from '../lib/imapPrefs'

export const imapEmailConnector: SourceConnector = {
  id: 'email',
  label: 'IMAP / other email',
  accent: SOURCE_META.email.accent,
  async listCandidates(): Promise<ConnectorPullResult> {
    const imported = takeImports('email')
    if (imported.length) {
      return { candidates: imported }
    }

    const prefs = loadImapPrefs()
    const capture = await fetchCaptureConfig()
    const hasCreds =
      Boolean(prefs.host && prefs.user) && Boolean(getImapSessionPassword())

    if (capture.imapLiveConfigured && hasCreds) {
      return {
        candidates: [],
        emptyHint:
          'IMAP live fetch is configured but not yet connected — paste an email body for now.',
      }
    }

    if (prefs.host && prefs.user) {
      return {
        candidates: [],
        emptyHint: `IMAP prefs saved (${prefs.provider} · ${prefs.host}) — paste mail to import, or bind IMAP live secrets later.`,
      }
    }

    return {
      candidates: [],
      emptyHint:
        'No IMAP imports yet — paste an Outlook/Yahoo/other email, or save IMAP prefs below.',
    }
  },
  async ingestText(text, meta) {
    const prefs = loadImapPrefs()
    const providerLabel =
      prefs.provider === 'generic'
        ? 'IMAP'
        : prefs.provider.charAt(0).toUpperCase() + prefs.provider.slice(1)
    const candidates = textToCandidates(text, {
      source: 'email',
      sourceLabel: meta?.label ?? `IMAP · ${providerLabel}`,
      fallbackTitle: 'Email appointment',
    })
    enqueueImports(candidates)
    return { added: candidates.length, candidates }
  },
}
