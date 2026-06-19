import { defineConfig } from 'vitest/config';

// Desktop (Electron main) integration tests. Core unit tests live in packages/core.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
