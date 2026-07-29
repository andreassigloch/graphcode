/**
 * scaffold-templates.ts — the CATALOG of what `graphcode init` installs (split out of
 * scaffold.ts by CR-GC-260).
 *
 * Two things, both pure data:
 *   1. WHERE each artifact goes in the target repo (`.mcp.json`, `opencode.json`, `GRAPHCODE.md`,
 *      `.claude/{skills,hooks,settings.json}`, `.graphcode/`) and where its packaged
 *      copy ships from inside this npm tarball (REQ-self-contained-dist).
 *   2. WHAT each generated file contains — byte-for-byte, so a re-run is idempotent.
 *
 * The idempotent install/update/remove MECHANICS stay in scaffold.ts. Keeping the two
 * apart means a wording change in GRAPHCODE.md never touches lifecycle code, and the
 * lifecycle can be read without scrolling past 100 lines of embedded Markdown.
 *
 * @author andreas@siglochconsulting
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

/** The distribution package a member repo depends on. */
export const PACKAGE_NAME = '@sigloch/graphcode';

/**
 * This package's own `version`, read from the package.json next to the shipped code
 * (same resolution as `packagedSkillsDir()`: works from `src/` in dev and from the
 * bundled `dist/` in a consumer's node_modules). Falls back to `0` when the manifest
 * is unreadable — a wide range beats an invented version number.
 */
function packageVersion(): string {
  const manifest = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  try {
    const version = (JSON.parse(readFileSync(manifest, 'utf8')) as { version?: unknown }).version;
    return typeof version === 'string' && version.length > 0 ? version : '0';
  } catch {
    return '0';
  }
}

/**
 * Dependency range written into the target's package.json (CR-121 distribution),
 * DERIVED from this package's own version (CR-GC-265) — a literal froze at `^0.1.0`
 * while the published package moved to 0.4.x, so `init` registered a range that
 * resolves to an old line. A version bump now changes the scaffolded range with no
 * code edit.
 */
export const PACKAGE_RANGE = `^${packageVersion()}`;

/** Per-repo workspace dir (`.graphcode/`); the Kuzu store lives at `.graphcode/kuzu`. */
export const GRAPHCODE_DIR = '.graphcode';
export const MCP_CONFIG = '.mcp.json';
/** OpenCode's host config in the target repo — same server, OpenCode's schema (CR-GC-263). */
export const OPENCODE_CONFIG = 'opencode.json';
export const GUARDRAILS_FILE = 'GRAPHCODE.md';
/** Where the SE skills land in the target repo (and ship from in this package). */
export const SKILLS_DIR = join('.claude', 'skills');
/** Where the PreToolUse deny-hooks land (and ship from in this package) — CR-GC-214. */
export const HOOKS_DIR = join('.claude', 'hooks');
/** The settings file that registers the shipped hooks in the target repo. */
export const SETTINGS_FILE = join('.claude', 'settings.json');

/**
 * The `.claude/skills/` directory shipped INSIDE this package, resolved relative to
 * this module so it works both in dev (`src/scaffold.ts` → repo root) and bundled
 * (`dist/cli.js` / `dist/index.js` → package root). The skills are listed in
 * package.json `files`, so the npm tarball carries them (REQ-self-contained-dist).
 */
export function packagedSkillsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', SKILLS_DIR);
}

/** The `se-*.md` skill files this package ships (empty if the dir is absent). */
export function shippedSkillFiles(): string[] {
  const dir = packagedSkillsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith('se-') && f.endsWith('.md'))
    .sort();
}

/** The frontmatter fields a skill carries (CR-GC-208): identity, purpose, sync-version. */
export type SkillMeta = { name: string; description: string; version: number };

/**
 * Parse the `---`-fenced YAML-ish frontmatter of a skill file for `name`, `description`,
 * and `version`. Only the flat `key: value` pairs in the first fence are read (the skills'
 * frontmatter is intentionally trivial — no nested YAML). A missing `version:` reads as 0,
 * so an un-stamped target copy always loses to a shipped `version: 1` and gets refreshed.
 */
