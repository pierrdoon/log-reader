import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'out/',
        'build/',
        '*.config.*',
        'src/renderer/src/main.tsx',
        'src/renderer/index.html'
      ]
    }
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, './src/renderer/src')
    }
  }
})

