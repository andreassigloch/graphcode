/**
 * TEST-distribution (CR-GC-121, contract rewritten by CR-GC-262) — npx distribution.
 *
 * Proves `@sigloch/graphcode` publishes as a package that installs and runs via
 * `npx @sigloch/graphcode <verb>` in ANY foreign repo, WITHOUT a copy of the sigloch
 * source tree (REQ-self-contained-dist, REQ-npx-distribution, REQ-repo-install,
 * REQ-buildable-standalone, MOD-cli — the real install verifier).
 *
 * The MECHANISM changed with CR-GC-262 and this test changed with it. Until the five
 * `@sigloch/*` packages existed on npm, "self-contained" meant esbuild inlined them
 * into `dist/cli.js` + `dist/index.js`, because a published manifest with a `file:`
 * range is not installable. That bought installability at the price of two broken
 * subpath exports (`./harness`, `./mcp` kept importing bare `@sigloch/*`, which the
 * tarball could not resolve). Since CR-214 they are registry packages, so the
 * requirement is met the ordinary way: real dependencies, resolved by npm.
 *
 * No mocks. Real `npm pack`, real foreign `npm install` of the tarball (fetching every
 * dependency from the registry), real bin run.
 *
 * Asserts:
 *   1. The published manifest carries NO `file:` range — the property that actually
 *      makes a foreign install possible.
 *   2. A foreign repo installs the packed tarball from scratch and runs the bin
 *      (`init`) with NO sigloch source tree present.
 *   3. Both entrypoints AND the subpath exports resolve in that foreign repo.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = join(__dirname, '..');
const CLI_JS = join(REPO_ROOT, 'dist', 'cli.js');

/** The substrate packages graphcode consumes from the registry (CR-214, CR-SM-248). */
const SUBSTRATE = [
  '@sigloch/contracts',
  '@sigloch/graph-api-core',
  '@sigloch/learning-core',
  '@sigloch/se-engine',
];

