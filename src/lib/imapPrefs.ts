/**
 * Local IMAP connection prefs (host/user/port). Passwords stay in the browser
 * session only when the user opts in — never committed, never logged.
 */
import type { ImapAccountPrefs } from '../connectors/types'

const KEY = 'lumina_imap_prefs_v1'
const SESSION_PASS_KEY = 'lumina_imap_session_pass'

const DEFAULTS: ImapAccountPrefs = {
  host: '',
  port: 993,
  user: '',
  provider: 'generic',
}

export function loadImapPrefs(): ImapAccountPrefs {
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

/** Ephemeral app-password for a future live IMAP pull (session only). */
export function setImapSessionPassword(password: string): void {
  try {
    if (password) sessionStorage.setItem(SESSION_PASS_KEY, password)
    else sessionStorage.removeItem(SESSION_PASS_KEY)
  } catch {
    /* ignore */
  }
}

export function getImapSessionPassword(): string | null {
  try {
    return sessionStorage.getItem(SESSION_PASS_KEY)
  } catch {
    return null
  }
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
