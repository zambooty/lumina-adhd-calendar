/**
 * Notes connector — paste / file import on web; demo samples only when not live.
 */
import type { ConnectorPullResult, SourceConnector } from './types'
import { delay, demoNotesCandidates, SOURCE_META } from './demoData'
import { textToCandidates } from '../lib/textToCandidates'
import { enqueueImports, takeImports } from '../lib/importQueue'
import { fetchGoogleConfig } from '../lib/googleConfig'
import { getGoogleAccessToken } from '../lib/googleAuth'

async function isGoogleLive(): Promise<boolean> {
  const config = await fetchGoogleConfig()
  return (
    config.configured && !config.demoMode && Boolean(getGoogleAccessToken())
  )
}

export const notesConnector: SourceConnector = {
  id: 'notes',
  label: SOURCE_META.notes.label,
  accent: SOURCE_META.notes.accent,
  async listCandidates(): Promise<ConnectorPullResult> {
    const imported = takeImports('notes')
    if (imported.length) {
      return {
        candidates: imported,
        emptyHint: undefined,
      }
    }

    await delay(160)
    if (await isGoogleLive()) {
      return {
        candidates: [],
        emptyHint:
          'No Notes imports yet — paste a brain dump or upload a .txt / .md file.',
      }
    }
    return { candidates: demoNotesCandidates(), usedDemo: true }
  },
  async ingestText(text, meta) {
    const candidates = textToCandidates(text, {
      source: 'notes',
      sourceLabel: meta?.label ?? 'Notes · Import',
      fallbackTitle: 'Note appointment',
    })
    enqueueImports(candidates)
    return { added: candidates.length, candidates }
  },
}
