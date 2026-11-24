/**
 * Local IMAP connection prefs (host/user/port). App passwords stay in memory
 * only for this page lifetime — never localStorage/sessionStorage (XSS risk).
 */
import type { ImapAccountPrefs } from '../connectors/types'

const KEY = 'lumina_imap_prefs_v1'
const LEGACY_SESSION_PASS_KEY = 'lumina_imap_session_pass'

const DEFAULTS: ImapAccountPrefs = {
  host: '',
  port: 993,
  user: '',
  provider: 'generic',
}

/** In-memory only — cleared on full reload. */
let memoryPassword: string | null = null

function clearLegacySessionPassword(): void {
  try {
    sessionStorage.removeItem(LEGACY_SESSION_PASS_KEY)
  } catch {
    /* ignore */
  }
}

export function loadImapPrefs(): ImapAccountPrefs {
  clearLegacySessionPassword()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<ImapAccountPrefs>
    return {
      host: typeof parsed.host === 'string' ? parsed.host : '',
      port: typeof parsed.port === 'number' ? parsed.port : 993,
      user: typeof parsed.user === 'string' ? parsed.user : '',
      provider:
        parsed.provider === 'outlook' ||
        parsed.provider === 'yahoo' ||
        parsed.provider === 'icloud' ||
        parsed.provider === 'generic'
          ? parsed.provider
          : 'generic',
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveImapPrefs(prefs: ImapAccountPrefs): void {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      host: prefs.host.trim(),
      port: prefs.port || 993,
      user: prefs.user.trim(),
      provider: prefs.provider,
    }),
  )
}

/** Ephemeral app-password for IMAP pull (memory only). */
export function setImapSessionPassword(password: string): void {
  clearLegacySessionPassword()
  memoryPassword = password ? password : null
}

export function getImapSessionPassword(): string | null {
  clearLegacySessionPassword()
  return memoryPassword
}

export const IMAP_PROVIDER_PRESETS: Record<
  ImapAccountPrefs['provider'],
  { label: string; host: string; port: number }
> = {
  outlook: {
    label: 'Outlook / Microsoft 365',
    host: 'outlook.office365.com',
    port: 993,
  },
  yahoo: { label: 'Yahoo Mail', host: 'imap.mail.yahoo.com', port: 993 },
  icloud: { label: 'iCloud Mail', host: 'imap.mail.me.com', port: 993 },
  generic: { label: 'Generic IMAP', host: '', port: 993 },
}
