import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { googleApiPlugin } from './vite-plugin-google-api.js'

export default defineConfig({
  plugins: [react(), googleApiPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
})
