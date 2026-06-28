/**
 * scaffold.ts — `graphcode init | update | remove` lifecycle (MOD-cli, FUNC-harness-cli).
 *
 * Self-contained installer that scaffolds the governed graph harness into ANY
 * repo. A member repo consumes `@sigloch/graphcode` as a dependency (CR-121) and
 * launches the MCP-stdio server via the scaffolded `.mcp.json`. The CURRENT
 * architecture is MCP-stdio only (the retired localhost Controller is gone, CR-111).
 * The PreToolUse deny-hooks ARE scaffolded (CR-GC-214): read-side/write-side
 * enforcement must protect agents working in CONSUMER repos, not only this dev repo.
 *
 * Artifacts this CLI owns, per target repo:
 *   - `.graphcode/`            the per-repo Kuzu store dir (`.graphcode/kuzu`, KUZU_DIR).
 *                              `init` creates it; the store inits lazily on first
 *                              `graphcode mcp`. NEVER `:memory:` (REQ-disk-persistence).
 *   - `.mcp.json`             so an agent host launches the server via npx.
 *   - `GRAPHCODE.md`          the guardrails doc.
 *   - `.claude/skills/se-*.md` the MCP-driven SE skills (CR-GC-133).
 *   - `.claude/hooks/deny-*.sh` the PreToolUse enforcement hooks (gate-only writes,
 *                              no binary source, no stale-prose reads) — CR-GC-214.
 *   - `.claude/settings.json`  registers those hooks (merged: a member's own hooks +
 *                              other settings keys are preserved).
 *   - `package.json`          gains the `@sigloch/graphcode` dependency.
 *
 * Realizes: REQ-pre-harness-cli (repo + node/npx present), REQ-post-harness-cli
 * (artifacts installed/updated/restlos removed, idempotent, store preserved on
 * update), REQ-repo-install, REQ-repo-update, REQ-repo-uninstall,
 * REQ-install-idempotent.
 *
 * @author andreas@siglochconsulting
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { z } from 'zod/v4';
import { KUZU_DIR } from './index.js';

/** The distribution package a member repo depends on. */
const PACKAGE_NAME = '@sigloch/graphcode';
/** Dependency range written into the target's package.json (CR-121 distribution). */
const PACKAGE_RANGE = '^0.1.0';

/** Per-repo workspace dir (`.graphcode/`); the Kuzu store lives at `.graphcode/kuzu`. */
const GRAPHCODE_DIR = '.graphcode';
const MCP_CONFIG = '.mcp.json';
const GUARDRAILS_FILE = 'GRAPHCODE.md';
/** Where the SE skills land in the target repo (and ship from in this package). */
const SKILLS_DIR = join('.claude', 'skills');
/** Where the PreToolUse deny-hooks land (and ship from in this package) — CR-GC-214. */
const HOOKS_DIR = join('.claude', 'hooks');
/** The settings file that registers the shipped hooks in the target repo. */
const SETTINGS_FILE = join('.claude', 'settings.json');

/**
 * The `.claude/skills/` directory shipped INSIDE this package, resolved relative to
 * this module so it works both in dev (`src/scaffold.ts` → repo root) and bundled
 * (`dist/cli.js` / `dist/index.js` → package root). The skills are listed in
 * package.json `files`, so the npm tarball carries them (REQ-self-contained-dist).
 */
function packagedSkillsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', SKILLS_DIR);
}

/** The `se-*.md` skill files this package ships (empty if the dir is absent). */
function shippedSkillFiles(): string[] {
  const dir = packagedSkillsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith('se-') && f.endsWith('.md'))
    .sort();
}

/** Minimal shape of Claude Code's `settings.json` PreToolUse hook config (CR-GC-214). */
type HookCommand = { type: string; command: string };
type HookEntry = { matcher?: string; hooks?: HookCommand[] };
type SettingsShape = {
  hooks?: { PreToolUse?: HookEntry[]; [k: string]: unknown };
  [k: string]: unknown;
};

/** The `.claude/hooks/` dir shipped INSIDE this package (dev: repo root; bundled: package root). */
function packagedHooksDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', HOOKS_DIR);
}

