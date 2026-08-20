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
import { readPackageVersion } from './package-version.js';
import { MARKDOWN_VIEWS, VIEW_FILENAMES, type MarkdownView } from '@sigloch/graphcode-client';

/** The distribution package a member repo depends on. */
export const PACKAGE_NAME = '@sigloch/graphcode';

/**
 * Die Startzeile der Host-Configs — mit **fester Version** (CR-GC-378).
 *
 * Ohne Pin stand in `.mcp.json` nur `npx -y @sigloch/graphcode mcp`, und was daraus
 * wirklich startete, war ein Auflösungsergebnis: npx nimmt den lokalen Bin zuerst, ein
 * Repo mit altem `node_modules` bootete also den alten Build — während dasselbe Verb im
 * Terminal den neuen fuhr. Zwei Wahrheiten pro Repo, keine davon lesbar. Mit dem Pin
 * steht die laufende Version als Zahl in einer eingecheckten Datei; geschrieben wird sie
 * vom Build, der das Upgrade ausführt (CR-GC-377 lässt genau diesen die Artefakte
 * schreiben), und `graphcode status` vergleicht sie gegen den Install.
 */
export const PACKAGE_SPEC = `${PACKAGE_NAME}@${readPackageVersion()}`;

/**
 * Die eigene Version — EIN Leser für das ganze Paket (CR-GC-376/378).
 *
 * Früher las diese Datei die package.json selbst, mit Fallback `'0'`. Für einen
 * Dep-Range war das tolerierbar; für den **Pin** in `.mcp.json` (CR-GC-378) ist es
 * fatal — `@sigloch/graphcode@0` existiert nicht, der Agent-Host startet dann gar
 * nichts. Der gemeinsame Leser scheitert stattdessen laut.
 */

/**
 * Dependency range written into the target's package.json (CR-121 distribution),
 * DERIVED from this package's own version (CR-GC-265) — a literal froze at `^0.1.0`
 * while the published package moved to 0.4.x, so `init` registered a range that
 * resolves to an old line. A version bump now changes the scaffolded range with no
 * code edit.
 */
export const PACKAGE_RANGE = `^${readPackageVersion()}`;

/** Per-repo workspace dir (`.graphcode/`); the Kuzu store lives at `.graphcode/kuzu`. */
export const GRAPHCODE_DIR = '.graphcode';
export const MCP_CONFIG = '.mcp.json';
/** OpenCode's host config in the target repo — same server, OpenCode's schema (CR-GC-263). */
export const OPENCODE_CONFIG = 'opencode.json';
export const GUARDRAILS_FILE = 'GRAPHCODE.md';
/**
 * The human-facing companion to GUARDRAILS_FILE (CR-GC-322). `GRAPHCODE.md` is the
 * AGENT contract — query paths, Format-E, prohibitions, read graph-first. This one is
 * for the PERSON: what runs without them, the four decisions only they can make, and
 * what the generated `docs/views/` documents are. Two audiences, two files: merged,
 * the agent reads onboarding prose it does not need and the human hunts for their four
 * levers between Format-E rules.
 */
export const STEERING_FILE = 'GRAPHCODE-STEERING.md';
/** Where the SE skills land in the target repo (and ship from in this package). */
/**
 * Where the shipped SE skills land in a member repo — als Claude-Code-COMMANDS
 * (CR-GC-277): `.claude/commands/<ns>/<rest>.md` ⇒ invocable als `/se:generate`,
 * `/se-view:arch` etc. Das flache `.claude/skills/se-*.md`-Layout registrierte
 * NICHTS (Skills brauchen `<name>/SKILL.md`-Verzeichnisse, Commands den Pfad
 * als Namen) — die Doppelpunkt-Namen der Frontmatter waren immer schon das
 * Commands-Schema. Pfad im Paket = Pfad im Ziel, kein Mapping zur Laufzeit.
 */
export const COMMANDS_DIR = join('.claude', 'commands');
/** Das Alt-Ziel bis 0.9.0 — install/sync/remove räumen dort verwaiste se-*.md ab. */
export const LEGACY_SKILLS_DIR = join('.claude', 'skills');
/**
 * Der Workspace des Vorgängerprodukts. Bis CR-GC-330 schrieb graphcode seinen
 * Learning-Feed dorthin statt in den eigenen Ordner; `remove` räumt genau diese eine
 * Datei ab (CR-GC-331) — der Rest eines `.aimprove/` kann aimprove selbst gehören.
 */
export const LEGACY_WORKSPACE_DIR = '.aimprove';
/** Der Learning-Feed, heute unter GRAPHCODE_DIR (CR-GC-330). */
export const TRAJECTORY_FILE = 'trajectory.jsonl';
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
  return join(dirname(fileURLToPath(import.meta.url)), '..', COMMANDS_DIR);
}

