/**
 * Capacitor / native platform helpers.
 * Safe on web — Cap core is a dependency; isNativePlatform() is false in browsers.
 */
import { Capacitor } from '@capacitor/core'

/** True inside a Capacitor Android/iOS WebView (not desktop/mobile browsers). */
export function isNativeCapacitor(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/** Capacitor platform id: 'android' | 'ios' | 'web'. */
export function capacitorPlatform(): string {
  try {
    return Capacitor.getPlatform()
  } catch {
    return 'web'
  }
}

export function isAndroidNative(): boolean {
  return isNativeCapacitor() && capacitorPlatform() === 'android'
}
