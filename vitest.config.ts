import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Kuzu/WASM init is heavier than a unit test; allow headroom.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Single-writer Kuzu per repo — keep the harness store serial.
    fileParallelism: false,
  },
});
