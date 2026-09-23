import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // CR-GC-626: die geerbte git-Umgebung raus, BEVOR ein Test laeuft. Unter dem pre-commit-Hook
    // zeigen GIT_DIR/GIT_INDEX_FILE auf das umgebende Repo, und jedes `git` im Testprozess —
    // aus dem Test wie aus dem Produktcode — landete dort statt im Temp-Repo.
    setupFiles: ['tests/setup/git-env.setup.ts'],
    // Kuzu/WASM init is heavier than a unit test; allow headroom.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Single-writer Kuzu per repo — keep the harness store serial.
    fileParallelism: false,
  },
});
