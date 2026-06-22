/**
 * TEST-cli-scaffold (CR-GC-112) — `graphcode init | update | remove` lifecycle.
 *
 * Runs the real `scaffold()` against a `mkdtempSync` temp repo (no mocks, real
 * `node:fs`). Proves the current MCP-stdio architecture is scaffolded — the
 * retired localhost Controller / `.claude/hooks` path is NOT.
 *
 * Verifies:
 *   - REQ-repo-install      : init creates `.graphcode/`, `.mcp.json` (npx form),
 *                             guardrails, and the package.json dependency.
 *   - REQ-install-idempotent: re-running init is stable (no dup/corruption).
 *   - REQ-repo-update       : update refreshes artifacts but preserves the store.
 *   - REQ-repo-uninstall    : remove deletes every installed artifact, restlos.
 *   - REQ-pre/post-harness-cli via the InstallResult contract.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { scaffold, InstallResultSchema, CliCommandSchema } from '../src/scaffold.js';
import { KUZU_DIR } from '../src/index.js';

const MCP = '.mcp.json';
const GUARDRAILS = 'GRAPHCODE.md';
const PKG = '@sigloch/graphcode';
const SKILLS_DIR = join('.claude', 'skills');
/** The se-*.md skills this package ships — the source of truth the scaffold copies from. */
const SHIPPED_SKILLS = readdirSync(join(__dirname, '..', '.claude', 'skills'))
  .filter((f) => f.startsWith('se-') && f.endsWith('.md'))
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

    // The retired localhost Controller / hooks path is NOT scaffolded.
    expect(existsSync(join(repo, '.claude', 'hooks'))).toBe(false);

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

    // Skills removed restlos; the emptied `.claude/skills` + `.claude` are pruned too.
    for (const f of SHIPPED_SKILLS) {
      expect(existsSync(join(repo, SKILLS_DIR, f))).toBe(false);
      expect(res.removed).toContain(join(SKILLS_DIR, f));
    }
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

  it('remove is idempotent — a clean repo removes nothing without erroring', async () => {
    const res = await scaffold('remove', { repoRoot: repo });
    expect(res.removed).toEqual([]);
  });

  it('CliCommandSchema accepts only the three lifecycle verbs', () => {
    expect(CliCommandSchema.options).toEqual(['init', 'update', 'remove']);
    expect(() => CliCommandSchema.parse('mcp')).toThrow();
  });
});
