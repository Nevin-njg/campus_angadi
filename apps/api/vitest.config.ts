import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    clearMocks: true,
    // Every worker starts an isolated MongoDB instance. Keeping the worker pool
    // bounded avoids resource-contention timeouts on CI and developer laptops.
    maxWorkers: 4,
  },
})
