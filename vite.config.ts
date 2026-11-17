import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The backend started with `python -m loccit`.
const BACKEND = 'http://127.0.0.1:8765'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset URLs, so the build works from any folder or a file:// URL.
  base: './',
  // PDF.js is large; this is a local app, not a page loaded over the network.
  build: { chunkSizeWarningLimit: 2000 },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': BACKEND },
  },
})
