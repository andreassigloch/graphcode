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
import { scaffold, InstallResultSchema, CliCommandSchema } from '../src/scaffold.js';
import { KUZU_DIR } from '../src/index.js';

const MCP = '.mcp.json';
const GUARDRAILS = 'GRAPHCODE.md';
const PKG = '@sigloch/graphcode';

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

    // Second run created nothing new; everything is preserved.
    expect(second.created).toEqual([]);
    expect(second.updated).toEqual([]);
    expect(second.preserved).toEqual(
      expect.arrayContaining(['.graphcode/', MCP, GUARDRAILS, 'package.json']),
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

    // Dependency stripped from package.json (the file itself stays).
    const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
    expect(pkg.dependencies?.[PKG]).toBeUndefined();

    expect(res.action).toBe('remove');
    expect(res.removed).toEqual(expect.arrayContaining(['.graphcode/', MCP, GUARDRAILS]));
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
