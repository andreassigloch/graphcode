/**
 * esbuild.config.mjs — self-contained publish bundle (CR-GC-121, MOD-cli).
 *
 * `npm run bundle` produces the PUBLISHED artifact. The three `@sigloch/*` deps
 * are local `file:` packages (devDependencies) — a published manifest with `file:`
 * deps is NOT installable in a foreign repo (REQ-self-contained-dist). So we INLINE
 * every `@sigloch/*` module into `dist/cli.js` + `dist/index.js`, and keep only the
 * genuinely-published npm packages (`kuzu-wasm`, `@modelcontextprotocol/sdk`, `zod`)
 * EXTERNAL — a foreign `npm install` resolves those from the registry.
 *
 * `npm run build` (tsc) is unchanged: it still emits per-module `.js` + `.d.ts` for
 * vitest, the public `exports` subpaths, types, and scripts/export-graph.mjs. This
 * bundle then OVERWRITES `dist/cli.js` + `dist/index.js` with the inlined variants.
 *
 * @author andreas@siglochconsulting
 */
import { build } from 'esbuild';

/**
 * Externalize every bare import EXCEPT `@sigloch/*` (which gets inlined). Relative
 * and absolute paths fall through to esbuild's normal resolution (they're bundled).
 */
const inlineSiglochExternalRest = {
  name: 'inline-sigloch-external-rest',
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => {
      // Entry points + already-resolved relative/absolute imports: let esbuild bundle.
      if (args.kind === 'entry-point') return undefined;
      if (args.path.startsWith('.') || args.path.startsWith('/')) return undefined;
      // `@sigloch/*` → inline (bundle into the artifact). Everything else bare = external.
      if (args.path === '@sigloch' || args.path.startsWith('@sigloch/')) return undefined;
      return { path: args.path, external: true };
    });
  },
};

/** Shared options for both entries (`platform: 'node'`, ESM, node22, inline @sigloch). */
const common = {
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  logLevel: 'info',
  plugins: [inlineSiglochExternalRest],
};

// cli.ts carries `#!/usr/bin/env node`; esbuild preserves a leading shebang from the
// entry into the output, so the bundled bin stays directly executable. We do NOT add
// a `banner` shebang — esbuild does not dedup it against the preserved shebang, which
// would yield a double `#!` line (a syntax error). Preservation alone is sufficient.
await build({
  ...common,
  entryPoints: { cli: 'src/cli.ts' },
  outdir: 'dist',
});

// index.ts is the library surface — no shebang.
await build({
  ...common,
  entryPoints: { index: 'src/index.ts' },
  outdir: 'dist',
});
