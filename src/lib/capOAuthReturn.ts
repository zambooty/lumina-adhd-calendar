/**
 * Capacitor: when Chrome Custom Tabs finishes Google OAuth and Android
 * routes https://localhost/?code=… back into LUMINA, close the Browser
 * overlay (iOS) and let hydrateGoogleAuthFromRedirect run (URL already has
 * params, or we assign from appUrlOpen).
 *
 * Android: skip Browser.close() — deep-linking into singleTask MainActivity
 * already clears the Custom Tab; close() can re-open the auth URL / hang
 * the next Browser.open (capacitor-plugins#2610).
 *
 * Security: only accept OAuth returns on trusted Cap / published schemes +
 * hosts. Arbitrary appUrlOpen URLs with ?code= must not drive navigation.
 * Assign href is same-origin path+allowlisted query only (no //evil / hash).
 */
import {
  isTrustedOAuthReturnUrl,
  safeOAuthReturnAssignHref,
} from './oauthReturnUrl'
import { isAndroidNative, isNativeCapacitor } from './platform'

export { isTrustedOAuthReturnUrl, safeOAuthReturnAssignHref }

let listening = false

export async function installCapOAuthReturnListener(): Promise<void> {
  if (listening || !isNativeCapacitor()) return
  listening = true

  try {
    const { App } = await import('@capacitor/app')
    const { Browser } = await import('@capacitor/browser')

    await App.addListener('appUrlOpen', async ({ url }) => {
      if (!url) return
      let parsed: URL
      try {
        parsed = new URL(url)
      } catch {
        return
      }

      const next = safeOAuthReturnAssignHref(parsed, window.location.origin)
      if (!next) return

      if (!isAndroidNative()) {
        try {
          await Browser.close()
        } catch {
          /* already closed */
        }
      }

      // Reload into the Cap WebView with OAuth query so hydrate can run.
      // sessionStorage OAuth state survives same-origin assign (soft-security Cap).
      // next is already a same-origin `/…` href from safeOAuthReturnAssignHref.
      const nextSearch = new URL(next, window.location.origin).search
      if (window.location.search !== nextSearch) {
        window.location.assign(next)
      }
    })
  } catch (err) {
    console.warn('Cap OAuth return listener unavailable', err)
  }
}
