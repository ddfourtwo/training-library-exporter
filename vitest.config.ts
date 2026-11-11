import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    // tests/e2e holds Playwright specs, which have their own runner.
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/components/**/*.test.tsx'],
    // The release orchestration test shells out to a script that waits on a
    // simulated CI run.
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
