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
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  readdirSync,
  existsSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = join(__dirname, '..');

/**
 * CR-GC-404 — der Walk des Duplikat-Guards, herausgezogen, damit er PRUEFBAR ist.
 *
 * Er stand als lokale Closure im Test. Als der Guard in der verlinkten Arbeitskopie stumm
 * geschaltet werden musste (Symlinks sind nicht `isDirectory()`, s. dort), gab es keinen Weg
 * zu zeigen, dass er auf einem echten Baum noch faengt — ein uebersprungener Test, dessen
 * Logik niemand mehr laufen sieht, ist kein Guard mehr, sondern totes Gewicht.
 */
interface PkgManifest { path: string; name: string; version: string; self: string[] }

export function collectManifests(root: string, relativeTo: string): PkgManifest[] {
  const manifests: PkgManifest[] = [];
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
            path: child.slice(relativeTo.length + 1),
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
  return manifests;
}

/** Pakete, die sich selbst als dependency fuehren — npm nistet dann eine zweite Kopie ein. */
export const selfDependents = (ms: PkgManifest[]): string[] =>
  ms.filter((m) => m.self.length > 0).map((m) => `${m.name} -> itself`);

/** Pakete, die im Baum mehr als einmal liegen — zwei Ontologien in einem Prozess. */
export function duplicates(ms: PkgManifest[]): string[] {
  const byName = new Map<string, string[]>();
  for (const m of ms) byName.set(m.name, [...(byName.get(m.name) ?? []), `${m.version} @ ${m.path}`]);
  return [...byName.entries()]
    .filter(([, copies]) => copies.length > 1)
    .map(([name, copies]) => `${name}: ${copies.join(' | ')}`);
}

/**
 * CR-GC-403 — das URTEIL des Guards, als Funktion.
 *
 * Der Guard muss VIER Lagen unterscheiden, nicht zwei. CR-GC-404 hatte drei davon auf
 * "irgendein Symlink → uebersprungen" zusammengezogen; damit deckelte ein EINZELNER Link
 * (npm link auf genau ein Schwester-Repo ist der uebliche Fall) den Guard ueber dem Rest
 * des Baums still ab, und ein leerer/fehlender Baum war von einem verlinkten nicht mehr
 * zu unterscheiden.
 */
export type TreeVerdict =
  | { kind: 'missing' }
  | { kind: 'empty' }
  | { kind: 'linked'; links: string[] }
  | {
      kind: 'installed';
      dirs: string[];
      links: string[];
      manifests: number;
      selfDeps: string[];
      dupes: string[];
    };

