import type { CapacitorConfig } from '@capacitor/cli'

/** Keep in sync with src/lib/publishedOrigin.ts + server/originAllowlist.ts */
const PUBLISHED_APP_ORIGIN = 'https://lumina-calendar-f5eb.apps.grok.bot'

/**
 * Android Capacitor shell.
 *
 * Default: bundled `dist/` at https://localhost (androidScheme). `/api/*` is
 * reached via absolute published origin (see src/lib/apiBase.ts) so one Google
 * OAuth Web client works with Cap origins `https://localhost` (+ `/`).
 *
 * Escape hatch: set CAP_SERVER_URL to the published app to load UI+API remote
 * (same-origin OAuth with existing Console entries — no Cap origins required).
 */
const remoteServerUrl = (process.env.CAP_SERVER_URL ?? '').trim() || undefined

const config: CapacitorConfig = {
  appId: 'com.makesoft.lumina',
  appName: 'LUMINA',
  webDir: 'dist',
  // Dark-only shell; matches web theme-color / navy-black base.
  backgroundColor: '#05070c',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
    ...(remoteServerUrl ? { url: remoteServerUrl } : {}),
    // In-WebView fallback when Custom Tabs fail. Keep this tight — no
    // *.google.com / *.googleusercontent.com (UGC / open redirect surface).
    // Prefer @capacitor/browser Custom Tabs for the real OAuth path.
    allowNavigation: [
      'accounts.google.com',
      'www.google.com',
      'google.com',
      '*.googleapis.com',
      new URL(PUBLISHED_APP_ORIGIN).hostname,
    ],
  },
  plugins: {
    LocalNotifications: {
      // White-on-transparent status bar icon (res/drawable).
      smallIcon: 'ic_stat_lumina',
      iconColor: '#7dd3fc',
    },
  },
}

export default config
