/**
 * TEST-cli-scaffold (CR-GC-112) — `graphcode init | update | remove` lifecycle.
 *
 * Runs the real `scaffold()` against a `mkdtempSync` temp repo (no mocks, real
 * `node:fs`). Proves the current MCP-stdio architecture is scaffolded, including the
 * PreToolUse deny-hooks + their settings registration (CR-GC-214).
 *
 * Verifies:
 *   - REQ-repo-install      : init creates `.graphcode/`, `.mcp.json` (npx form),
 *                             guardrails, and the package.json dependency.
 *   - REQ-install-idempotent: re-running init is stable (no dup/corruption).
 *   - REQ-repo-update       : update refreshes artifacts but preserves the store.
 *   - REQ-repo-uninstall    : remove deletes every installed artifact, restlos.
 *   - CR-GC-214             : init ships `.claude/hooks/deny-*.sh` + registers them in
 *                             `.claude/settings.json` (merge-preserving the member's own
 *                             hooks/keys); remove strips only ours.
 *   - CR-GC-263             : both host configs are scaffolded (`.mcp.json` +
 *                             `opencode.json`) and MERGED — a foreign MCP server or a
 *                             user's provider/model block survives init AND remove.
 *   - REQ-pre/post-harness-cli via the InstallResult contract.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import {
  scaffold,
  syncSkills,
  InstallResultSchema,
  CliCommandSchema,
  SkillSyncResultSchema,
} from '../src/scaffold.js';
import { deriveHostPort } from '../src/scaffold-templates.js';
import { MARKDOWN_VIEWS, VIEW_FILENAMES } from '@sigloch/graphcode-client';
import { KUZU_DIR } from '../src/index.js';

const MCP = '.mcp.json';
/** OpenCode's host config — the second first-class agent host (CR-GC-263). */
const OPENCODE = 'opencode.json';
const GUARDRAILS = 'GRAPHCODE.md';
/** The human-facing companion doc (CR-GC-322). */
const STEERING = 'GRAPHCODE-STEERING.md';
const PKG = '@sigloch/graphcode';
/** This package's published version — the single source both sides of the range read (CR-GC-265). */
const OWN_VERSION = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
).version as string;
const COMMANDS_DIR = join('.claude', 'commands');
const LEGACY_SKILLS_DIR = join('.claude', 'skills');
const HOOKS_DIR = join('.claude', 'hooks');
/** The predecessor product's workspace — graphcode wrote its feed there until CR-GC-330. */
const LEGACY_WORKSPACE = '.aimprove';
const TRAJECTORY = 'trajectory.jsonl';
const SETTINGS = join('.claude', 'settings.json');
/**
 * The SE skills this package ships (CR-GC-277: als Commands-Baum, Pfade relativ
 * zu .claude/commands — se/…, se-view/…, se-*.md) — the source of truth the
 * scaffold copies from.
 */