/**
 * The skill files this package ships, as paths RELATIVE to the commands dir
 * (`se/generate.md`, `se-view/arch.md`, `se-conops.md`). Only `se*`-owned
 * entries — a member's own commands are never ours to touch.
 */
export function shippedSkillFiles(): string[] {
  const dir = packagedSkillsDir();
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.name.startsWith('se')) continue;
    if (entry.isFile() && entry.name.endsWith('.md')) out.push(entry.name);
    if (entry.isDirectory()) {
      for (const f of readdirSync(join(dir, entry.name))) {
        if (f.endsWith('.md')) out.push(join(entry.name, f));
      }
    }
  }
  return out.sort();
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

/**
 * The hook scripts this package ships (empty if the dir is absent).
 *
 * Every `.sh` in the packaged hooks dir, not just `deny-*` (CR-GC-356): the dir holds
 * graphcode's hooks and nothing else, and a name-prefix filter would have silently dropped
 * `record-prompt.sh` from every scaffolded repo — installed here, absent for consumers.
 */
export function shippedHookFiles(): string[] {
  const dir = packagedHooksDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sh'))
    .sort();
}

/**
 * The hook entries to inject, PER EVENT — read LIVE from this package's settings, which stays
 * the single source for WHICH hooks get registered (no parallel list). Generalized from
 * PreToolUse-only in CR-GC-356: the prompt relay is a `UserPromptSubmit` hook, and hard-coding
 * event names here is the same drift source as hard-coding the file list.
 */
export function shippedHookEvents(): Record<string, HookEntry[]> {
  const p = packagedSettingsPath();
  if (!existsSync(p)) return {};
  const s = JSON.parse(readFileSync(p, 'utf8')) as SettingsShape;
  const hooks = s.hooks && typeof s.hooks === 'object' ? s.hooks : {};
  const out: Record<string, HookEntry[]> = {};
  for (const [event, entries] of Object.entries(hooks)) {
    if (Array.isArray(entries)) out[event] = entries as HookEntry[];
  }
  return out;
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
  const nextHooks: Record<string, unknown> = { ...hooks };
  for (const [event, shipped] of Object.entries(shippedHookEvents())) {
    const current = Array.isArray(nextHooks[event]) ? (nextHooks[event] as HookEntry[]) : [];
    const userOwned = current.filter((e) => !isGraphcodeHookEntry(e));
    nextHooks[event] = [...userOwned, ...shipped];
  }
  const merged: SettingsShape = { ...existing, hooks: nextHooks as SettingsShape['hooks'] };
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
 * The env block a previous scaffold left on the graphcode entry, minus the port
 * (that one is recomputed) — so `update` PRESERVES the operator's own switches:
 * `GRAPHCODE_NO_GVE`, `GRAPHCODE_GVE_BIN`, the `GRAPHCODE_LLM_*`
 * set for `graphcode run`. Before this, update rewrote `env` to the single port
 * key, so an opt-out silently came back on at the next update — the same class
 * of surprise the kept port was introduced to avoid. `command`/`args` stay
 * canonical (npx + PACKAGE_NAME): the launch line is ours, the environment is
 * the repo's.
 */
function keptEnv(servers: Record<string, unknown>, key: 'env' | 'environment'): Record<string, unknown> {
  const { GRAPHCODE_HOST_PORT: _port, ...rest } = objectAt(objectAt(servers, 'graphcode'), key);
  return rest;
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
        args: ['-y', PACKAGE_SPEC, 'mcp'],
        env: { ...keptEnv(servers, 'env'), GRAPHCODE_HOST_PORT: String(port) },
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
        command: ['npx', '-y', PACKAGE_SPEC, 'mcp'],
        enabled: true,
        environment: { ...keptEnv(mcp, 'environment'), GRAPHCODE_HOST_PORT: String(port) },
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
    'These ship in `.claude/commands/`. Invoke them via the **Skill tool** instead of',
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
    `  agent host to launch the server via \`npx -y ${PACKAGE_SPEC} mcp\`. Merged, never`,
    '  overwritten: foreign MCP servers and your `provider`/`model` block survive.',
    '- `.claude/commands/se*.md` — the SE skills (fmea/review/status + the views), MCP-driven.',
    '  Claude Code surface; on other hosts drive the MCP tools directly.',
    `- \`${STEERING_FILE}\` — the HUMAN's companion to this file: the four decisions only`,
    '  the person can make, and what the generated `docs/views/` documents are. Point',
    '  the user there when they ask how to steer the model — do not paraphrase it.',
    '- `.claude/hooks/deny-*.sh` + `.claude/settings.json` — PreToolUse enforcement:',
    '  gate-only writes, no binary source, no stale-prose reads (CR-GC-214). Your own',
    '  hooks/settings keys are preserved on `update` and restored on `remove`.',
    '',
    '## Live view (dashboard)',
    '',
    '- **One command starts everything.** `graphcode mcp` (the agent host launches it',
    '  from `.mcp.json`) brings up three things: the MCP-stdio surface, the read-only',
    '  HTTP/SSE bridge, and the **GVE dashboard** itself. There is no second server to',
    '  start. `graphcode host` exists only as a fallback for a repo with no agent',
    '  session running — starting it alongside a live host hits the store lock.',
    '- **Ask where your dashboard is: `npx @sigloch/graphcode status`.** It reports the',
    '  host PID and the URL of the viewer that serves THIS repo — read-only, starts and',
    '  stops nothing. A viewer that answers but serves another repo is reported as such,',
    '  never as yours.',
    '- **The machine-readable source is `docs/views/dashboard.url`.** GVE writes its ACTUAL',
    '  bound address there on startup and removes it on shutdown. The address is STABLE per',
    '  repo (derived from the repo path, 43000-43999), so it survives restarts — but read the',
    '  file rather than assuming: on a rare collision Vite bumps, and then a stale file can',
    '  point at a NEIGHBOUR repo\'s viewer. `status` settles that by asking `api/dashboard`',
    '  which repo is served.',
    '- **The dashboard lives as long as the session.** It goes down with the host and comes',
    '  back with the next one; a viewer that dies in between is restarted automatically. There',
    '  is nothing to stop by hand, and no leftover process to hunt.',
    '- Silence it with `GRAPHCODE_NO_GVE=1`; point it elsewhere with `GRAPHCODE_GVE_BIN`.',
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
    '- `graphcode upgrade` — neueste Version installieren, Artefakte + Host-Configs erneuern, alten Host beenden. Der Store bleibt.',
    '- `npx @sigloch/graphcode remove`  — remove all scaffolded artifacts (incl. `.graphcode/`).',
    '',
  ].join('\n');
}

