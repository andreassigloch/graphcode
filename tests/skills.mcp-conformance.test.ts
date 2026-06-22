/**
 * TEST-skills-mcp (CR-GC-132) — the SE skills are MCP-driven, not on the dead API.
 *
 * The 9 `.claude/skills/se-*.md` skills drove a retired localhost:3001 HTTP API
 * (GET /api/graph/*, POST /api/graph/apply, /api/dashboard/*) that CR-GC-111
 * removed in favour of the MCP-stdio surface. This is the "done = verified" gate
 * for the prompt-realized FUNCs of MOD-skills: every skill is OFF the dead path
 * and ON the bound MCP tools.
 *
 * Two invariants over ALL skill files:
 *   (1) zero references to the retired HTTP API
 *       (localhost:3001 | GRAPH_API | /api/graph | /api/dashboard),
 *   (2) each skill names at least one tool that is ACTUALLY in the live registry
 *       (Object.keys(bindToolsToHarness(...)) — not a hardcoded list, so a renamed
 *       or removed tool fails this test).
 *
 * Real disk Kuzu (temp dir) builds the real registry; no mocks. The skills are read
 * straight off disk — this is a static-conformance check, the harness only supplies
 * the canonical tool-name set.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const SKILLS_DIR = join(__dirname, '..', '.claude', 'skills');
const DEAD_API = /localhost:3001|GRAPH_API|\/api\/graph|\/api\/dashboard/;

function skillFiles(): string[] {
  return readdirSync(SKILLS_DIR).filter((f) => f.startsWith('se-') && f.endsWith('.md'));
}

describe('TEST-skills-mcp: every SE skill is MCP-driven, off the retired localhost:3001 API', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let toolNames: string[];

  beforeAll(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-skills-conf-'));
    mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
    const config: HarnessConfig = {
      repoRoot,
      scope: { workspaceId: 'demo-ws', systemId: 'graphcode' },
      consumerType: 'agent',
      preCommitTimeout: 5000,
    };
    harness = new GraphCodeHarness(config, storage);
    await harness.initialize();
    // The canonical MCP tool-name set IS the live registry — not a hardcoded list.
    toolNames = Object.keys(bindToolsToHarness(harness));
  });

  afterAll(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('ships the se-*.md skills on disk (count derived from the dir, not hardcoded)', () => {
    // Source of truth = the shipped .claude/skills/ dir (cli.scaffold asserts the
    // scaffold copies exactly this set). No magic count to bump (CR-GC-205 Item 2).
    expect(skillFiles().length).toBeGreaterThan(0);
  });

  it('no skill references the retired HTTP API (localhost:3001 / GRAPH_API / /api/graph / /api/dashboard)', () => {
    const offenders: string[] = [];
    for (const f of skillFiles()) {
      const text = readFileSync(join(SKILLS_DIR, f), 'utf8');
      if (DEAD_API.test(text)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it('every skill references at least one tool from the live MCP registry', () => {
    expect(toolNames.length).toBeGreaterThan(0); // toolNames IS the live registry (no magic count)
    const missing: string[] = [];
    for (const f of skillFiles()) {
      const text = readFileSync(join(SKILLS_DIR, f), 'utf8');
      if (!toolNames.some((name) => text.includes(name))) missing.push(f);
    }
    expect(missing).toEqual([]);
  });
});