/** This package's own `settings.json` — the single source for WHICH hooks get registered. */
function packagedSettingsPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', SETTINGS_FILE);
}

/** The `deny-*.sh` hook files this package ships (empty if the dir is absent). */
function shippedHookFiles(): string[] {
  const dir = packagedHooksDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith('deny-') && f.endsWith('.sh'))
    .sort();
}

/** The PreToolUse entries to inject — read LIVE from this package's settings (no parallel list). */
function shippedPreToolUseEntries(): HookEntry[] {
  const p = packagedSettingsPath();
  if (!existsSync(p)) return [];
  const s = JSON.parse(readFileSync(p, 'utf8')) as SettingsShape;
  const pre = s.hooks?.PreToolUse;
  return Array.isArray(pre) ? pre : [];
}

/** A PreToolUse entry is graphcode-owned iff any of its commands points into `.claude/hooks/`. */
function isGraphcodeHookEntry(entry: HookEntry): boolean {
  return (
    Array.isArray(entry.hooks) &&
    entry.hooks.some((h) => typeof h.command === 'string' && h.command.includes('.claude/hooks/'))
  );
}

/**
 * Merge the shipped PreToolUse hooks into `existingRaw` (or {} if absent). A member's own
 * hooks — and every other settings key — are preserved; graphcode's entries are stripped then
 * re-appended at the end, so the result is deterministic and a re-run is byte-identical (idempotent).
 */
function mergedSettingsContent(existingRaw: string | null): string {
  const existing: SettingsShape = existingRaw ? (JSON.parse(existingRaw) as SettingsShape) : {};
  const hooks = existing.hooks && typeof existing.hooks === 'object' ? existing.hooks : {};
  const pre = Array.isArray(hooks.PreToolUse) ? hooks.PreToolUse : [];
  const userPre = pre.filter((e) => !isGraphcodeHookEntry(e));
  const merged: SettingsShape = {
    ...existing,
    hooks: { ...hooks, PreToolUse: [...userPre, ...shippedPreToolUseEntries()] },
  };
  return JSON.stringify(merged, null, 2) + '\n';
}

/** `CliCommand` (SCHEMA-cli-command) — the npx-CLI verbs this installer dispatches. */
export const CliCommandSchema = z.enum(['init', 'update', 'remove']);
export type CliCommand = z.infer<typeof CliCommandSchema>;

/**
 * `InstallResult` (FLOW-install-result) — what the scaffold created / updated /
 * removed / preserved, plus the resolved repo root. Repo-relative paths so the
 * result is stable/loggable across machines.
 */
export const InstallResultSchema = z.object({
  action: CliCommandSchema,
  repoRoot: z.string(),
  created: z.array(z.string()),
  updated: z.array(z.string()),
  removed: z.array(z.string()),
  preserved: z.array(z.string()),
});
export type InstallResult = z.infer<typeof InstallResultSchema>;

/** The `.mcp.json` a foreign repo needs: launch the server via npx (CR-121). */
function mcpConfigContent(): string {
  const cfg = {
    mcpServers: {
      graphcode: { command: 'npx', args: ['-y', PACKAGE_NAME, 'mcp'] },
    },
  };
  return JSON.stringify(cfg, null, 2) + '\n';
}

