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
import { join } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { readPackageVersion, packageRootDir } from '../kernel/package-version.js';

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
  return join(packageRootDir(), COMMANDS_DIR);
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
  return join(packageRootDir(), HOOKS_DIR);
}

/** This package's own `settings.json` — the single source for WHICH hooks get registered. */
export function packagedSettingsPath(): string {
  return join(packageRootDir(), SETTINGS_FILE);
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