export function auditSiglochTree(root: string, relativeTo: string): TreeVerdict {
  if (!existsSync(root)) return { kind: 'missing' };
  const entries = readdirSync(root, { withFileTypes: true });
  if (entries.length === 0) return { kind: 'empty' };
  const links = entries.filter((e) => e.isSymbolicLink()).map((e) => e.name);
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  // Nur ein Baum, der GANZ aus Symlinks besteht, ist ein Workspace. Ein einzelner Link
  // (`npm link` auf EIN Schwester-Repo) darf den Guard ueber dem Rest nicht abdecken —
  // sonst haette das Ueberspringen genau die stille Wirkung, die es vermeiden soll.
  if (links.length === entries.length) return { kind: 'linked', links };
  const manifests = collectManifests(root, relativeTo);
  return {
    kind: 'installed',
    dirs,
    links,
    manifests: manifests.length,
    selfDeps: selfDependents(manifests),
    dupes: duplicates(manifests),
  };
}
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
      expect(files).toContain('dist/kernel/harness.js');
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

    const built = join(REPO_ROOT, 'dist', 'surface', 'mcp-server.js');
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
    const verdict = auditSiglochTree(root, REPO_ROOT);

    // VERLINKTE Arbeitskopie (CR-GC-404/403): `npm run link:siblings` ersetzt JEDES
    // @sigloch-Paket durch einen Symlink auf das Schwester-Repo. Den Symlinks zu FOLGEN
    // waere die falsche Reparatur: der Guard prueft eine INSTALLATION (npm hat ein Paket
    // zweimal ausgelegt), und ein Workspace-Verzeichnis ist keine. Also uebersprungen —
    // mit Begruendung in der Ausgabe, kein stiller Deckel. In CI (`npm ci`) liegen echte
    // Verzeichnisse, dort laeuft er vollstaendig.
    if (verdict.kind === 'linked') {
      console.log(
        `[distribution] uebersprungen: alle ${verdict.links.length} @sigloch-Eintraege sind ` +
          `Symlinks (${verdict.links.join(', ')}). Der Guard prueft eine Installation, nicht ` +
          `einen Workspace — in CI (npm ci) laeuft er vollstaendig. ` +
          `\`npm install\` stellt den pruefbaren Zustand wieder her.`,
      );
      return;
    }

    // LEER oder FEHLEND ist NICHT dasselbe wie verlinkt und wird nie uebersprungen: dort
    // ist der Baum kaputt, und ein Guard, der eine kaputte Installation wegwinkt, ist
    // schlimmer als keiner (CR-GC-403, Akzeptanzkriterium 3).
    expect(
      verdict.kind,
      verdict.kind === 'missing'
        ? `${root} existiert nicht — hier ist weder etwas installiert noch etwas verlinkt. ` +
            'Kein Ueberspringen: `npm install` fehlt.'
        : `${root} ist LEER — kein Verzeichnis, kein Symlink. Das ist keine verlinkte ` +
            'Arbeitskopie, sondern eine kaputte Installation.',
    ).toBe('installed');
    if (verdict.kind !== 'installed') return; // Narrowing; die Assertion oben hat schon rot gemeldet.

    // Teilweise verlinkt (npm link auf EIN Schwester-Repo) bleibt pruefbar: die echten
    // Verzeichnisse werden gelaufen, nur die Links fehlen im Nenner.
    if (verdict.links.length > 0) {
      console.log(
        `[distribution] teilweise verlinkt (${verdict.links.join(', ')}) — die ` +
          `${verdict.dirs.length} echten Verzeichnisse werden trotzdem geprueft.`,
      );
    }

    // Der Guard ist wertlos, wenn er einen leeren Baum gelaufen ist: jedes echte
    // Verzeichnis muss ein Manifest geliefert haben.
    expect(verdict.manifests).toBeGreaterThanOrEqual(verdict.dirs.length);
    if (verdict.links.length === 0) expect(verdict.manifests).toBeGreaterThanOrEqual(5);
    expect(verdict.selfDeps).toEqual([]);
    expect(verdict.dupes).toEqual([]);
  });

  /**
   * CR-GC-403 — die vier Lagen, an echten Verzeichnissen und echten Symlinks.
   *
   * Ohne diesen Fall waere das Ueberspringen ein Versprechen ohne Beleg. Hier laeuft
   * dieselbe Urteilsfunktion, die der Guard oben benutzt, gegen einen gebauten Baum:
   * sauber, selbst-abhaengig, ganz verlinkt, teilweise verlinkt, leer, fehlend.
   */
  describe('CR-GC-403: der Guard unterscheidet Installation, Workspace und kaputten Baum', () => {
    let dir: string;
    const pkg = (rel: string, body: Record<string, unknown>): string => {
      mkdirSync(join(dir, rel), { recursive: true });
      writeFileSync(join(dir, rel, 'package.json'), JSON.stringify(body));
      return join(dir, rel);
    };

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'gc-403-'));
    });
    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('installierter Baum, sauber: geprueft, keine Befunde', () => {
      mkdirSync(join(dir, 'root'));
      pkg('root/contracts', { name: '@sigloch/contracts', version: '6.3.0' });
      pkg('root/se-engine', { name: '@sigloch/se-engine', version: '1.1.0' });
      const v = auditSiglochTree(join(dir, 'root'), dir);
      expect(v.kind).toBe('installed');
      if (v.kind !== 'installed') return;
      expect(v.dirs.sort()).toEqual(['contracts', 'se-engine']);
      expect(v.manifests).toBe(2);
      expect(v.selfDeps).toEqual([]);
      expect(v.dupes).toEqual([]);
    });

    it('GANZ verlinkt: uebersprungen, mit den Namen der Links im Urteil', () => {
      mkdirSync(join(dir, 'root'));
      const real = pkg('workspace/contracts', { name: '@sigloch/contracts', version: '6.3.0' });
      const real2 = pkg('workspace/se-engine', { name: '@sigloch/se-engine', version: '1.1.0' });
      symlinkSync(real, join(dir, 'root', 'contracts'));
      symlinkSync(real2, join(dir, 'root', 'se-engine'));
      const v = auditSiglochTree(join(dir, 'root'), dir);
      expect(v.kind).toBe('linked');
      if (v.kind !== 'linked') return;
      expect(v.links.sort()).toEqual(['contracts', 'se-engine']);
    });

    it('TEILWEISE verlinkt: nicht uebersprungen — der Self-Dep im echten Verzeichnis wird gefunden', () => {
      mkdirSync(join(dir, 'root'));
      const real = pkg('workspace/contracts', { name: '@sigloch/contracts', version: '6.3.0' });
      symlinkSync(real, join(dir, 'root', 'contracts'));
      // Der reale Defekt aus CR-SM-248, kuenstlich eingesetzt: ein Paket fuehrt sich selbst
      // als dependency, npm nistet daraufhin eine zweite Kopie IN das Paket hinein.
      pkg('root/graphify', {
        name: '@sigloch/graphify',
        version: '0.2.0',
        dependencies: { '@sigloch/graphify': 'file:' },
      });
      pkg('root/graphify/node_modules/@sigloch/graphify', { name: '@sigloch/graphify', version: '0.1.0' });
      const v = auditSiglochTree(join(dir, 'root'), dir);
      expect(v.kind).toBe('installed');
      if (v.kind !== 'installed') return;
      expect(v.links).toEqual(['contracts']);
      expect(v.dirs).toEqual(['graphify']);
      expect(v.selfDeps).toEqual(['@sigloch/graphify -> itself']);
      expect(v.dupes).toEqual([
        '@sigloch/graphify: 0.2.0 @ root/graphify | 0.1.0 @ root/graphify/node_modules/@sigloch/graphify',
      ]);
    });

    it('LEER ist nicht verlinkt: eigenes Urteil, nie uebersprungen', () => {
      mkdirSync(join(dir, 'root'));
      expect(auditSiglochTree(join(dir, 'root'), dir).kind).toBe('empty');
    });

    it('FEHLEND ist ein Urteil, kein ENOENT-Absturz', () => {
      expect(auditSiglochTree(join(dir, 'gibt-es-nicht'), dir).kind).toBe('missing');
    });
  });

  /**
   * CR-GC-404 — die Logik des Guards, an einem gebauten Baum.
   *
   * Der Guard darueber ist in der verlinkten Arbeitskopie stumm. Ohne diesen Fall waere er
   * dort ein Test, der nichts tut und niemandem auffaellt — genau die Lage, die eine
   * Ueberspringung so gefaehrlich macht. Hier laeuft dieselbe Funktion gegen echte
   * Verzeichnisse und MUSS beide Defektarten finden.
   */
  it('faengt Duplikat und Selbst-Abhaengigkeit an einem echten Baum (der uebersprungene Guard tut noch etwas)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gc-dist-'));
    try {
      const pkg = (rel: string, body: Record<string, unknown>): void => {
        mkdirSync(join(dir, rel), { recursive: true });
        writeFileSync(join(dir, rel, 'package.json'), JSON.stringify(body));
      };
      // Ein sauberer Baum: zwei Pakete, je einmal, keins haengt an sich selbst.
      pkg('contracts', { name: '@sigloch/contracts', version: '6.3.0' });
      pkg('se-engine', { name: '@sigloch/se-engine', version: '1.1.0' });
      const clean = collectManifests(dir, dir);
      expect(clean.map((m) => m.name).sort()).toEqual(['@sigloch/contracts', '@sigloch/se-engine']);
      expect(duplicates(clean)).toEqual([]);
      expect(selfDependents(clean)).toEqual([]);

      // Der reale Defekt aus CR-SM-248: ein Paket fuehrt sich selbst als dependency, npm
      // nistet daraufhin eine zweite Kopie IN das Paket hinein.
      pkg('graphify', { name: '@sigloch/graphify', version: '0.2.0', dependencies: { '@sigloch/graphify': 'file:' } });
      pkg('graphify/node_modules/@sigloch/graphify', { name: '@sigloch/graphify', version: '0.1.0' });
      const broken = collectManifests(dir, dir);
      expect(selfDependents(broken)).toEqual(['@sigloch/graphify -> itself']);
      expect(duplicates(broken)).toEqual(['@sigloch/graphify: 0.2.0 @ graphify | 0.1.0 @ graphify/node_modules/@sigloch/graphify']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