function listSkillTree(dir: string): string[] {
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
const SHIPPED_SKILLS = listSkillTree(join(__dirname, '..', '.claude', 'commands'));
/** The deny-*.sh hooks this package ships (CR-GC-214) — same no-hardcoded-count principle. */
const SHIPPED_HOOKS = readdirSync(join(__dirname, '..', '.claude', 'hooks'))
  .filter((f) => f.startsWith('deny-') && f.endsWith('.sh'))
  .sort();

describe('TEST-cli-scaffold: graphcode init | update | remove', () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'graphcode-cli-'));
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('init scaffolds the current MCP-stdio architecture (REQ-repo-install)', async () => {
    const res = await scaffold('init', { repoRoot: repo });
    expect(() => InstallResultSchema.parse(res)).not.toThrow();

    // .graphcode/ store dir created.
    expect(existsSync(join(repo, '.graphcode'))).toBe(true);

    // .mcp.json launches the server via npx — the exact form a foreign repo needs.
    // env.GRAPHCODE_HOST_PORT opts the elected host into the live-view bridge (CR-GC-237).
    const mcp = JSON.parse(readFileSync(join(repo, MCP), 'utf8'));
    expect(mcp).toEqual({
      mcpServers: {
        graphcode: {
          command: 'npx',
          args: ['-y', PKG, 'mcp'],
          env: { GRAPHCODE_HOST_PORT: String(deriveHostPort(repo)) },
        },
      },
    });

    // Guardrails doc present.
    expect(existsSync(join(repo, GUARDRAILS))).toBe(true);

    // Dependency registered in package.json — the range tracks THIS package's version
    // (CR-GC-265: derived, not a literal that freezes at an old line).
    const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
    expect(pkg.dependencies[PKG]).toBe(`^${OWN_VERSION}`);

    // CR-GC-214: the PreToolUse deny-hooks ARE scaffolded into the consumer repo.
    expect(existsSync(join(repo, '.claude', 'hooks'))).toBe(true);
    expect(existsSync(join(repo, SETTINGS))).toBe(true);

    // InstallResult records what was created.
    expect(res.action).toBe('init');
    expect(res.created).toEqual(expect.arrayContaining(['.graphcode/', MCP, GUARDRAILS, 'package.json']));
    expect(res.removed).toEqual([]);
  });

  it('init installs the MCP-driven SE skills as commands (CR-GC-133/277)', async () => {
    // SHIPPED_SKILLS is read from the shipped .claude/commands/ tree (the source of
    // truth); the toEqual(SHIPPED_SKILLS) round-trip below proves init copies exactly
    // that set. No hardcoded count to bump when a skill is added (CR-GC-205 Item 2).
    expect(SHIPPED_SKILLS.length).toBeGreaterThan(0);
    const res = await scaffold('init', { repoRoot: repo });

    // Every shipped skill lands in the target repo, byte-identical to the source.
    for (const f of SHIPPED_SKILLS) {
      const dest = join(repo, COMMANDS_DIR, f);
      expect(existsSync(dest)).toBe(true);
      expect(readFileSync(dest, 'utf8')).toBe(
        readFileSync(join(__dirname, '..', '.claude', 'commands', f), 'utf8'),
      );
      expect(res.created).toContain(join(COMMANDS_DIR, f));
    }
    // No stray files in the scaffolded commands tree — and NOTHING in the legacy dir.
    expect(listSkillTree(join(repo, COMMANDS_DIR))).toEqual(SHIPPED_SKILLS);
    expect(existsSync(join(repo, LEGACY_SKILLS_DIR))).toBe(false);
  });

  it('update migrates legacy flat .claude/skills/se-*.md copies away (CR-GC-277)', async () => {
    // Ein Repo mit Alt-Stand: flache Skills aus ≤0.9.0.
    mkdirSync(join(repo, LEGACY_SKILLS_DIR), { recursive: true });
    writeFileSync(join(repo, LEGACY_SKILLS_DIR, 'se-fmea.md'), '---\nname: se-fmea\nversion: 1\n---\nalt\n', 'utf8');
    writeFileSync(join(repo, LEGACY_SKILLS_DIR, 'my-own-skill.md'), '# mine\n', 'utf8');

    const res = await scaffold('update', { repoRoot: repo });

    // Legacy-Kopie weg (nur unsere), Member-Skill bleibt, Commands-Baum steht.
    expect(existsSync(join(repo, LEGACY_SKILLS_DIR, 'se-fmea.md'))).toBe(false);
    expect(res.removed).toContain(join(LEGACY_SKILLS_DIR, 'se-fmea.md'));
    expect(existsSync(join(repo, LEGACY_SKILLS_DIR, 'my-own-skill.md'))).toBe(true);
    expect(existsSync(join(repo, COMMANDS_DIR, 'se-fmea.md'))).toBe(true);
  });

  it('GRAPHCODE.md carries the graph-first onboarding contract (CR-GC-207)', async () => {
    await scaffold('init', { repoRoot: repo });
    const md = readFileSync(join(repo, GUARDRAILS), 'utf8');
    // (1) graph is SSOT, not the docs; query-first, not doc-ingest.
    expect(md).toMatch(/graph is the SSOT, not the docs/i);
    // (2) names the entry query path — all four precision tools.
    for (const tool of ['graph_readiness', 'graph_elements', 'graph_impact', 'graph_expand']) {
      expect(md).toContain(tool);
    }
    // (3) canonical Format-E dialect is uid.TYPE; the SPEC.md Name.SY.001 spelling is dead.
    expect(md).toContain('uid.TYPE');
    expect(md).toMatch(/`Name\.SY\.001`[^\n]*dead/i);
    // (4) SPEC.md is bootstrap input, do not read it to plan.
    expect(md).toMatch(/SPEC\.md.*do not read it/i);
  });

  it('GRAPHCODE.md tells the agent where the live view is — and that ONE command starts it (CR-GC-306)', async () => {
    await scaffold('init', { repoRoot: repo });
    const md = readFileSync(join(repo, GUARDRAILS), 'utf8');
    // The address source. An agent follows the graph-first rule and never reads
    // docs/views/README.md, so the pointer has to be HERE or it is invisible.
    expect(md).toContain('docs/views/dashboard.url');
    // One command, not two. `graphcode host` must be marked as the fallback it is —
    // starting it next to a live host just hits the store lock.
    expect(md).toMatch(/fallback/i);
    // No hard-coded port: the bound address is dynamic (Vite bumps on conflict) and
    // a number in the docs is how people end up inspecting the wrong instance.
    expect(md).not.toMatch(/\b4317\b/);
  });

  it('GRAPHCODE.md is refreshed by `update`, not only written by `init` (CR-GC-306)', async () => {
    await scaffold('init', { repoRoot: repo });
    // Simulate an older scaffold: the file predates the live-view section.
    writeFileSync(join(repo, GUARDRAILS), '# stale guardrails from an older version\n');
    await scaffold('update', { repoRoot: repo });
    const md = readFileSync(join(repo, GUARDRAILS), 'utf8');
    expect(md).toContain('docs/views/dashboard.url');
    expect(md).not.toContain('stale guardrails');
  });

  it('GRAPHCODE.md points at se:help / graph_help as the live help entry (CR-GC-230)', async () => {
    await scaffold('init', { repoRoot: repo });
    const md = readFileSync(join(repo, GUARDRAILS), 'utf8');
    expect(md).toContain('se:help');
    expect(md).toContain('graph_help');
  });

  it('GRAPHCODE.md lists the available se-* skills (CR-GC-208)', async () => {
    await scaffold('init', { repoRoot: repo });
    const md = readFileSync(join(repo, GUARDRAILS), 'utf8');
    // The section exists and points at the Skill tool + `skills sync`.
    expect(md).toMatch(/## Available se-\* skills/);
    expect(md).toMatch(/Skill tool/);
    expect(md).toContain('skills sync');
    // Every shipped skill's `name:` appears in the table — derived, cannot drift.
    const skillsDir = join(__dirname, '..', '.claude', 'commands');
    for (const f of SHIPPED_SKILLS) {
      const fm = readFileSync(join(skillsDir, f), 'utf8');
      const name = /^name:\s*(.+)$/m.exec(fm)?.[1].trim();
      expect(name, `${f} has a name:`).toBeTruthy();
      expect(md).toContain(name as string);
    }
  });

  it('init ships the PreToolUse deny-hooks + registers them in settings.json (CR-GC-214)', async () => {
    expect(SHIPPED_HOOKS.length).toBeGreaterThan(0);
    const res = await scaffold('init', { repoRoot: repo });

    // Every shipped hook lands byte-identical in the target repo.
    for (const f of SHIPPED_HOOKS) {
      const dest = join(repo, HOOKS_DIR, f);
      expect(existsSync(dest)).toBe(true);
      expect(readFileSync(dest, 'utf8')).toBe(
        readFileSync(join(__dirname, '..', '.claude', 'hooks', f), 'utf8'),
      );
      expect(res.created).toContain(join(HOOKS_DIR, f));
    }

    // settings.json registers exactly THIS package's own PreToolUse hooks (no parallel list).
    const settings = JSON.parse(readFileSync(join(repo, SETTINGS), 'utf8'));
    const pkgSettings = JSON.parse(
      readFileSync(join(__dirname, '..', '.claude', 'settings.json'), 'utf8'),
    );
    expect(settings.hooks.PreToolUse).toEqual(pkgSettings.hooks.PreToolUse);
    expect(res.created).toContain(SETTINGS);
  });

  it("init merges hooks into a member's existing settings.json, preserving their keys (CR-GC-214)", async () => {
    // A member who already has their own settings key + their own PreToolUse hook.
    const ownHook = { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo mine' }] };
    mkdirSync(join(repo, '.claude'), { recursive: true });
    writeFileSync(
      join(repo, SETTINGS),
      JSON.stringify({ env: { FOO: '1' }, hooks: { PreToolUse: [ownHook] } }, null, 2) + '\n',
      'utf8',
    );

    await scaffold('init', { repoRoot: repo });

    const settings = JSON.parse(readFileSync(join(repo, SETTINGS), 'utf8'));
    // Member's non-hook key survives untouched.
    expect(settings.env).toEqual({ FOO: '1' });
    // Member's own hook is kept first; graphcode's deny-hooks are appended after it.
    expect(settings.hooks.PreToolUse[0]).toEqual(ownHook);
    expect(settings.hooks.PreToolUse.length).toBeGreaterThan(1);
    expect(JSON.stringify(settings.hooks.PreToolUse)).toContain('.claude/hooks/deny-');
  });

  it('init is idempotent — second run is stable, nothing duplicated/corrupted (REQ-install-idempotent)', async () => {
    await scaffold('init', { repoRoot: repo });
    const mcpAfterFirst = readFileSync(join(repo, MCP), 'utf8');
    const pkgAfterFirst = readFileSync(join(repo, 'package.json'), 'utf8');

    const second = await scaffold('init', { repoRoot: repo });

    // Files byte-identical after a re-run.
    expect(readFileSync(join(repo, MCP), 'utf8')).toBe(mcpAfterFirst);
    expect(readFileSync(join(repo, 'package.json'), 'utf8')).toBe(pkgAfterFirst);

    // Dependency appears exactly once (no duplication).
    const pkg = JSON.parse(pkgAfterFirst);
    const occurrences = Object.keys(pkg.dependencies).filter((k) => k === PKG).length;
    expect(occurrences).toBe(1);

    // Second run created nothing new; everything is preserved — including every skill.
    expect(second.created).toEqual([]);
    expect(second.updated).toEqual([]);
    expect(second.preserved).toEqual(
      expect.arrayContaining([
        '.graphcode/',
        MCP,
        GUARDRAILS,
        'package.json',
        ...SHIPPED_SKILLS.map((f) => join(COMMANDS_DIR, f)),
        ...SHIPPED_HOOKS.map((f) => join(HOOKS_DIR, f)),
        SETTINGS,
      ]),
    );
  });

  it('update refreshes artifacts but preserves the existing store (REQ-repo-update)', async () => {
    await scaffold('init', { repoRoot: repo });

    // Simulate a live store with data.
    const kuzuDir = join(repo, KUZU_DIR);
    mkdirSync(kuzuDir, { recursive: true });
    const marker = join(kuzuDir, 'data.kz');
    writeFileSync(marker, 'LIVE-STORE-DATA', 'utf8');

    // A stale graphcode entry (pre-npx form) next to a server the repo owns.
    writeFileSync(
      join(repo, MCP),
      JSON.stringify({
        mcpServers: {
          context7: { command: 'npx', args: ['-y', 'some-other-mcp'] },
          graphcode: { command: 'node', args: ['old/path.js'] },
        },
      }) + '\n',
      'utf8',
    );

    const res = await scaffold('update', { repoRoot: repo });

    // Store untouched.
    expect(existsSync(marker)).toBe(true);
    expect(readFileSync(marker, 'utf8')).toBe('LIVE-STORE-DATA');
    expect(res.preserved).toEqual(expect.arrayContaining([KUZU_DIR + '/']));

    // Our entry refreshed to the canonical npx form (derived port); the repo's own
    // server is untouched — update owns `mcpServers.graphcode`, nothing else (CR-GC-263).
    const mcp = JSON.parse(readFileSync(join(repo, MCP), 'utf8'));
    expect(mcp.mcpServers.graphcode).toEqual({
      command: 'npx',
      args: ['-y', PKG, 'mcp'],
      env: { GRAPHCODE_HOST_PORT: String(deriveHostPort(repo)) },
    });
    expect(mcp.mcpServers.context7).toEqual({ command: 'npx', args: ['-y', 'some-other-mcp'] });
    expect(res.updated).toEqual(expect.arrayContaining([MCP]));
  });

  it('update preserves a user-edited GRAPHCODE_HOST_PORT (CR-GC-237)', async () => {
    await scaffold('init', { repoRoot: repo });

    // The user resolved a port conflict by editing .mcp.json.
    const edited = JSON.parse(readFileSync(join(repo, MCP), 'utf8'));
    edited.mcpServers.graphcode.env.GRAPHCODE_HOST_PORT = '4999';
    writeFileSync(join(repo, MCP), JSON.stringify(edited, null, 2) + '\n', 'utf8');

    await scaffold('update', { repoRoot: repo });

    const mcp = JSON.parse(readFileSync(join(repo, MCP), 'utf8'));
    expect(mcp.mcpServers.graphcode.env.GRAPHCODE_HOST_PORT).toBe('4999');
  });

  it('update preserves the operator own env switches', async () => {
    await scaffold('init', { repoRoot: repo });

    // The operator opted out of the auto-started viewer and pinned a local GVE build.
    const edited = JSON.parse(readFileSync(join(repo, MCP), 'utf8'));
    edited.mcpServers.graphcode.env.GRAPHCODE_NO_GVE = '1';
    edited.mcpServers.graphcode.env.GRAPHCODE_GVE_BIN = 'node ../graph-view-edit/bin/gve.mjs';
    writeFileSync(join(repo, MCP), JSON.stringify(edited, null, 2) + '\n', 'utf8');

    await scaffold('update', { repoRoot: repo });

    const mcp = JSON.parse(readFileSync(join(repo, MCP), 'utf8'));
    expect(mcp.mcpServers.graphcode.env).toEqual({
      GRAPHCODE_NO_GVE: '1',
      GRAPHCODE_GVE_BIN: 'node ../graph-view-edit/bin/gve.mjs',
      GRAPHCODE_HOST_PORT: String(deriveHostPort(repo)),
    });
  });

  it('update preserves the operator own environment switches in opencode.json', async () => {
    await scaffold('init', { repoRoot: repo });

    const edited = JSON.parse(readFileSync(join(repo, OPENCODE), 'utf8'));
    edited.mcp.graphcode.environment.GRAPHCODE_NO_GVE = '1';
    writeFileSync(join(repo, OPENCODE), JSON.stringify(edited, null, 2) + '\n', 'utf8');

    await scaffold('update', { repoRoot: repo });

    const cfg = JSON.parse(readFileSync(join(repo, OPENCODE), 'utf8'));
    expect(cfg.mcp.graphcode.environment).toEqual({
      GRAPHCODE_NO_GVE: '1',
      GRAPHCODE_HOST_PORT: String(deriveHostPort(repo)),
    });
  });

  it('remove deletes every installed artifact, restlos (REQ-repo-uninstall)', async () => {
    await scaffold('init', { repoRoot: repo });
    // Add store data so we prove .graphcode/ is fully removed.
    mkdirSync(join(repo, KUZU_DIR), { recursive: true });
    writeFileSync(join(repo, KUZU_DIR, 'data.kz'), 'x', 'utf8');

    const res = await scaffold('remove', { repoRoot: repo });

    expect(existsSync(join(repo, '.graphcode'))).toBe(false);
    expect(existsSync(join(repo, MCP))).toBe(false);
    expect(existsSync(join(repo, GUARDRAILS))).toBe(false);

    // Skills + hooks removed restlos; the graphcode-only settings.json is removed too;
    // the emptied `.claude/skills`, `.claude/hooks` and `.claude` are pruned.
    for (const f of SHIPPED_SKILLS) {
      expect(existsSync(join(repo, COMMANDS_DIR, f))).toBe(false);
      expect(res.removed).toContain(join(COMMANDS_DIR, f));
    }
    for (const f of SHIPPED_HOOKS) {
      expect(existsSync(join(repo, HOOKS_DIR, f))).toBe(false);
      expect(res.removed).toContain(join(HOOKS_DIR, f));
    }
    expect(existsSync(join(repo, SETTINGS))).toBe(false);
    expect(res.removed).toContain(SETTINGS);
    expect(existsSync(join(repo, '.claude'))).toBe(false);

    // Dependency stripped from package.json (the file itself stays).
    const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
    expect(pkg.dependencies?.[PKG]).toBeUndefined();

    expect(res.action).toBe('remove');
    expect(res.removed).toEqual(expect.arrayContaining(['.graphcode/', MCP, GUARDRAILS]));
  });

  // CR-GC-331 — bis CR-GC-330 landete der Learning-Feed in `.aimprove/`, dem Workspace
  // des Vorgängerprodukts. `remove` verspricht Restlosigkeit und kannte den Ordner nicht.
  // Geräumt wird genau unsere Datei; ein `.aimprove/` mit Fremdinhalt bleibt stehen.
  it('remove deletes the predecessor learning feed and its empty dir (CR-GC-331)', async () => {
    await scaffold('init', { repoRoot: repo });
    mkdirSync(join(repo, LEGACY_WORKSPACE), { recursive: true });
    writeFileSync(join(repo, LEGACY_WORKSPACE, TRAJECTORY), '{"a":1}\n', 'utf8');

    const res = await scaffold('remove', { repoRoot: repo });

    expect(res.removed).toContain(join(LEGACY_WORKSPACE, TRAJECTORY));
    expect(existsSync(join(repo, LEGACY_WORKSPACE))).toBe(false);
  });

  it('remove leaves a predecessor dir that still holds foreign data (CR-GC-331)', async () => {
    await scaffold('init', { repoRoot: repo });
    mkdirSync(join(repo, LEGACY_WORKSPACE), { recursive: true });
    writeFileSync(join(repo, LEGACY_WORKSPACE, TRAJECTORY), '{"a":1}\n', 'utf8');
    // aimprove's own state — not ours to delete.
    writeFileSync(join(repo, LEGACY_WORKSPACE, 'learning.db'), 'sqlite', 'utf8');

    const res = await scaffold('remove', { repoRoot: repo });

    expect(res.removed).toContain(join(LEGACY_WORKSPACE, TRAJECTORY));
    expect(existsSync(join(repo, LEGACY_WORKSPACE, TRAJECTORY))).toBe(false);
    expect(existsSync(join(repo, LEGACY_WORKSPACE, 'learning.db'))).toBe(true);
  });

  it('remove without a predecessor dir reports nothing extra (CR-GC-331)', async () => {
    await scaffold('init', { repoRoot: repo });

    const res = await scaffold('remove', { repoRoot: repo });

    expect(res.removed.some((p) => p.startsWith(LEGACY_WORKSPACE))).toBe(false);
    expect(existsSync(join(repo, LEGACY_WORKSPACE))).toBe(false);
  });

  it('remove preserves a member\'s own non-graphcode skills (only se-* are ours)', async () => {
    await scaffold('init', { repoRoot: repo });
    // A skill the member authored — graphcode must NOT delete it.
    const own = join(repo, COMMANDS_DIR, 'my-own-skill.md');
    writeFileSync(own, '# mine\n', 'utf8');

    await scaffold('remove', { repoRoot: repo });

    // Our se-* skills are gone; the member's skill (and the dir) survive.
    expect(existsSync(join(repo, COMMANDS_DIR, SHIPPED_SKILLS[0]))).toBe(false);
    expect(existsSync(own)).toBe(true);
    expect(existsSync(join(repo, COMMANDS_DIR))).toBe(true);
  });

  it("remove preserves a member's own settings keys + their own hooks (only ours are stripped)", async () => {
    const ownHook = { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo mine' }] };
    mkdirSync(join(repo, '.claude'), { recursive: true });
    writeFileSync(
      join(repo, SETTINGS),
      JSON.stringify({ env: { FOO: '1' }, hooks: { PreToolUse: [ownHook] } }, null, 2) + '\n',
      'utf8',
    );
    await scaffold('init', { repoRoot: repo });
    await scaffold('remove', { repoRoot: repo });

    // settings.json survives with the member's key + their hook; only graphcode's are stripped.
    const settings = JSON.parse(readFileSync(join(repo, SETTINGS), 'utf8'));
    expect(settings.env).toEqual({ FOO: '1' });
    expect(settings.hooks.PreToolUse).toEqual([ownHook]);
    expect(JSON.stringify(settings)).not.toContain('.claude/hooks/deny-');
    // Our hook files are gone.
    for (const f of SHIPPED_HOOKS) {
      expect(existsSync(join(repo, HOOKS_DIR, f))).toBe(false);
    }
  });

  // ---------------------------------------------------------------------------
  // CR-GC-263 — OpenCode is a first-class host; both host configs are MERGED.
  // ---------------------------------------------------------------------------

  it('init scaffolds opencode.json with the same server in OpenCode schema (CR-GC-263)', async () => {
    const res = await scaffold('init', { repoRoot: repo });

    const oc = JSON.parse(readFileSync(join(repo, OPENCODE), 'utf8'));
    expect(oc).toEqual({
      $schema: 'https://opencode.ai/config.json',
      mcp: {
        graphcode: {
          type: 'local',
          command: ['npx', '-y', PKG, 'mcp'],
          enabled: true,
          environment: { GRAPHCODE_HOST_PORT: String(deriveHostPort(repo)) },
        },
      },
    });
    expect(res.created).toContain(OPENCODE);
  });

  it('init merges into a user opencode.json — provider/model/permission survive (CR-GC-263)', async () => {
    const userCfg = {
      $schema: 'https://opencode.ai/config.json',
      provider: { lmstudio: { name: 'LM Studio (local)' } },
      model: 'lmstudio/qwen3.6-27b',
      permission: { edit: 'allow' },
      mcp: { other: { type: 'local', command: ['node', 'other.js'] } },
    };
    writeFileSync(join(repo, OPENCODE), JSON.stringify(userCfg, null, 2) + '\n', 'utf8');

    await scaffold('init', { repoRoot: repo });

    const oc = JSON.parse(readFileSync(join(repo, OPENCODE), 'utf8'));
    expect(oc.provider).toEqual(userCfg.provider);
    expect(oc.model).toBe(userCfg.model);
    expect(oc.permission).toEqual(userCfg.permission);
    expect(oc.mcp.other).toEqual(userCfg.mcp.other); // foreign server kept
    expect(oc.mcp.graphcode.command).toEqual(['npx', '-y', PKG, 'mcp']);
  });

  it('init keeps a FOREIGN mcp server in .mcp.json (CR-GC-263 regression)', async () => {
    const foreign = { command: 'npx', args: ['-y', 'some-other-mcp'] };
    writeFileSync(
      join(repo, MCP),
      JSON.stringify({ mcpServers: { context7: foreign } }, null, 2) + '\n',
      'utf8',
    );

    await scaffold('init', { repoRoot: repo });

    const mcp = JSON.parse(readFileSync(join(repo, MCP), 'utf8'));
    expect(mcp.mcpServers.context7).toEqual(foreign);
    expect(mcp.mcpServers.graphcode.args).toEqual(['-y', PKG, 'mcp']);
  });

  it('update is byte-stable for both host configs (REQ-install-idempotent)', async () => {
    await scaffold('init', { repoRoot: repo });
    await scaffold('update', { repoRoot: repo });
    const first = { mcp: readFileSync(join(repo, MCP), 'utf8'), oc: readFileSync(join(repo, OPENCODE), 'utf8') };

    const res = await scaffold('update', { repoRoot: repo });

    expect(readFileSync(join(repo, MCP), 'utf8')).toBe(first.mcp);
    expect(readFileSync(join(repo, OPENCODE), 'utf8')).toBe(first.oc);
    expect(res.preserved).toEqual(expect.arrayContaining([MCP, OPENCODE]));
  });

  it('remove strips only graphcode from both host configs (CR-GC-263)', async () => {
    const foreign = { command: 'npx', args: ['-y', 'some-other-mcp'] };
    writeFileSync(
      join(repo, MCP),
      JSON.stringify({ mcpServers: { context7: foreign } }, null, 2) + '\n',
      'utf8',
    );
    writeFileSync(
      join(repo, OPENCODE),
      JSON.stringify({ model: 'lmstudio/qwen3.6-27b' }, null, 2) + '\n',
      'utf8',
    );
    await scaffold('init', { repoRoot: repo });

    const res = await scaffold('remove', { repoRoot: repo });

    // Both files survive, carrying ONLY the user's content.
    const mcp = JSON.parse(readFileSync(join(repo, MCP), 'utf8'));
    expect(mcp.mcpServers).toEqual({ context7: foreign });
    const oc = JSON.parse(readFileSync(join(repo, OPENCODE), 'utf8'));
    expect(oc.model).toBe('lmstudio/qwen3.6-27b');
    expect(oc.mcp).toBeUndefined();
    expect(res.updated).toEqual(expect.arrayContaining([MCP, OPENCODE]));
    expect(res.removed).not.toContain(MCP);
    expect(res.removed).not.toContain(OPENCODE);
  });

  it('remove deletes a host config that was graphcode-only (CR-GC-263)', async () => {
    await scaffold('init', { repoRoot: repo });
    const res = await scaffold('remove', { repoRoot: repo });

    expect(existsSync(join(repo, MCP))).toBe(false);
    expect(existsSync(join(repo, OPENCODE))).toBe(false);
    expect(res.removed).toEqual(expect.arrayContaining([MCP, OPENCODE]));
  });

  it('remove is idempotent — a clean repo removes nothing without erroring', async () => {
    const res = await scaffold('remove', { repoRoot: repo });
    expect(res.removed).toEqual([]);
  });

  it('CliCommandSchema accepts only the three lifecycle verbs', () => {
    expect(CliCommandSchema.options).toEqual(['init', 'update', 'remove']);
    expect(() => CliCommandSchema.parse('mcp')).toThrow();
  });
});

describe('TEST-skills-sync: graphcode skills sync (CR-GC-208 anti-drift)', () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'graphcode-skills-sync-'));
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('every shipped se-* skill carries a version: in its frontmatter', () => {
    const skillsDir = join(__dirname, '..', '.claude', 'commands');
    for (const f of SHIPPED_SKILLS) {
      const fm = readFileSync(join(skillsDir, f), 'utf8');
      // version: sits in the first --- fence; assert it parses to a finite integer.
      const m = /^version:\s*(\d+)\s*$/m.exec(fm);
      expect(m, `${f} carries version:`).toBeTruthy();
      expect(Number.isFinite(Number((m as RegExpExecArray)[1]))).toBe(true);
    }
  });

  it('an up-to-date repo yields all unchanged (REQ no-drift no-op)', async () => {
    await scaffold('init', { repoRoot: repo });
    const res = syncSkills(repo);
    expect(() => SkillSyncResultSchema.parse(res)).not.toThrow();
    expect(res.added).toEqual([]);
    expect(res.updated).toEqual([]);
    // Every shipped skill reports unchanged (init wrote the current version).
    expect(res.unchanged.sort()).toEqual(SHIPPED_SKILLS.map((f) => join(COMMANDS_DIR, f)).sort());
  });

  it('a stale/older copy is restored — reports updated and rewrites the shipped version', async () => {
    await scaffold('init', { repoRoot: repo });
    const victim = SHIPPED_SKILLS[0];
    const victimAbs = join(repo, COMMANDS_DIR, victim);
    const shipped = readFileSync(join(__dirname, '..', '.claude', 'commands', victim), 'utf8');

    // Simulate a stale copy: truncate to a frontmatter with a LOWER version: 0.
    writeFileSync(victimAbs, '---\nname: stale\nversion: 0\ndescription: stale\n---\nold body\n', 'utf8');

    const res = syncSkills(repo);
    // The stale skill is reported updated; the rest are unchanged.
    expect(res.updated).toEqual([join(COMMANDS_DIR, victim)]);
    expect(res.added).toEqual([]);
    expect(res.unchanged).not.toContain(join(COMMANDS_DIR, victim));
    // The file is byte-identical to the shipped source again.
    expect(readFileSync(victimAbs, 'utf8')).toBe(shipped);
  });

  it('a missing copy is added (sync also bootstraps a fresh .claude/skills)', () => {
    // No init: the target has no .claude/skills at all.
    const res = syncSkills(repo);
    expect(res.added.sort()).toEqual(SHIPPED_SKILLS.map((f) => join(COMMANDS_DIR, f)).sort());
    expect(res.updated).toEqual([]);
    expect(res.unchanged).toEqual([]);
    // Every shipped skill now exists on disk, byte-identical to the source.
    for (const f of SHIPPED_SKILLS) {
      const dest = join(repo, COMMANDS_DIR, f);
      expect(existsSync(dest)).toBe(true);
      expect(readFileSync(dest, 'utf8')).toBe(
        readFileSync(join(__dirname, '..', '.claude', 'commands', f), 'utf8'),
      );
    }
  });

  it('sync is idempotent — a second run after the first is all unchanged', () => {
    const first = syncSkills(repo); // bootstraps (all added)
    expect(first.added.length).toBe(SHIPPED_SKILLS.length);
    const second = syncSkills(repo);
    expect(second.added).toEqual([]);
    expect(second.updated).toEqual([]);
    expect(second.unchanged.length).toBe(SHIPPED_SKILLS.length);
  });
});