/** The guardrails doc scaffolded into the target repo. */
function guardrailsContent(): string {
  return [
    '# graphcode — Harness Guardrails',
    '',
    'This repo is governed by the **graphcode** graph substrate (MCP-stdio).',
    'Installed via `npx @sigloch/graphcode init`. Lifecycle: `init | update | remove`.',
    '',
    '## What is here',
    '',
    '- `.graphcode/` — the per-repo Kuzu store (`.graphcode/kuzu`). On-disk, single-owner.',
    '  Never edited by hand; the store inits lazily on first `graphcode mcp`.',
    '- `.mcp.json` — tells the agent host (Claude Code, OpenCode, …) to launch the',
    `  server via \`npx -y ${PACKAGE_NAME} mcp\`.`,
    '- `.claude/skills/se-*.md` — the SE skills (fmea/review/status + the views), MCP-driven.',
    '- `.claude/hooks/deny-*.sh` + `.claude/settings.json` — PreToolUse enforcement:',
    '  gate-only writes, no binary source, no stale-prose reads (CR-GC-214). Your own',
    '  hooks/settings keys are preserved on `update` and restored on `remove`.',
    '',
    '## Rules',
    '',
    '- One store = Kuzu, single-writer, exactly one owner process per repo.',
    '- One transport = MCP-stdio. No Express/REST in the core.',
    '- One apply-gate = `mutate()` — every edit (human or AI) goes through it; the',
    '  `deny-graph-write` hook blocks hand-edits of the graph SSOT.',
    '- SE ontology + rules come from `@sigloch/contracts/se` — import, never fork.',
    '',
    '## Lifecycle',
    '',
    '- `npx @sigloch/graphcode update` — refresh `.mcp.json` + this file, preserve the store.',
    '- `npx @sigloch/graphcode remove`  — remove all scaffolded artifacts (incl. `.graphcode/`).',
    '',
  ].join('\n');
}

/** Idempotently write `content` to `abs`; push the repo-relative path to created/updated. */
function writeArtifact(
  abs: string,
  rel: string,
  content: string,
  res: InstallResult,
): void {
  const exists = existsSync(abs);
  // Idempotent: re-writing identical content still counts as the artifact being
  // present; we report created on first appearance, updated otherwise.
  const current = exists ? readFileSync(abs, 'utf8') : null;
  if (current === content) {
    // No change needed — but still owned. Report as preserved so re-running init
    // is observably stable (REQ-install-idempotent).
    res.preserved.push(rel);
    return;
  }
  writeFileSync(abs, content, 'utf8');
  (exists ? res.updated : res.created).push(rel);
}

/**
 * Register `@sigloch/graphcode` in the target package.json `dependencies`.
 * Idempotent: only writes when the range is missing/different; leaves all other
 * keys untouched and preserves the file's existing formatting style (2-space).
 */
