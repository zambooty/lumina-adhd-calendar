/**
 * Capacitor: when Chrome Custom Tabs finishes Google OAuth and Android
 * routes https://localhost/?code=… back into LUMINA, close the Browser
 * overlay (iOS) and let hydrateGoogleAuthFromRedirect run (URL already has
 * params, or we assign from appUrlOpen).
 *
 * Android: skip Browser.close() — deep-linking into singleTask MainActivity
 * already clears the Custom Tab; close() can re-open the auth URL / hang
 * the next Browser.open (capacitor-plugins#2610).
 */
import { isAndroidNative, isNativeCapacitor } from './platform'

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
      const hasCode = parsed.searchParams.has('code')
      const hasError = parsed.searchParams.has('error')
      if (!hasCode && !hasError) return

      if (!isAndroidNative()) {
        try {
          await Browser.close()
        } catch {
          /* already closed */
        }
      }

      // Reload into the Cap WebView with OAuth query so hydrate can run.
      // sessionStorage OAuth state survives same-origin assign (soft-security Cap).
      const next = `${parsed.pathname}${parsed.search}${parsed.hash}` || `/${parsed.search}`
      if (window.location.search !== parsed.search) {
        window.location.assign(next.startsWith('/') ? next : `/${next}`)
      }
    })
  } catch (err) {
    console.warn('Cap OAuth return listener unavailable', err)
  }
}
