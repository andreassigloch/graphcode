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
import { KUZU_DIR } from '../src/index.js';

const MCP = '.mcp.json';
const GUARDRAILS = 'GRAPHCODE.md';
const PKG = '@sigloch/graphcode';
const SKILLS_DIR = join('.claude', 'skills');
const HOOKS_DIR = join('.claude', 'hooks');
const SETTINGS = join('.claude', 'settings.json');
/** The se-*.md skills this package ships — the source of truth the scaffold copies from. */
const SHIPPED_SKILLS = readdirSync(join(__dirname, '..', '.claude', 'skills'))
  .filter((f) => f.startsWith('se-') && f.endsWith('.md'))
  .sort();
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
    const mcp = JSON.parse(readFileSync(join(repo, MCP), 'utf8'));
    expect(mcp).toEqual({
      mcpServers: { graphcode: { command: 'npx', args: ['-y', PKG, 'mcp'] } },
    });

    // Guardrails doc present.
    expect(existsSync(join(repo, GUARDRAILS))).toBe(true);

    // Dependency registered in package.json.
    const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
    expect(pkg.dependencies[PKG]).toBe('^0.1.0');

    // CR-GC-214: the PreToolUse deny-hooks ARE scaffolded into the consumer repo.
    expect(existsSync(join(repo, '.claude', 'hooks'))).toBe(true);
    expect(existsSync(join(repo, SETTINGS))).toBe(true);

    // InstallResult records what was created.
    expect(res.action).toBe('init');
    expect(res.created).toEqual(expect.arrayContaining(['.graphcode/', MCP, GUARDRAILS, 'package.json']));
    expect(res.removed).toEqual([]);
  });

  it('init installs the MCP-driven SE skills (CR-GC-133)', async () => {
    // SHIPPED_SKILLS is read from the shipped .claude/skills/ dir (the source of
    // truth); the toEqual(SHIPPED_SKILLS) round-trip below proves init copies exactly
    // that set. No hardcoded count to bump when a skill is added (CR-GC-205 Item 2).
    expect(SHIPPED_SKILLS.length).toBeGreaterThan(0);
    const res = await scaffold('init', { repoRoot: repo });

    // Every shipped skill lands in the target repo, byte-identical to the source.
    for (const f of SHIPPED_SKILLS) {
      const dest = join(repo, SKILLS_DIR, f);
      expect(existsSync(dest)).toBe(true);
      expect(readFileSync(dest, 'utf8')).toBe(
        readFileSync(join(__dirname, '..', '.claude', 'skills', f), 'utf8'),
      );
      expect(res.created).toContain(join(SKILLS_DIR, f));
    }
    // No stray files in the scaffolded skills dir.
    expect(readdirSync(join(repo, SKILLS_DIR)).sort()).toEqual(SHIPPED_SKILLS);
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
    const skillsDir = join(__dirname, '..', '.claude', 'skills');
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
        ...SHIPPED_SKILLS.map((f) => join(SKILLS_DIR, f)),
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

    // A stale .mcp.json that update must refresh.
    writeFileSync(join(repo, MCP), '{"stale":true}\n', 'utf8');

    const res = await scaffold('update', { repoRoot: repo });

    // Store untouched.
    expect(existsSync(marker)).toBe(true);
    expect(readFileSync(marker, 'utf8')).toBe('LIVE-STORE-DATA');
    expect(res.preserved).toEqual(expect.arrayContaining([KUZU_DIR + '/']));

    // .mcp.json refreshed to the canonical form.
    const mcp = JSON.parse(readFileSync(join(repo, MCP), 'utf8'));
    expect(mcp).toEqual({
      mcpServers: { graphcode: { command: 'npx', args: ['-y', PKG, 'mcp'] } },
    });
    expect(res.updated).toEqual(expect.arrayContaining([MCP]));
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
      expect(existsSync(join(repo, SKILLS_DIR, f))).toBe(false);
      expect(res.removed).toContain(join(SKILLS_DIR, f));
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

  it('remove preserves a member\'s own non-graphcode skills (only se-* are ours)', async () => {
    await scaffold('init', { repoRoot: repo });
    // A skill the member authored — graphcode must NOT delete it.
    const own = join(repo, SKILLS_DIR, 'my-own-skill.md');
    writeFileSync(own, '# mine\n', 'utf8');

    await scaffold('remove', { repoRoot: repo });

    // Our se-* skills are gone; the member's skill (and the dir) survive.
    expect(existsSync(join(repo, SKILLS_DIR, SHIPPED_SKILLS[0]))).toBe(false);
    expect(existsSync(own)).toBe(true);
    expect(existsSync(join(repo, SKILLS_DIR))).toBe(true);
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
    const skillsDir = join(__dirname, '..', '.claude', 'skills');
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
    expect(res.unchanged.sort()).toEqual(SHIPPED_SKILLS.map((f) => join(SKILLS_DIR, f)).sort());
  });

  it('a stale/older copy is restored — reports updated and rewrites the shipped version', async () => {
    await scaffold('init', { repoRoot: repo });
    const victim = SHIPPED_SKILLS[0];
    const victimAbs = join(repo, SKILLS_DIR, victim);
    const shipped = readFileSync(join(__dirname, '..', '.claude', 'skills', victim), 'utf8');

    // Simulate a stale copy: truncate to a frontmatter with a LOWER version: 0.
    writeFileSync(victimAbs, '---\nname: stale\nversion: 0\ndescription: stale\n---\nold body\n', 'utf8');

    const res = syncSkills(repo);
    // The stale skill is reported updated; the rest are unchanged.
    expect(res.updated).toEqual([join(SKILLS_DIR, victim)]);
    expect(res.added).toEqual([]);
    expect(res.unchanged).not.toContain(join(SKILLS_DIR, victim));
    // The file is byte-identical to the shipped source again.
    expect(readFileSync(victimAbs, 'utf8')).toBe(shipped);
  });

  it('a missing copy is added (sync also bootstraps a fresh .claude/skills)', () => {
    // No init: the target has no .claude/skills at all.
    const res = syncSkills(repo);
    expect(res.added.sort()).toEqual(SHIPPED_SKILLS.map((f) => join(SKILLS_DIR, f)).sort());
    expect(res.updated).toEqual([]);
    expect(res.unchanged).toEqual([]);
    // Every shipped skill now exists on disk, byte-identical to the source.
    for (const f of SHIPPED_SKILLS) {
      const dest = join(repo, SKILLS_DIR, f);
      expect(existsSync(dest)).toBe(true);
      expect(readFileSync(dest, 'utf8')).toBe(
        readFileSync(join(__dirname, '..', '.claude', 'skills', f), 'utf8'),
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
