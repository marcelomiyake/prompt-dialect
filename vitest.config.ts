import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: {
    jsx: 'transform',
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
  },
  resolve: {
    alias: {
      'claude-code': fileURLToPath(new URL('tests/support/claude-code-runtime.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    setupFiles: ['tests/setup/jsx.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts'],
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