function registerDependency(repoRoot: string, res: InstallResult): void {
  const abs = join(repoRoot, 'package.json');
  let pkg: Record<string, unknown> = {};
  const existed = existsSync(abs);
  if (existed) {
    pkg = JSON.parse(readFileSync(abs, 'utf8')) as Record<string, unknown>;
  }
  const deps = (pkg.dependencies as Record<string, string> | undefined) ?? {};
  if (deps[PACKAGE_NAME] === PACKAGE_RANGE) {
    res.preserved.push('package.json');
    return;
  }
  deps[PACKAGE_NAME] = PACKAGE_RANGE;
  pkg.dependencies = deps;
  writeFileSync(abs, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  (existed ? res.updated : res.created).push('package.json');
}

/** Remove `@sigloch/graphcode` from the target package.json dependencies (restlos). */
function unregisterDependency(repoRoot: string, res: InstallResult): void {
  const abs = join(repoRoot, 'package.json');
  if (!existsSync(abs)) return;
  const pkg = JSON.parse(readFileSync(abs, 'utf8')) as Record<string, unknown>;
  const deps = pkg.dependencies as Record<string, string> | undefined;
  if (!deps || !(PACKAGE_NAME in deps)) return;
  delete deps[PACKAGE_NAME];
  if (Object.keys(deps).length === 0) delete pkg.dependencies;
  writeFileSync(abs, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  res.updated.push('package.json');
}

/** Delete `abs` if present; record the repo-relative path as removed. */
function removeArtifact(abs: string, rel: string, res: InstallResult): void {
  if (!existsSync(abs)) return;
  rmSync(abs, { recursive: true, force: true });
  res.removed.push(rel);
}

/**
 * Copy the package's shipped `se-*.md` skills into the target repo's `.claude/skills/`.
 * Idempotent (byte-identical re-write = `preserved`). The se-* skills are now MCP-driven
 * (CR-GC-130/131/132); without this a freshly-init'd member repo has none of them.
 */
function installSkills(repoRoot: string, res: InstallResult): void {
  const srcDir = packagedSkillsDir();
  const files = shippedSkillFiles();
  if (files.length === 0) return; // skills not packaged — substrate still installs.
  const destDir = join(repoRoot, SKILLS_DIR);
  mkdirSync(destDir, { recursive: true });
  for (const f of files) {
    const content = readFileSync(join(srcDir, f), 'utf8');
    writeArtifact(join(destDir, f), join(SKILLS_DIR, f), content, res);
  }
}

/**
 * Remove the graphcode-shipped skills restlos — only the `se-*.md` files this package
 * owns (never a member's own skills). Prune `.claude/skills` / `.claude` only when WE
 * emptied them.
 */
function removeSkills(repoRoot: string, res: InstallResult): void {
  const destDir = join(repoRoot, SKILLS_DIR);
  if (!existsSync(destDir)) return;
  for (const f of shippedSkillFiles()) {
    removeArtifact(join(destDir, f), join(SKILLS_DIR, f), res);
  }
  // Prune `.claude/skills` if WE emptied it; the shared `.claude/` prune runs once after
  // both skills + hooks are removed (pruneClaudeIfEmpty).
  if (readdirSync(destDir).length === 0) {
    rmSync(destDir, { recursive: true, force: true });
  }
}

/**
 * Copy the package's `deny-*.sh` PreToolUse hooks into the target repo's `.claude/hooks/`
 * and register them in `.claude/settings.json` (CR-GC-214). Idempotent (byte-identical
 * re-write = `preserved`). Without this, consumer-repo agents have no read/write enforcement.
 */
function installHooks(repoRoot: string, res: InstallResult): void {
  const srcDir = packagedHooksDir();
  const files = shippedHookFiles();
  if (files.length === 0) return; // hooks not packaged — substrate still installs.
  const destDir = join(repoRoot, HOOKS_DIR);
  mkdirSync(destDir, { recursive: true });
  for (const f of files) {
    const content = readFileSync(join(srcDir, f), 'utf8');
    writeArtifact(join(destDir, f), join(HOOKS_DIR, f), content, res);
  }
  // Register, merging so a member's own hooks + other settings keys survive.
  const abs = join(repoRoot, SETTINGS_FILE);
  const existingRaw = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
  writeArtifact(abs, SETTINGS_FILE, mergedSettingsContent(existingRaw), res);
}

/**
 * Remove the graphcode-shipped hooks restlos — the `deny-*.sh` files this package owns and
 * its PreToolUse registrations in `.claude/settings.json`. A member's own hooks / other
 * settings keys survive; an emptied settings file or `.claude/hooks` dir is pruned.
 */
function removeHooks(repoRoot: string, res: InstallResult): void {
  // Strip our registrations from settings.json first.
  const abs = join(repoRoot, SETTINGS_FILE);
  if (existsSync(abs)) {
    const existingRaw = readFileSync(abs, 'utf8');
    const existing = JSON.parse(existingRaw) as SettingsShape;
    const hooks = existing.hooks && typeof existing.hooks === 'object' ? existing.hooks : {};
    const pre = Array.isArray(hooks.PreToolUse) ? hooks.PreToolUse : [];
    const userPre = pre.filter((e) => !isGraphcodeHookEntry(e));
    const nextHooks: Record<string, unknown> = { ...hooks };
    if (userPre.length > 0) nextHooks.PreToolUse = userPre;
    else delete nextHooks.PreToolUse;
    const next: SettingsShape = { ...existing };
    if (Object.keys(nextHooks).length === 0) delete next.hooks;
    else next.hooks = nextHooks as SettingsShape['hooks'];
    if (Object.keys(next).length === 0) {
      removeArtifact(abs, SETTINGS_FILE, res); // settings was graphcode-only.
    } else {
      const nextRaw = JSON.stringify(next, null, 2) + '\n';
      if (nextRaw !== existingRaw) {
        writeFileSync(abs, nextRaw, 'utf8');
        res.updated.push(SETTINGS_FILE);
      }
    }
  }
  // Then the hook files.
  const destDir = join(repoRoot, HOOKS_DIR);
  if (existsSync(destDir)) {
    for (const f of shippedHookFiles()) {
      removeArtifact(join(destDir, f), join(HOOKS_DIR, f), res);
    }
    if (readdirSync(destDir).length === 0) {
      rmSync(destDir, { recursive: true, force: true });
    }
  }
}

/** Prune the target's `.claude/` dir iff WE emptied it (skills + hooks both removed). */
function pruneClaudeIfEmpty(repoRoot: string): void {
  const claudeDir = join(repoRoot, '.claude');
  if (existsSync(claudeDir) && readdirSync(claudeDir).length === 0) {
    rmSync(claudeDir, { recursive: true, force: true });
  }
}

/**
 * Scaffold the harness into `opts.repoRoot`.
 *
 * - `init`   : create `.graphcode/`, write `.mcp.json` + guardrails, register the
 *              dependency. Idempotent — re-running never duplicates or corrupts.
 * - `update` : refresh `.mcp.json` + guardrails (+ dep), but PRESERVE the store
 *              (`.graphcode/kuzu` is never touched).
 * - `remove` : remove every artifact this CLI installed, restlos (incl. `.graphcode/`).
 */
export async function scaffold(
  action: CliCommand,
  opts: { repoRoot: string },
): Promise<InstallResult> {
  const repoRoot = opts.repoRoot;
  const res: InstallResult = {
    action,
    repoRoot,
    created: [],
    updated: [],
    removed: [],
    preserved: [],
  };

  const graphcodeAbs = join(repoRoot, GRAPHCODE_DIR);
  const mcpAbs = join(repoRoot, MCP_CONFIG);
  const guardrailsAbs = join(repoRoot, GUARDRAILS_FILE);

  switch (action) {
    case 'init': {
      // The per-repo workspace dir. The Kuzu store opens lazily under it on first
      // `graphcode mcp`; init only ensures the parent exists (no fake store).
      if (existsSync(graphcodeAbs)) {
        res.preserved.push(GRAPHCODE_DIR + '/');
      } else {
        mkdirSync(graphcodeAbs, { recursive: true });
        res.created.push(GRAPHCODE_DIR + '/');
      }
      writeArtifact(mcpAbs, MCP_CONFIG, mcpConfigContent(), res);
      writeArtifact(guardrailsAbs, GUARDRAILS_FILE, guardrailsContent(), res);
      installSkills(repoRoot, res);
      installHooks(repoRoot, res);
      registerDependency(repoRoot, res);
      return res;
    }

    case 'update': {
      // Refresh installed artifacts; NEVER wipe the store (REQ-repo-update). The
      // `.graphcode/` dir + its `kuzu` store are explicitly preserved.
      const kuzuAbs = join(repoRoot, KUZU_DIR);
      if (existsSync(kuzuAbs)) res.preserved.push(KUZU_DIR + '/');
      else if (existsSync(graphcodeAbs)) res.preserved.push(GRAPHCODE_DIR + '/');
      else {
        mkdirSync(graphcodeAbs, { recursive: true });
        res.created.push(GRAPHCODE_DIR + '/');
      }
      writeArtifact(mcpAbs, MCP_CONFIG, mcpConfigContent(), res);
      writeArtifact(guardrailsAbs, GUARDRAILS_FILE, guardrailsContent(), res);
      installSkills(repoRoot, res);
      installHooks(repoRoot, res);
      registerDependency(repoRoot, res);
      return res;
    }

    case 'remove': {
      // Restlose Deinstallation — remove everything init/update installed.
      removeArtifact(graphcodeAbs, GRAPHCODE_DIR + '/', res);
      removeArtifact(mcpAbs, MCP_CONFIG, res);
      removeArtifact(guardrailsAbs, GUARDRAILS_FILE, res);
      removeSkills(repoRoot, res);
      removeHooks(repoRoot, res);
      pruneClaudeIfEmpty(repoRoot);
      unregisterDependency(repoRoot, res);
      return res;
    }
  }
}
