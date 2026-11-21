import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.makesoft.lumina',
  appName: 'LUMINA',
  webDir: 'dist',
  // Dark-only shell; matches web theme-color / navy-black base.
  backgroundColor: '#05070c',
  android: {
    // Loads WebView at https://localhost — add this origin in Google Cloud
    // OAuth authorized JavaScript origins when wiring live Google on device.
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
