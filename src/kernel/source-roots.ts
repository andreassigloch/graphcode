/**
 * Where the code of a repo lives, and how an import specifier lands on a source file
 * (CR-GC-683, ITEM-2026-598).
 *
 * The conformance extractor used to know exactly one root, `<repo>/src`, and exactly one
 * kind of import, the relative one. A monorepo (`packages/*` + `workspaces`) has neither:
 * its code sits under `packages/<x>/src`, and its packages reach each other through their
 * package NAME (`@sigloch/contracts/se`). Measured on sigloch-modules: 0 import endpoints,
 * RC-05 and RC-09 blind by construction, while `importCoverage` 0/0 read like "nothing to do".
 *
 * Two answers, one module:
 *   - `sourceLayout`  : the roots to scan — `<repo>/src` plus `<pkg>/src` of every workspace
 *     package — and the workspace packages by name.
 *   - `resolveImport` : a specifier → repo-relative source file. Relative as before; a bare
 *     specifier only if it names a WORKSPACE package, resolved through that package's
 *     `exports` (or `main`) and mapped from the build output back to its source
 *     (`./dist/se/index.js` → `src/se/index.ts`). Everything else is node_modules and stays
 *     out, as before.
 *
 * Deterministic, filesystem reads only.
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve as resolvePath } from 'node:path';

export const SRC_EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

interface PackageJson {
  name?: string;
  main?: string;
  exports?: unknown;
  workspaces?: string[] | { packages?: string[] };
}

export interface WorkspacePackage {
  /** absolute package directory */
  dir: string;
  main?: string;
  exports?: unknown;
}

export interface SourceLayout {
  /** absolute directories whose source files are scanned */
  roots: string[];
  /** workspace packages by package name */
  packages: Map<string, WorkspacePackage>;
}

function readPackageJson(dir: string): PackageJson | undefined {
  const p = join(dir, 'package.json');
  if (!existsSync(p)) return undefined;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as PackageJson;
  } catch {
    return undefined;
  }
}

/** `packages/*` → every direct subdirectory of `packages`; a literal entry → itself. */
function expandWorkspacePattern(repoRoot: string, pattern: string): string[] {
  const clean = pattern.replace(/\/+$/, '');
  if (!clean.endsWith('/*')) return [join(repoRoot, clean)];
  const parent = join(repoRoot, clean.slice(0, -2));
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(parent, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
    .map((e) => join(parent, e.name))
    .sort();
}

export function sourceLayout(repoRoot: string): SourceLayout {
  const roots: string[] = [];
  const packages = new Map<string, WorkspacePackage>();
  if (existsSync(join(repoRoot, 'src'))) roots.push(join(repoRoot, 'src'));
  const ws = readPackageJson(repoRoot)?.workspaces;
  const patterns = Array.isArray(ws) ? ws : (ws?.packages ?? []);
  for (const dir of patterns.flatMap((p) => expandWorkspacePattern(repoRoot, p))) {
    const pkg = readPackageJson(dir);
    if (!pkg) continue;
    if (pkg.name) packages.set(pkg.name, { dir, main: pkg.main, exports: pkg.exports });
    if (existsSync(join(dir, 'src'))) roots.push(join(dir, 'src'));
  }
  return { roots, packages };
}

/** An absolute module path (with or without extension) → existing repo-relative source file. */
export function resolveSourceFile(baseAbs: string, repoRoot: string): string | undefined {
  const candidates = [
    baseAbs,
    // A `.js`/`.mjs`/`.cjs` specifier maps to its TS source (NodeNext convention).
    baseAbs.replace(/\.(js|mjs|cjs)$/, '.ts'),
    baseAbs.replace(/\.(js|mjs|cjs)$/, '.tsx'),
    ...SRC_EXTS.map((x) => baseAbs + x),
    ...SRC_EXTS.map((x) => join(baseAbs, 'index' + x)),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return relative(repoRoot, c);
  }
  return undefined;
}

/** The target of one `exports` entry: a string, or the first of import/default/require. */
function exportTarget(entry: unknown): string | undefined {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') {
    const e = entry as Record<string, unknown>;
    for (const k of ['import', 'default', 'require', 'node']) {
      const t = exportTarget(e[k]);
      if (t) return t;
    }
  }
  return undefined;
}

function resolveWorkspaceImport(spec: string, layout: SourceLayout, repoRoot: string): string | undefined {
  for (const [name, pkg] of layout.packages) {
    if (spec !== name && !spec.startsWith(name + '/')) continue;
    const sub = spec === name ? '.' : './' + spec.slice(name.length + 1);
    const exp = pkg.exports;
    let target: string | undefined;
    if (exp && typeof exp === 'object' && !Array.isArray(exp) && Object.keys(exp).some((k) => k.startsWith('.'))) {
      target = exportTarget((exp as Record<string, unknown>)[sub]);
    } else if (sub === '.') {
      target = exportTarget(exp) ?? pkg.main ?? 'index.js';
    } else {
      target = sub; // no exports map: the subpath is a file path inside the package
    }
    if (!target) return undefined;
    // Build output → source: the first `dist/` segment becomes `src/`.
    const source = target.replace(/^\.?\/?dist\//, 'src/');
    return resolveSourceFile(resolvePath(pkg.dir, source), repoRoot);
  }
  return undefined;
}

/** Import specifier in `fromAbs` → repo-relative source file, or undefined (external / unresolvable). */
export function resolveImport(fromAbs: string, spec: string, layout: SourceLayout, repoRoot: string): string | undefined {
  if (spec.startsWith('.')) return resolveSourceFile(resolvePath(dirname(fromAbs), spec), repoRoot);
  return resolveWorkspaceImport(spec, layout, repoRoot);
}