function run(cmd: string, args: string[], cwd: string): string {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

describe('TEST-distribution: npx distribution', () => {
  beforeAll(() => {
    run('npm', ['run', 'build'], REPO_ROOT);
  }, 120_000);

  it('emits an executable cli.js with a single shebang', () => {
    expect(existsSync(CLI_JS)).toBe(true);
    const cli = readFileSync(CLI_JS, 'utf8');
    expect(cli.startsWith('#!/usr/bin/env node\n')).toBe(true);
    expect(cli.match(/#!\/usr\/bin\/env node/g)?.length).toBe(1);
  });

  it('declares the substrate as real registry dependencies, never as file: ranges', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    for (const name of SUBSTRATE) {
      expect(pkg.dependencies[name]).toBeDefined();
      expect(pkg.dependencies[name].startsWith('file:')).toBe(false);
    }
    // A file: range anywhere in the manifest breaks a foreign install — that is the
    // real invariant, not which packages happen to be listed.
    for (const range of Object.values({ ...pkg.dependencies, ...pkg.devDependencies })) {
      expect(range.startsWith('file:')).toBe(false);
    }
  });

  it('packs the tarball with both entrypoints and the shipped skills', () => {
    // Read the real tarball rather than `npm pack --json`: that report's shape has
    // moved between npm majors (CI runs npm@latest, a dev box whatever Node ships),
    // and the artifact is the thing under test anyway.
    const dir = mkdtempSync(join(tmpdir(), 'graphcode-packlist-'));
    try {
      const tgz = run('npm', ['pack', '--pack-destination', dir], REPO_ROOT).trim().split('\n').pop()!;
      const files = run('tar', ['-tzf', join(dir, tgz)], dir)
        .split('\n')
        .map((f) => f.replace(/^package\//, ''));
      expect(files).toContain('dist/cli.js');
      expect(files).toContain('dist/index.js');
      expect(files).toContain('dist/harness.js');
      expect(files.some((f) => f.startsWith('.claude/commands/se'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // CR-GC-270: the handshake version must come FROM package.json, never from a
  // literal. 0.5.0 shipped announcing "0.4.1" because the constant was not
  // hand-carried on release — and `npx -y` consumers always pull latest, so the
  // one place a user reads the running version was the one place that lied.
  // Asserted against the BUILT artifact, since that is what a consumer executes.
  it('announces the package.json version in the MCP handshake, not a literal', async () => {
    const pkgVersion = (
      JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as { version: string }
    ).version;

    const built = join(REPO_ROOT, 'dist', 'mcp-server.js');
    expect(existsSync(built)).toBe(true);

    // No hardcoded semver may remain in the compiled module.
    const src = readFileSync(built, 'utf8');
    const literalVersion = /SERVER_VERSION\s*=\s*['"]\d+\.\d+\.\d+['"]/.test(src);
    expect(literalVersion).toBe(false);

    // And the value the server advertises must equal the manifest.
    const { readPackageVersion } = (await import(pathToFileURL(built).href)) as {
      readPackageVersion: () => string;
    };
    expect(readPackageVersion()).toBe(pkgVersion);
  });

  it(
    'installs from a packed tarball into a foreign repo and runs the bin without the sigloch source tree',
    () => {
      const pack = mkdtempSync(join(tmpdir(), 'graphcode-pack-'));
      const foreign = mkdtempSync(join(tmpdir(), 'graphcode-foreign-'));
      try {
        // Real pack — `prepack` rebuilds first.
        const tgz = run('npm', ['pack', '--pack-destination', pack], REPO_ROOT).trim().split('\n').pop()!;
        const tarball = join(pack, tgz);
        expect(existsSync(tarball)).toBe(true);

        // The packed manifest must carry no file: range — the foreign install would fail.
        const manifestOut = run('tar', ['-xzOf', tarball, 'package/package.json'], pack);
        const manifest = JSON.parse(manifestOut) as { dependencies: Record<string, string> };
        for (const range of Object.values(manifest.dependencies)) {
          expect(range.startsWith('file:')).toBe(false);
        }

        // Fresh foreign repo; install the tarball (fetches every dep from the registry).
        run('npm', ['init', '-y'], foreign);
        run('npm', ['install', '--omit=dev', tarball], foreign);

        // Run the installed bin: a real init scaffold, no sigloch source tree present.
        execFileSync('node', [join(foreign, 'node_modules', '.bin', 'graphcode'), 'init'], {
          cwd: foreign,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        expect(existsSync(join(foreign, '.mcp.json'))).toBe(true);
        expect(existsSync(join(foreign, 'opencode.json'))).toBe(true); // CR-GC-263
        expect(existsSync(join(foreign, '.graphcode'))).toBe(true);
        expect(existsSync(join(foreign, 'GRAPHCODE.md'))).toBe(true);
        // CR-GC-133/277: the SE skills ship in the tarball and init copies them in
        // as commands — the legacy flat skills dir must NOT reappear.
        expect(existsSync(join(foreign, '.claude', 'commands', 'se-fmea.md'))).toBe(true);
        expect(existsSync(join(foreign, '.claude', 'skills'))).toBe(false);

        const mcp = JSON.parse(readFileSync(join(foreign, '.mcp.json'), 'utf8')) as {
          mcpServers: { graphcode: { command: string; args: string[] } };
        };
        expect(mcp.mcpServers.graphcode.command).toBe('npx');
        // Feste Version in der Startzeile (CR-GC-378): was der Agent-Host bootet, ist
        // eine Zahl im Repo und kein npx-Auflösungsergebnis.
        expect(mcp.mcpServers.graphcode.args).toContain(
          `@sigloch/graphcode@${(JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as { version: string }).version}`,
        );

        // Every export path resolves in the foreign install — the subpaths were broken
        // for as long as only the two entrypoints were bundled (CR-GC-262).
        const probe = [
          "const p = await import('@sigloch/graphcode');",
          "const h = await import('@sigloch/graphcode/harness');",
          "const m = await import('@sigloch/graphcode/mcp');",
          "if (!p || !h || !m) throw new Error('export missing');",
          "process.stdout.write('ok');",
        ].join('\n');
        const resolved = execFileSync('node', ['--input-type=module', '-e', probe], {
          cwd: foreign,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        expect(resolved).toBe('ok');
      } finally {
        rmSync(pack, { recursive: true, force: true });
        rmSync(foreign, { recursive: true, force: true });
      }
    },
    180_000,
  );

  /**
   * CR-SM-248 — the substrate ships exactly once, and no package hangs on itself.
   *
   * This is the net for a defect class that has now occurred twice, in two different
   * repos: `@sigloch/contracts@5.0.0` declared `"@sigloch/contracts": "^4.1.0"` and
   * `@sigloch/graphify@0.2.0` declared `"@sigloch/graphify": "file:"`. npm honours such
   * a line by nesting a second copy of the package inside itself — so one tree carried
   * contracts 5.0.0 *and* 4.2.0. Nothing catches that upstream: TypeScript types
   * structurally, the runtime checks no identity, and every test stays green while two
   * ontologies live in one process.
   *
   * It is asserted HERE rather than in a single package because graphcode is the only
   * place all @sigloch packages meet — `contracts/tests/unit/layering.test.ts` guards
   * the monorepo, and graphify (a separate repo) slipped straight past it.
   */
  it('installs each @sigloch package exactly once, and none depends on itself', () => {
    const root = join(REPO_ROOT, 'node_modules', '@sigloch');
    const manifests: Array<{ path: string; name: string; version: string; self: string[] }> = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const child = join(dir, entry.name);
        const pkgFile = join(child, 'package.json');
        if (existsSync(pkgFile)) {
          const m = JSON.parse(readFileSync(pkgFile, 'utf8')) as {
            name?: string;
            version?: string;
            dependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
          };
          if (m.name) {
            manifests.push({
              path: child.slice(REPO_ROOT.length + 1),
              name: m.name,
              version: m.version ?? '?',
              self: [...Object.keys(m.dependencies ?? {}), ...Object.keys(m.peerDependencies ?? {})]
                .filter((d) => d === m.name),
            });
          }
        }
        const nested = join(child, 'node_modules', '@sigloch');
        if (existsSync(nested)) walk(nested);
      }
    };
    walk(root);

    // The guard is worthless if it walked an empty tree.
    expect(manifests.length).toBeGreaterThanOrEqual(5);

    const selfDeps = manifests.filter((m) => m.self.length > 0).map((m) => `${m.name} -> itself`);
    expect(selfDeps).toEqual([]);

    const byName = new Map<string, string[]>();
    for (const m of manifests) byName.set(m.name, [...(byName.get(m.name) ?? []), `${m.version} @ ${m.path}`]);
    const duplicated = [...byName.entries()]
      .filter(([, copies]) => copies.length > 1)
      .map(([name, copies]) => `${name}: ${copies.join(' | ')}`);
    expect(duplicated).toEqual([]);
  });
});
