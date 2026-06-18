/**
 * TEST-distribution (CR-GC-121) — self-contained npx distribution.
 *
 * Proves `@sigloch/graphcode` publishes as a SELF-CONTAINED npm package that runs
 * via `npx @sigloch/graphcode <verb>` in ANY foreign repo, WITHOUT a copy of the
 * sigloch/aimprove source tree (REQ-self-contained-dist, REQ-npx-distribution,
 * REQ-repo-install, REQ-buildable-standalone, MOD-cli; verifies TEST-harness-install).
 *
 * No mocks. Real esbuild bundle, real `npm pack`, real foreign `npm install` of the
 * resulting tarball (fetching kuzu-wasm / sdk / zod from the registry), real bin run.
 *
 * Asserts:
 *   1. The bundle (`npm run bundle`) inlines all `@sigloch/*` code into dist/cli.js +
 *      dist/index.js, keeps the registry externals, and preserves the cli shebang.
 *   2. The PUBLISHED manifest (packed package.json) has zero `file:` deps and zero
 *      `@sigloch/*` runtime deps.
 *   3. A foreign repo installs the packed tarball from scratch and runs the bin
 *      (`--help` + `init`) with NO sigloch source tree present — fully self-contained.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..');
const CLI_JS = join(REPO_ROOT, 'dist', 'cli.js');
const INDEX_JS = join(REPO_ROOT, 'dist', 'index.js');

/** A bundled artifact must not reference any `@sigloch/*` module — it's all inlined. */
const SIGLOCH_IMPORT = /(?:from\s*['"]|require\(\s*['"]|import\(\s*['"])@sigloch\//;

function run(cmd: string, args: string[], cwd: string): string {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

describe('TEST-distribution: self-contained npx distribution', () => {
  // Produce the bundle once for the structural assertions (prepack does the same
  // before pack, but we assert the artifact directly here too).
  beforeAll(() => {
    run('npm', ['run', 'build'], REPO_ROOT);
    run('npm', ['run', 'bundle'], REPO_ROOT);
  }, 120_000);

  it('bundles cli.js with a single shebang and no @sigloch imports', () => {
    expect(existsSync(CLI_JS)).toBe(true);
    const cli = readFileSync(CLI_JS, 'utf8');
    // (a) starts with the shebang, exactly once.
    expect(cli.startsWith('#!/usr/bin/env node\n')).toBe(true);
    expect(cli.match(/#!\/usr\/bin\/env node/g)?.length).toBe(1);
    // (b) @sigloch code is INLINED — no module imports remain.
    expect(SIGLOCH_IMPORT.test(cli)).toBe(false);
    // (c) the registry externals are still imported (not inlined).
    expect(cli).toMatch(/@modelcontextprotocol\/sdk/);
    expect(cli).toMatch(/kuzu-wasm/);
    expect(cli).toMatch(/['"]zod/);
  });

  it('bundles index.js with no @sigloch imports but keeps externals', () => {
    expect(existsSync(INDEX_JS)).toBe(true);
    const idx = readFileSync(INDEX_JS, 'utf8');
    // index is the library surface — no shebang.
    expect(idx.startsWith('#!')).toBe(false);
    expect(SIGLOCH_IMPORT.test(idx)).toBe(false);
    expect(idx).toMatch(/kuzu-wasm/);
    expect(idx).toMatch(/['"]zod/);
  });

  it('published manifest has zero file: deps and zero @sigloch runtime deps', () => {
    // `npm pack --dry-run --json` reports the manifest npm would publish.
    const out = run('npm', ['pack', '--dry-run', '--json'], REPO_ROOT);
    const entry = JSON.parse(out)[0] as { files: { path: string }[] };
    const files = entry.files.map((f) => f.path);
    expect(files).toContain('dist/cli.js');
    expect(files).toContain('dist/index.js');

    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    const deps = pkg.dependencies;
    // Runtime deps = only the three genuinely-published registry packages.
    expect(Object.keys(deps).sort()).toEqual(
      ['@modelcontextprotocol/sdk', 'kuzu-wasm', 'zod'].sort(),
    );
    for (const [name, range] of Object.entries(deps)) {
      expect(range.startsWith('file:')).toBe(false);
      expect(name.startsWith('@sigloch/')).toBe(false);
    }
  });

  it(
    'installs from a packed tarball into a foreign repo and runs the bin without the sigloch source tree',
    () => {
      const pack = mkdtempSync(join(tmpdir(), 'graphcode-pack-'));
      const foreign = mkdtempSync(join(tmpdir(), 'graphcode-foreign-'));
      try {
        // Real pack — `prepack` rebuilds + rebundles, so the tarball is self-contained.
        const tgz = run('npm', ['pack', '--pack-destination', pack], REPO_ROOT).trim().split('\n').pop()!;
        const tarball = join(pack, tgz);
        expect(existsSync(tarball)).toBe(true);

        // The packed manifest itself must carry no file:/@sigloch runtime deps.
        const manifestOut = run('tar', ['-xzOf', tarball, 'package/package.json'], pack);
        const manifest = JSON.parse(manifestOut) as { dependencies: Record<string, string> };
        for (const [name, range] of Object.entries(manifest.dependencies)) {
          expect(range.startsWith('file:')).toBe(false);
          expect(name.startsWith('@sigloch/')).toBe(false);
        }

        // Fresh foreign repo; install the tarball (fetches kuzu-wasm/sdk/zod from npm).
        run('npm', ['init', '-y'], foreign);
        run('npm', ['install', '--omit=dev', tarball], foreign);

        // Only `@sigloch/graphcode` is present under node_modules/@sigloch — the
        // source-tree packages (contracts/graph-api-core/graph-cypher-wasm) are NOT,
        // because they were inlined into the bundle (self-contained).
        const siglochDir = join(foreign, 'node_modules', '@sigloch');
        expect(readdirSync(siglochDir)).toEqual(['graphcode']);

        // Run the installed bin: usage + a real init scaffold, no sigloch tree needed.
        const binHelp = run(
          'node',
          [join(foreign, 'node_modules', '.bin', 'graphcode'), '--help'],
          foreign,
        );
        // --help writes to stderr; execFileSync returns stdout, so capture both paths.
        // The verb still exits 0; assert via a init run which reports on stderr too.
        const initOut = execFileSync(
          'node',
          [join(foreign, 'node_modules', '.bin', 'graphcode'), 'init'],
          { cwd: foreign, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
        );
        // init prints nothing on stdout (reserved for MCP); the scaffold side-effects prove it ran.
        void binHelp;
        void initOut;
        expect(existsSync(join(foreign, '.mcp.json'))).toBe(true);
        expect(existsSync(join(foreign, '.graphcode'))).toBe(true);
        expect(existsSync(join(foreign, 'GRAPHCODE.md'))).toBe(true);
        // CR-GC-133: the SE skills ship in the tarball and init copies them in — proven
        // end-to-end through a real foreign install (skills resolved relative to the bundle).
        expect(existsSync(join(foreign, '.claude', 'skills', 'se-fmea.md'))).toBe(true);
        const mcp = JSON.parse(readFileSync(join(foreign, '.mcp.json'), 'utf8')) as {
          mcpServers: { graphcode: { command: string; args: string[] } };
        };
        expect(mcp.mcpServers.graphcode.command).toBe('npx');
        expect(mcp.mcpServers.graphcode.args).toContain('@sigloch/graphcode');
      } finally {
        rmSync(pack, { recursive: true, force: true });
        rmSync(foreign, { recursive: true, force: true });
      }
    },
    180_000,
  );
});