export function parseSkillFrontmatter(content: string): SkillMeta {
  const meta: SkillMeta = { name: '', description: '', version: 0 };
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') return meta;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') break;
    const m = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const [, key, raw] = m;
    const value = raw.trim();
    if (key === 'name') meta.name = value;
    else if (key === 'description') meta.description = value;
    else if (key === 'version') {
      const n = Number.parseInt(value, 10);
      if (Number.isFinite(n)) meta.version = n;
    }
  }
  return meta;
}

/** Minimal shape of Claude Code's `settings.json` PreToolUse hook config (CR-GC-214). */
export type HookCommand = { type: string; command: string };
export type HookEntry = { matcher?: string; hooks?: HookCommand[] };
export type SettingsShape = {
  hooks?: { PreToolUse?: HookEntry[]; [k: string]: unknown };
  [k: string]: unknown;
};

/** The `.claude/hooks/` dir shipped INSIDE this package (dev: repo root; bundled: package root). */
export function packagedHooksDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', HOOKS_DIR);
}

/** This package's own `settings.json` — the single source for WHICH hooks get registered. */
export function packagedSettingsPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', SETTINGS_FILE);
}

/** The `deny-*.sh` hook files this package ships (empty if the dir is absent). */
export function shippedHookFiles(): string[] {
  const dir = packagedHooksDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith('deny-') && f.endsWith('.sh'))
    .sort();
}

/** The PreToolUse entries to inject — read LIVE from this package's settings (no parallel list). */
export function shippedPreToolUseEntries(): HookEntry[] {
  const p = packagedSettingsPath();
  if (!existsSync(p)) return [];
  const s = JSON.parse(readFileSync(p, 'utf8')) as SettingsShape;
  const pre = s.hooks?.PreToolUse;
  return Array.isArray(pre) ? pre : [];
}

