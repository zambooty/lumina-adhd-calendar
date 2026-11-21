import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import {
  hydrateGoogleAuthFromRedirect,
  isGoogleConnected,
} from './lib/googleAuth'
import { loadState, saveState } from './lib/storage'

async function boot() {
  // Finish mobile OAuth redirect before first paint of the main shell.
  try {
    const result = await hydrateGoogleAuthFromRedirect()
    // Avoid dumping users back on the hero after a successful Google redirect.
    if (result.ok || isGoogleConnected()) {
      const state = loadState()
      if (!state.hasSeenHero) {
        saveState({ ...state, hasSeenHero: true })
      }
    }
  } catch (err) {
    console.warn('Google redirect hydrate failed', err)
  }

  const root = document.getElementById('root')
  if (!root) return

  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}

void boot()
