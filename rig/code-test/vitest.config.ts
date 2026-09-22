import { defineConfig } from 'vitest/config';

// CR-GC-610: die verdeckte Abnahme — eigener Lauf, nicht Teil der graphcode-Suite (tests/**).
export default defineConfig({
  test: {
    root: __dirname,
    include: ['abnahme/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
