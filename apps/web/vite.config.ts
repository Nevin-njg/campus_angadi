import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function readBrowserEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const result: Record<string, string> = {}
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^export\s+/, '')
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    if (!/^VITE_[A-Z0-9_]+$/.test(key)) continue
    let value = line.slice(separator + 1).trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

export default defineConfig(() => {
  // Local development keeps API and browser variables in apps/api/.env. Load only
  // VITE_-prefixed values so NODE_ENV and server credentials never enter the web build.
  const sharedEnvPath = fileURLToPath(new URL('../api/.env', import.meta.url))
  const localEnv = readBrowserEnv(sharedEnvPath)
  const browserEnv = Object.fromEntries(
    Object.entries({ ...localEnv, ...process.env }).filter(
      (entry): entry is [string, string] =>
        entry[0].startsWith('VITE_') && typeof entry[1] === 'string',
    ),
  )
  const browserDefinitions = Object.fromEntries(
    Object.entries(browserEnv).map(([key, value]) => [
      `import.meta.env.${key}`,
      JSON.stringify(value),
    ]),
  )

  return {
    define: browserDefinitions,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          name: 'Campus Angadi',
          short_name: 'Campus Angadi',
          description: 'Campus marketplace for students',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#18181b',
          theme_color: '#f97316',
          orientation: 'portrait-primary',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
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
      },
    },
  }
})
