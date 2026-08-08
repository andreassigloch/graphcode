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
import { TraceType } from '@sigloch/contracts/se';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const COMMANDS_DIR = join(__dirname, '..', '.claude', 'commands');
const DEAD_API = /localhost:3001|GRAPH_API|\/api\/graph|\/api\/dashboard/;

// CR-GC-277: die Skills liegen als Commands-Baum (se/…, se-view/…, se-*.md).
function skillFiles(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(COMMANDS_DIR, { withFileTypes: true })) {
    if (!entry.name.startsWith('se')) continue;
    if (entry.isFile() && entry.name.endsWith('.md')) out.push(entry.name);
    if (entry.isDirectory()) {
      for (const f of readdirSync(join(COMMANDS_DIR, entry.name))) {
        if (f.endsWith('.md')) out.push(join(entry.name, f));
      }
    }
  }
  return out;
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

  it('ships the SE skills on disk (count derived from the dir, not hardcoded)', () => {
    // Source of truth = the shipped .claude/commands/ tree (cli.scaffold asserts the
    // scaffold copies exactly this set). No magic count to bump (CR-GC-205 Item 2).
    expect(skillFiles().length).toBeGreaterThan(0);
  });

  it('no skill references the retired HTTP API (localhost:3001 / GRAPH_API / /api/graph / /api/dashboard)', () => {
    const offenders: string[] = [];
    for (const f of skillFiles()) {
      const text = readFileSync(join(COMMANDS_DIR, f), 'utf8');
      if (DEAD_API.test(text)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it('every skill references at least one tool from the live MCP registry', () => {
    expect(toolNames.length).toBeGreaterThan(0); // toolNames IS the live registry (no magic count)
    const missing: string[] = [];
    for (const f of skillFiles()) {
      const text = readFileSync(join(COMMANDS_DIR, f), 'utf8');
      if (!toolNames.some((name) => text.includes(name))) missing.push(f);
    }
    expect(missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// CR-GC-308 follow-up — the skills' VOCABULARY, not just their tool names.
//
// The tool-name check above could not have caught the CR-GC-308 defect: `se-fmea`
// named the right tools and then told the model to write `S`/`O`/`D`, attributes no
// rule reads and no view renders. The instruction drifted from contracts for a year
// without a single red test, because nothing compared the two.
//
// So: every attribute key and every edge type a skill INSTRUCTS must be one the
// ontology or the rules actually declare. Both sets are DERIVED — from
// `@sigloch/contracts/se` sources and from `TraceType` — so a contracts bump moves
// them automatically and this test can never become a stale second list.
// ---------------------------------------------------------------------------

/** Attribute keys the contracts rules actually read, scraped from their sources. */
function ruleReadAttributeKeys(): Set<string> {
  const dir = join(__dirname, '..', 'node_modules', '@sigloch', 'contracts', 'dist', 'se');
  const keys = new Set<string>();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(join(dir, f), 'utf8');
    for (const m of src.matchAll(/attributes\s*\??\.?\[\s*['"]([A-Za-z_]\w*)['"]\s*\]/g)) keys.add(m[1]);
    for (const m of src.matchAll(/attributes\s*\?\.\s*([A-Za-z_]\w*)/g)) keys.add(m[1]);
    for (const m of src.matchAll(/\ba\s*\[\s*['"]([A-Za-z_]\w*)['"]\s*\]/g)) keys.add(m[1]);
  }
  return keys;
}

/**
 * Typed OntologyElement columns + the one declared EDGE attribute.
 *
 * `kinds`/`asil`/`method` are top-level fields of `OntologyElement` (rules read them
 * as `e.kinds`, not through `attributes`), and `label` is declared on
 * `MS -relation-> MS[depends-on]` in `TRACE_PATTERNS`. graphcode stores all of them
 * in the attribute bag, so a skill legitimately writes them under `attributes.`.
 */
const DECLARED_NON_BAG_KEYS = new Set(['kinds', 'asil', 'method', 'label']);

/**
 * Free-form documentation keys — no rule reads them, and that is intentional.
 *
 * This list must stay SHORT and each entry must have a reason, otherwise it becomes
 * the rubber stamp that lets the next `S`/`O`/`D` through. If a key here ever starts
 * carrying meaning a rule or a view depends on, it belongs in contracts instead.
 */
const FREE_FORM_KEYS = new Set([
  'rationale', // prose "why", carried for humans; nothing branches on it
]);

describe('CR-GC-308: skills instruct only vocabulary the ontology declares', () => {
  const instructedAttributeKeys = (): Map<string, string[]> => {
    const found = new Map<string, string[]>();
    for (const f of skillFiles()) {
      const text = readFileSync(join(COMMANDS_DIR, f), 'utf8');
      for (const m of text.matchAll(/attributes\.([A-Za-z_]\w*)/g)) {
        found.set(m[1], [...(found.get(m[1]) ?? []), f]);
      }
    }
    return found;
  };

  it('every attributes.<key> a skill instructs is rule-read, ontology-declared, or explicitly free-form', () => {
    const allowed = new Set([...ruleReadAttributeKeys(), ...DECLARED_NON_BAG_KEYS, ...FREE_FORM_KEYS]);
    // Sanity: the scrape must actually have found something, or this test is vacuous
    // and would wave everything through.
    expect(ruleReadAttributeKeys().size).toBeGreaterThan(5);

    const offenders: string[] = [];
    for (const [key, files] of instructedAttributeKeys()) {
      if (!allowed.has(key)) offenders.push(`attributes.${key} (in ${files.join(', ')})`);
    }
    expect(offenders, 'a skill instructs an attribute nothing reads').toEqual([]);
  });

  it('catches the CR-GC-308 defect shape — an invented key is NOT in the allowed set', () => {
    // The guard is only worth having if it would have caught the original. `S` was
    // what se-fmea told the model to write; no rule has ever read it.
    const allowed = new Set([...ruleReadAttributeKeys(), ...DECLARED_NON_BAG_KEYS, ...FREE_FORM_KEYS]);
    for (const invented of ['S', 'O', 'D', 'role', 'actionPriority']) {
      expect(allowed.has(invented), `${invented} must not be allowed`).toBe(false);
    }
    // …while the replacements the skills now use ARE allowed.
    for (const real of ['severity', 'occurrence', 'detection', 'label', 'kinds']) {
      expect(allowed.has(real), `${real} must be allowed`).toBe(true);
    }
  });

  it('every edgeType a skill instructs is a declared TraceType', () => {
    const declared = new Set(TraceType.options as readonly string[]);
    const offenders: string[] = [];
    for (const f of skillFiles()) {
      const text = readFileSync(join(COMMANDS_DIR, f), 'utf8');
      for (const m of text.matchAll(/"edgeType"\s*:\s*"([a-zA-Z_]\w*)"/g)) {
        if (!declared.has(m[1])) offenders.push(`${m[1]} (in ${f})`);
      }
    }
    expect(offenders, 'a skill instructs an undeclared edge type').toEqual([]);
  });
});