/**
 * TEST-steering-doc (CR-GC-322) — `GRAPHCODE-STEERING.md`, the doc scaffolded for the
 * HUMAN. Every other scaffolded document addresses the agent; this one has to survive
 * the cold-reader test: someone who has never met this ontology must find their four
 * decisions and an explanation of `docs/views/` in it.
 */
describe('TEST-steering-doc: GRAPHCODE-STEERING.md (CR-GC-322)', () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'graphcode-steering-'));
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: 'member' }, null, 2), 'utf8');
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  const read = () => readFileSync(join(repo, STEERING), 'utf8');

  it('init writes it, update refreshes it, remove deletes it (REQ-S01)', async () => {
    const init = await scaffold('init', { repoRoot: repo });
    expect(existsSync(join(repo, STEERING))).toBe(true);
    expect(init.created).toContain(STEERING);

    // Unchanged content is reported as preserved, not updated (writeArtifact's
    // idempotence contract — same as GRAPHCODE.md). The refresh path is REQ-S08.
    const upd = await scaffold('update', { repoRoot: repo });
    expect(upd.preserved).toContain(STEERING);

    const rm = await scaffold('remove', { repoRoot: repo });
    expect(existsSync(join(repo, STEERING))).toBe(false);
    expect(rm.removed).toContain(STEERING);
  });

  it('names all four levers the human actually holds (REQ-S02)', async () => {
    await scaffold('init', { repoRoot: repo });
    const md = read();
    // 1 intent paragraph, 2 the domain questions, 3 the choices handed back, 4 target profile.
    expect(md).toMatch(/intent paragraph/i);
    expect(md).toMatch(/questions about your domain/i);
    expect(md).toMatch(/\*\*two\*\* options/);
    expect(md).toContain('.graphcode/target-profile.json');
    // …and says the two mandatory ones are mandatory.
    expect(md).toMatch(/not optional/i);
  });

  it('carries the copy-able opening line for both the empty and the seeded repo (REQ-S03)', async () => {
    await scaffold('init', { repoRoot: repo });
    const md = read();
    expect(md).toContain('se:generate');
    expect(md).toContain('graph_readiness');
    // Both are quoted lines the user can copy, not prose describing them.
    expect(md).toMatch(/^> Read GRAPHCODE\.md, then `se:generate`:/m);
    expect(md).toMatch(/^> Read GRAPHCODE\.md, then: `graph_readiness`/m);
  });

  it('explains docs/views as a deterministic render, not a place to edit (REQ-S04)', async () => {
    await scaffold('init', { repoRoot: repo });
    const md = read();
    expect(md).toContain('docs/views/');
    expect(md).toContain('graph_export');
    expect(md).toMatch(/byte-identical/i);
    expect(md).toMatch(/DO NOT HAND-EDIT/);
    // The consequence, spelled out — the header alone is read only after opening the file.
    expect(md).toMatch(/survives until the next export and is then/i);
  });

  it('documents EVERY view in the shared catalog, under its real filename (REQ-S05)', async () => {
    await scaffold('init', { repoRoot: repo });
    const md = read();
    for (const v of MARKDOWN_VIEWS) {
      const file = VIEW_FILENAMES[v];
      const row = md.split('\n').find((l) => l.startsWith(`| \`${file}\` |`));
      expect(row, `${file} has a table row`).toBeTruthy();
      // The row carries a real sentence, not a placeholder.
      const blurb = (row as string).split('|')[2].trim();
      expect(blurb.length, `${file} blurb is a sentence`).toBeGreaterThan(20);
      expect(blurb).not.toMatch(/TODO|TBD/i);
    }
    // Coverage is exactly the catalog — no invented extra rows.
    const rows = md.split('\n').filter((l) => /^\| `[a-z-]+\.md` \| /.test(l));
    expect(rows.length).toBe(MARKDOWN_VIEWS.length);
  });

  it('marks dashboard.url as NOT a view and hard-codes no port (REQ-S06)', async () => {
    await scaffold('init', { repoRoot: repo });
    const md = read();
    expect(md).toContain('docs/views/dashboard.url');
    expect(md).toMatch(/are \*\*not\*\* views/i);
    // It must not appear as a catalog row (that is what would send people looking for a render).
    expect(md).not.toMatch(/^\| `dashboard\.url` \|/m);
    // The bound port is dynamic; a number here is how people inspect the wrong instance.
    expect(md).not.toMatch(/\b\d{4}\b/);
  });

  it('GRAPHCODE.md points at it once and names the REAL skill dir (REQ-S07)', async () => {
    await scaffold('init', { repoRoot: repo });
    const md = readFileSync(join(repo, GUARDRAILS), 'utf8');
    // The pointer exists — and exactly once, so the agent-facing doc stays short.
    expect(md.match(new RegExp(STEERING, 'g'))?.length).toBe(1);
    // CR-GC-277 moved the skills to .claude/commands/; the guardrails still claimed
    // `.claude/skills/` — the very layout removeLegacySkills() deletes.
    expect(md).toContain('.claude/commands/');
    expect(md).not.toContain('.claude/skills/');
  });

  it('update overwrites a stale copy — shipped doc, no user content to preserve (REQ-S08)', async () => {
    await scaffold('init', { repoRoot: repo });
    writeFileSync(join(repo, STEERING), '# steering doc from an older version\n', 'utf8');
    const res = await scaffold('update', { repoRoot: repo });
    expect(res.updated).toContain(STEERING);
    const md = read();
    expect(md).not.toContain('from an older version');
    expect(md).toContain('docs/views/');
  });
});