/** A PreToolUse entry is graphcode-owned iff any of its commands points into `.claude/hooks/`. */
export function isGraphcodeHookEntry(entry: HookEntry): boolean {
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
export function mergedSettingsContent(existingRaw: string | null): string {
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

/**
 * Deterministic live-viewer port for a repo (CR-GC-237): FNV-1a over the repo
 * path, folded into 4600–4899. Stable across init/update for the same path;
 * distinct worktrees (own stores) land on distinct ports with high probability.
 * A collision is harmless — the elected host warns and serves stdio only; the
 * port lives in `.mcp.json` and is user-editable.
 */
export function deriveHostPort(repoRoot: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < repoRoot.length; i++) {
    hash ^= repoRoot.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return 4600 + (hash % 300);
}

/** Parse a scaffolded host-config file; an unparseable/absent file reads as `{}`. */
function parseHostConfig(existingRaw: string | null): Record<string, unknown> {
  if (!existingRaw) return {};
  try {
    const parsed = JSON.parse(existingRaw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {}; // stale/unparseable — refresh to the canonical form.
  }
}

/** The nested object under `key`, or `{}` — never a non-object (arrays included). */
function objectAt(cfg: Record<string, unknown>, key: string): Record<string, unknown> {
  const v = cfg[key];
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * The `GRAPHCODE_HOST_PORT` a previous scaffold wrote into the host config, if it is a
 * valid port — so a port the user edited survives `update` (CR-GC-237). Reads both env
 * spellings: `env` (Claude `.mcp.json`) and `environment` (OpenCode `opencode.json`).
 */
function keptHostPort(servers: Record<string, unknown>): number | null {
  const entry = objectAt(servers, 'graphcode');
  for (const key of ['env', 'environment'] as const) {
    const kept = Number(objectAt(entry, key).GRAPHCODE_HOST_PORT);
    if (Number.isInteger(kept) && kept > 0 && kept <= 65535) return kept;
  }
  return null;
}

/**
 * The `.mcp.json` a foreign repo needs: launch the server via npx (CR-121).
 * `env.GRAPHCODE_HOST_PORT` opts the elected host into the read-only live-view
 * bridge (CR-GC-237). A port the user already set survives `update`.
 *
 * MERGES (CR-GC-263): only the `mcpServers.graphcode` entry is ours. Other servers
 * a repo already configures — and every other top-level key — are carried over
 * verbatim; `init` in a repo that already speaks MCP must not disown its servers.
 */
export function mcpConfigContent(repoRoot: string, existingRaw: string | null): string {
  const existing = parseHostConfig(existingRaw);
  const servers = objectAt(existing, 'mcpServers');
  const port = keptHostPort(servers) ?? deriveHostPort(repoRoot);
  const merged = {
    ...existing,
    mcpServers: {
      ...servers,
      graphcode: {
        command: 'npx',
        args: ['-y', PACKAGE_NAME, 'mcp'],
        env: { GRAPHCODE_HOST_PORT: String(port) },
      },
    },
  };
  return JSON.stringify(merged, null, 2) + '\n';
}

/**
 * The `opencode.json` an OpenCode host needs (CR-GC-263) — the SAME stdio server as
 * `.mcp.json`, in OpenCode's schema (`mcp.<name>.type = "local"`, `command` as one
 * argv array). Both files are always scaffolded: each is invisible to the other host,
 * and which host will open the repo is not knowable at `init` time.
 *
 * MERGES like `mcpConfigContent`: a user's `provider` / `model` / `permission` keys and
 * any other MCP server survive; only `mcp.graphcode` is ours.
 */
export function opencodeConfigContent(repoRoot: string, existingRaw: string | null): string {
  const existing = parseHostConfig(existingRaw);
  const mcp = objectAt(existing, 'mcp');
  const port = keptHostPort(mcp) ?? deriveHostPort(repoRoot);
  const merged = {
    $schema: 'https://opencode.ai/config.json',
    ...existing,
    mcp: {
      ...mcp,
      graphcode: {
        type: 'local',
        command: ['npx', '-y', PACKAGE_NAME, 'mcp'],
        enabled: true,
        environment: { GRAPHCODE_HOST_PORT: String(port) },
      },
    },
  };
  return JSON.stringify(merged, null, 2) + '\n';
}

/**
 * Strip graphcode's own entry from a host-config file (CR-GC-263) — the `remove`
 * counterpart to the two *ConfigContent writers. `serversKey` is `mcpServers`
 * (Claude) or `mcp` (OpenCode).
 *
 * Returns the file's new content, or `null` when nothing of the user's is left —
 * then the caller deletes the file. Restlos, but never more than ours: a repo that
 * configured other servers keeps them (`REQ-repo-uninstall`), exactly like the
 * `.claude/settings.json` de-registration.
 */
export function hostConfigWithoutGraphcode(
  existingRaw: string,
  serversKey: 'mcpServers' | 'mcp',
): string | null {
  const existing = parseHostConfig(existingRaw);
  const servers = { ...objectAt(existing, serversKey) };
  delete servers.graphcode;
  const next: Record<string, unknown> = { ...existing };
  if (Object.keys(servers).length > 0) next[serversKey] = servers;
  else delete next[serversKey];
  // `$schema` alone is not user content — it is what WE wrote into opencode.json.
  const meaningful = Object.keys(next).filter((k) => k !== '$schema');
  if (meaningful.length === 0) return null;
  return JSON.stringify(next, null, 2) + '\n';
}

/**
 * The "## Available se-* skills" rows — derived LIVE from the shipped skills' frontmatter
 * (CR-GC-208), so the table can never drift from what `init`/`sync` actually copy. Each row
 * maps a skill `name:` → its `description:`; pipes in a description are escaped so the
 * Markdown table stays well-formed.
 */
export function skillTableRows(): string[] {
  const srcDir = packagedSkillsDir();
  return shippedSkillFiles().map((f) => {
    const meta = parseSkillFrontmatter(readFileSync(join(srcDir, f), 'utf8'));
    const name = meta.name || f.replace(/\.md$/, '');
    const desc = (meta.description || '').replace(/\|/g, '\\|');
    return `| \`${name}\` | ${desc} |`;
  });
}

/** The guardrails doc scaffolded into the target repo. */
export function guardrailsContent(): string {
  return [
    '# graphcode — Harness Guardrails',
    '',
    'This repo is governed by the **graphcode** graph substrate (MCP-stdio).',
    'Installed via `npx @sigloch/graphcode init`. Lifecycle: `init | update | remove`.',
    '',
    '## Graph-first — start here (CR-GC-207)',
    '',
    '- **The graph is the SSOT, not the docs.** Do not ingest the doc tree to plan;',
    '  query the live graph through the MCP tools first.',
    '- **Entry = MCP query, never a full doc read:**',
    '  - `graph_readiness` → project status / what is gated.',
    '  - `graph_elements {type}` → a typed slice (REQ, FUNC, TEST, MOD, CR, …).',
    '  - `graph_impact` / `graph_expand` → the exact blast-radius on demand —',
    '    never dump the whole graph.',
    '- **Concurrent writes (OCC, CR-GC-233):** every read returns `graphVersion`; pass it',
    '  as `baseVersion` to `graph_mutate`/`graph_realize` — a stale write is rejected with',
    '  the delta of what changed: re-read, reconcile, retry.',
    '- **Format-E v2:** the type is a `### <TYPE>` section header, never part of the uid',
    '  (e.g. `## Nodes` / `### MOD` / `+ MOD-harness|Harness module`). The `uid.TYPE`',
    '  suffix and the `Name.SY.001` spelling are both **dead** — do not reproduce them.',
    '- **`docs/SPEC.md` is bootstrap input, not authoritative — do not read it** to plan.',
    '- **After seeding the graph, run `graph_export`** so `docs/graph/*.graph.json`',
    '  exists as a readable SSOT for the next session (a single-writer Kuzu store is not).',
    '- **Stuck on an on-screen token** (a rule like `R-04`, a gate like `CDR`, a panel,',
    '  an artifact)? `se:help <token>` explains it in plain + SE terms with the exact fix;',
    '  `se:help` (no arg) or the `graph_help` MCP tool gives ranked, explained next steps.',
    '  This static contract is the entry; `se:help` is its live counterpart (CR-GC-230).',
    '',
    '## Available se-* skills (CR-GC-208)',
    '',
    'These ship in `.claude/skills/`. Invoke them via the **Skill tool** instead of',
    'planning the same work ad-hoc — each is MCP-driven against the live graph. Run',
    '`npx @sigloch/graphcode skills sync` to refresh them when this package updates.',
    '',
    '| skill | purpose |',
    '| --- | --- |',
    ...skillTableRows(),
    '',
    '## What is here',
    '',
    '- `.graphcode/` — the per-repo Kuzu store (`.graphcode/kuzu`). On-disk, single-owner.',
    '  Never edited by hand; the store inits lazily on first `graphcode mcp`.',
    '- **Parallel sessions share ONE model (CR-GC-235):** the first `graphcode mcp` wins the',
    '  store election and becomes the host (`.graphcode/host.sock`); later sessions proxy to',
    '  it transparently — same tools, one gate, one write channel per store/worktree.',
    '- `.mcp.json` (Claude schema) + `opencode.json` (OpenCode schema) — both tell the',
    `  agent host to launch the server via \`npx -y ${PACKAGE_NAME} mcp\`. Merged, never`,
    '  overwritten: foreign MCP servers and your `provider`/`model` block survive.',
    '- `.claude/skills/se-*.md` — the SE skills (fmea/review/status + the views), MCP-driven.',
    '  Claude Code surface; on other hosts drive the MCP tools directly.',
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
    '- `npx @sigloch/graphcode update` — refresh both host configs + this file, preserve the store.',
    '- `npx @sigloch/graphcode remove`  — remove all scaffolded artifacts (incl. `.graphcode/`).',
    '',
  ].join('\n');
}