/**
 * One sentence per generated view — what QUESTION the document answers, in the
 * language of someone who has never met this ontology (CR-GC-322).
 *
 * Typed as a total `Record<MarkdownView, …>` on purpose: a view added to
 * `MARKDOWN_VIEWS` (@sigloch/graphcode-client) fails the build here until it has a
 * sentence, so `docs/views/` can never grow an undocumented file. The catalog itself
 * stays description-free — it is deliberately zero-dependency, plain data (CR-GC-264);
 * the wording is authored, so it lives with the other authored copy.
 */
export const VIEW_BLURBS: Record<MarkdownView, string> = {
  architecture: 'Which module realizes which function — the allocation, i.e. the design description.',
  'cr-list': 'Every change request with its status and description.',
  references: 'Every trace in the model as `source -type-> target` — the raw link inventory.',
  srs: 'The requirements narrative (ISO 29148): what the system must do, and why.',
  nfr: 'The non-functional register — the quality requirements and how each is measured.',
  rtm: 'Traceability: requirement → realizing element → verifying test. The audit view.',
  icd: 'The interfaces between the modules (Interface Control Document).',
  testconcept: 'The test pyramid over the model, with the end-to-end gap computed, not claimed.',
  testmatrix: 'Which test verifies which requirement (VCRM) — and which requirement has none.',
  intplan: 'Integration and test plan: in which order the parts come together, verified how.',
  changelog: 'The change history, derived from the CR nodes.',
  fmea: 'Failure modes with severity/occurrence/detection, action priority, and mitigation coverage.',
  conops: 'Concept of operations: user classes, scenarios, constraints — the operational picture.',
  trade: 'The decisions: which options were evaluated, which won, what superseded what.',
  implplan: 'Milestones and the change requests assigned to them — the build order.',
};

/**
 * The `docs/views/` table rows for the steering doc — derived from the shared catalog
 * (CR-GC-264) so filename and coverage cannot drift from what `graph_export` writes.
 */
export function viewTableRows(): string[] {
  return MARKDOWN_VIEWS.map((v) => `| \`${VIEW_FILENAMES[v]}\` | ${VIEW_BLURBS[v]} |`);
}

/**
 * `GRAPHCODE-STEERING.md` — the doc scaffolded FOR THE HUMAN (CR-GC-322).
 *
 * The other 17 scaffolded documents are instructions to the agent, written in this
 * ontology's vocabulary; `se/target-profile.md` even says so out loud (CR-GC-307: the
 * steering vocabulary is our device, not a customer concept). That left the person who
 * OWNS the intent with nothing addressed to them. This file is that, and only that:
 * the four levers they actually hold, plus the generated documents they are expected
 * to read. No element types, no Format-E, no rule IDs beyond one worked example.
 */
