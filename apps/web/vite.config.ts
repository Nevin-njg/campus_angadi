import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@campusbaza/config': fileURLToPath(
        new URL('../../packages/config/dist/index.js', import.meta.url),
      ),
      '@campusbaza/contracts': fileURLToPath(
        new URL('../../packages/contracts/dist/index.js', import.meta.url),
      ),
      '@campusbaza/validation': fileURLToPath(
        new URL('../../packages/validation/dist/index.js', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