export function steeringContent(): string {
  return [
    '# graphcode — steering the model (written for you, not for your agent)',
    '',
    `\`${GUARDRAILS_FILE}\` is the contract for your **agent**. This file is for **you**: what`,
    'graphcode decides on its own, the four decisions only you can make, and what the',
    'generated documents under `docs/views/` are.',
    '',
    '## What runs without you',
    '',
    'The agent does not invent the order of work. `graph_generate` derives from the live',
    'model what has to be described next and hands the agent that instruction; every write',
    'then passes the **apply-gate**, which checks it against the SE rules and rejects what',
    'would leave the model inconsistent. A requirement with no test that could falsify it,',
    'for example, is refused at the moment it is written — not flagged in a review later.',
    '',
    'So consistency takes care of itself. What no rule can check is whether the model',
    'describes **the system you wanted**. That is what the four levers below are for.',
    '',
    '## Lever 1 — the intent paragraph (this one is not optional)',
    '',
    'Everything derives from one paragraph of prose: **what should the system do, and for',
    'whom?** Write it in your own words — no method vocabulary, no module names, no file',
    'layout. Three things are worth naming explicitly, because each becomes structure:',
    '',
    '- **who uses it, and what they get out of it** — the users and their goals;',
    '- **what the system must not do, or must never lose** — the hard constraints;',
    '- **what happens when something goes wrong** — the cases people forget to mention.',
    '',
    'Say this to your agent, with your paragraph in the quotes:',
    '',
    '> Read GRAPHCODE.md, then `se:generate`: "<what the system should do, for whom>"',
    '',
    'On a repo that already has a model, start from where it stands instead:',
    '',
    '> Read GRAPHCODE.md, then: `graph_readiness` — where does the project stand, and what',
    '> is the next step?',
    '',
    '## Lever 2 — answering the questions you get asked',
    '',
    'If the paragraph is too thin to derive from, you get **questions about your domain, in',
    'plain language** ("What happens when a customer cancels an order?", "Who is allowed to',
    'change prices?"). They are not a formality: your answers are the material the model is',
    'built from. Answer them concretely — a vague answer produces a vague requirement, and',
    'the gate will happily certify it as consistent.',
    '',
    '## Lever 3 — the choices that come back to you',
    '',
    'At every design decision the agent is required to put **two** options in front of you,',
    'each previewed against the real model, and to show what each does to it — never to pick',
    'silently. Same for trade studies and failure-mode analysis: those produce options and',
    'evidence, not verdicts. You decide; the decision is recorded, including the option you',
    'turned down, so a later reader can see what was considered and why it lost.',
    '',
    'If your agent presents one option as settled, that is the moment to push back and ask',
    'for the alternative it did not show you.',
    '',
    '## Lever 4 — the target profile (optional, and only when you want to steer)',
    '',
    'You can tell the optimizer what "better" means for this project — how strongly to favour',
    'loosely coupled parts, redundancy, short data paths, cohesive modules, a balanced size,',
    'or the absence of bottlenecks. It lives in `.graphcode/target-profile.json`; your agent',
    'sets it up if you ask for it ("I want to steer the optimization").',
    '',
    'Leaving it unset is a legitimate choice — everything is then weighted equally. Note that',
    'some goals genuinely pull against each other (loosely coupled parts vs. short data paths,',
    'for instance); if you weight both up, you get a warning, not a block. A conscious',
    'trade-off is fine, an invisible one is not.',
    '',
    '## `docs/views/` — the generated documents',
    '',
    'Everything in `docs/views/` is a **deterministic render of the model**, written by',
    '`graph_export`. The same model always produces byte-identical files, and each one carries',
    'a `GENERATED … DO NOT HAND-EDIT` header.',
    '',
    'Take that literally: an edit you make there survives until the next export and is then',
    'gone without a trace. To change what a document says, change the **model** (your agent',
    'does that through the gate) and export again. The documents are the readable face of the',
    'model — for a review, a hand-off, or a diff in a pull request. Your agent does not read',
    'them to plan its work; it queries the model directly. They are for you.',
    '',
    '| file | answers |',
    '| --- | --- |',
    ...viewTableRows(),
    '',
    'Two generated things you will meet alongside them are **not** views:',
    '',
    '- `docs/views/dashboard.url` — the address of the live dashboard, written by the viewer',
    '  on startup and removed on shutdown. Same repo, same address every time; read the file',
    '  anyway, it is the one place that knows. File absent = nothing running, and',
    '  `graphcode status` says why.',
    '- `docs/graph/<name>.graph.json` — the exported model itself, the readable source the',
    '  documents above are rendered from. Also generated; a hand-edit is actively blocked.',
    '',
    '## When a document or a screen says something you do not recognize',
    '',
    'Ask for it by name — `se:help <whatever it said>` explains any rule, gate, panel, or term',
    'twice over: once in plain language, once in systems-engineering terms, plus the exact fix.',
    '`se:help` with nothing after it gives you the ranked next steps for this project.',
    '',
  ].join('\n');
}
