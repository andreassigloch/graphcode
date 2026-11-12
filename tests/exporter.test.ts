/**
 * TEST-doc-export — Graph → JSON/Markdown re-exporter (CR-GC-113).
 *
 * Verifies the single SSOT sync path:
 *   1. ROUND-TRIP: import the committed SSOT JSON into a REAL disk Kuzu harness,
 *      pull the IN-MEMORY authoritative graph (harness.getGraph() — NOT a fresh
 *      Kuzu reload, which is lossy), exportGraphJson, assert BYTE-IDENTICAL to
 *      the committed file. Output is asserted in memory only — the repo SSOT is
 *      never written.
 *   2. DETERMINISM: exportGraphJson and exportMarkdown each produce byte-identical
 *      output across two calls.
 *   3. exportMarkdown emits the GENERATED header and is non-empty for every view.
 *
 * Real KuzuAdapter on a mkdtemp disk path — no mocks, never :memory:.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { Graph } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import {
  exportGraphJson,
  exportMarkdown,
  MARKDOWN_VIEWS,
  MarkdownViewSchema,
  VIEW_FILENAMES,
} from '../src/projections/exporter.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import { SRS_OUTLINE, SRS_EMPTY, srsSection } from '../src/projections/srs.js';

const REPO_ROOT = join(__dirname, '..');
const GRAPH_JSON = join(REPO_ROOT, 'docs/graph/graphcode.graph.json');

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

describe('exportGraphJson / exportMarkdown (TEST-doc-export)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let graph: Graph;
  let committedRaw: string;

  beforeAll(async () => {
    committedRaw = readFileSync(GRAPH_JSON, 'utf8');
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-export-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    // lockDir = temp store dir, not repoRoot/.graphcode (a live dev server owns that, CR-GC-218).
    harness = new GraphCodeHarness(makeConfig(REPO_ROOT), storage, undefined, { lockDir: tmp });
    await harness.initialize();
    // seedFromJson() loads the committed SSOT via importGraph and sets the
    // in-memory authoritative graph (full attribute fidelity). getGraph() returns
    // THAT working copy — not a lossy Kuzu reload.
    await harness.seedFromJson();
    graph = harness.getGraph();
  });

  afterAll(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('ROUND-TRIP: exportGraphJson of the in-memory SSOT is byte-identical to the committed file', () => {
    const exported = exportGraphJson(graph);
    // Byte-identical: exporter is the exact inverse of importGraph and the
    // committed file is already in canonical `JSON.stringify(_, null, 2) + "\n"` form.
    // Der CR-GC-300 graphVersion-Stamp ist Export-Metadatum, kein Modell-Inhalt —
    // strippen + kanonisch re-serialisieren, dann muss Byte-Identitaet gelten.
    const committedCanonical = ((): string => {
      const parsed = JSON.parse(committedRaw) as Record<string, unknown>;
      delete parsed.graphVersion;
      return JSON.stringify(parsed, null, 2) + '\n';
    })();
    expect(exported).toBe(committedCanonical);
    expect(Buffer.from(exported).equals(Buffer.from(committedCanonical))).toBe(true);
  });

  it('ROUND-TRIP preserves lossy-in-Kuzu attributes (status/kinds/method/nested attributes)', () => {
    const exported = JSON.parse(exportGraphJson(graph)) as {
      elements: Array<Record<string, unknown>>;
    };
    const byId = new Map(exported.elements.map((e) => [e.id as string, e]));
    // status — dropped on a raw Kuzu reload, present here.
    expect(byId.get('MOD-projections')?.status).toBeDefined();
    // kinds — REQ-only top-level attr.
    expect(byId.get('REQ-doc-export')?.kinds).toBeDefined();
    // method — TEST-only top-level attr.
    expect(byId.get('TEST-doc-export')?.method).toBeDefined();
    // operatingMode — FLATTENED to a top-level attribute (CR-GC-219): the old nested
    // `attributes.operatingMode` artifact is gone; the value is preserved one level up.
    const func = byId.get('FUNC-export-markdown') as { attributes?: unknown; operatingMode?: unknown };
    expect(func?.operatingMode).toBeTypeOf('string');
    expect(func?.attributes).toBeUndefined();
  });

  it('DETERMINISM: exportGraphJson is byte-identical across two calls', () => {
    expect(exportGraphJson(graph)).toBe(exportGraphJson(graph));
  });

  it('DETERMINISM: exportMarkdown is byte-identical across two calls (every view)', () => {
    for (const view of MARKDOWN_VIEWS) {
      expect(exportMarkdown(graph, view)).toBe(exportMarkdown(graph, view));
    }
  });

  it('exportMarkdown emits the GENERATED header and is non-empty for every view', () => {
    for (const view of MARKDOWN_VIEWS) {
      const md = exportMarkdown(graph, view);
      expect(md.length).toBeGreaterThan(0);
      expect(md).toContain('GENERATED by @sigloch/graphcode exportMarkdown');
      expect(md).toContain('DO NOT HAND-EDIT');
      expect(md).toContain('docs/graph/graphcode.graph.json');
      // No `()` or `|` inside any rendered Mermaid label (we emit no Mermaid, so
      // assert there is no mermaid fence at all — keeps the blank-diagram hazard out).
      expect(md).not.toContain('```mermaid');
    }
  });

  // -------------------------------------------------------------------------
  // CR-GC-236 — header follows the export/member name, no hardcoded 'graphcode'.
  // -------------------------------------------------------------------------

  it('CR-GC-236: exportMarkdown(name) puts the member name in title + SSOT path (every view)', () => {
    for (const view of MARKDOWN_VIEWS) {
      const md = exportMarkdown(graph, view, 'graph-view-edit');
      expect(md).toContain('# graph-view-edit — ');
      expect(md).toContain('Source of truth: docs/graph/graph-view-edit.graph.json');
      expect(md).toContain('GENERATED from `docs/graph/graph-view-edit.graph.json`');
      // The GENERATED header must not claim graphcode's SSOT (node descriptions
      // in the body may legitimately mention the file name).
      const header = md.split('\n').slice(0, 8).join('\n');
      expect(header).not.toContain('graphcode.graph.json');
    }
  });

  it('CR-GC-236: default name is graphcode (own export keeps its SSOT path)', () => {
    const md = exportMarkdown(graph, 'srs');
    expect(md).toContain('# graphcode — ');
    expect(md).toContain('docs/graph/graphcode.graph.json');
  });

  it('CR-GC-236: DETERMINISM — same graph + same name → identical bytes', () => {
    for (const view of MARKDOWN_VIEWS) {
      expect(exportMarkdown(graph, view, 'member-x')).toBe(exportMarkdown(graph, view, 'member-x'));
    }
  });

  it('the foundation views mirror FLOW-export-request (architecture/references)', () => {
    // CR-GC-305 dropped `spec`, CR-GC-761 `cr-list`; the rest are untouched — CR-GC-220 ADDS
    // to them, no parallel path.
    for (const v of ['architecture', 'references']) {
      expect([...MARKDOWN_VIEWS]).toContain(v);
    }
    // schema rejects unknown views — and the removed ones.
    expect(() => MarkdownViewSchema.parse('bogus')).toThrow();
    expect(() => MarkdownViewSchema.parse('cr-list')).toThrow();
  });

  it('exportMarkdown reflects the graph: changelog lists every CR node, references lists traces', () => {
    // CR-GC-761: `changelog` replaces `cr-list` — it must carry every CR node, not a sample.
    const changelog = exportMarkdown(graph, 'changelog');
    const crs = graph.nodes.filter((n) => n.type === 'CR');
    expect(crs.length).toBeGreaterThan(0);
    expect(crs.filter((n) => !changelog.includes(n.uid)).map((n) => n.uid)).toEqual([]);

    const refs = exportMarkdown(graph, 'references');
    // A known trace from the graph appears in the references view.
    const firstEdge = graph.edges[0];
    expect(refs).toContain(firstEdge.sourceId);
    expect(refs).toContain(firstEdge.targetId);
  });

  // -------------------------------------------------------------------------
  // CR-GC-220 — the 12 deterministic SE-artifact render views.
  // -------------------------------------------------------------------------

  const CR220_VIEWS = [
    'srs',
    'nfr',
    'rtm',
    'icd',
    'testconcept',
    'testmatrix',
    'intplan',
    'changelog',
    'fmea',
    'conops',
    'implplan',
  ] as const;

  it('CR-GC-220: schema accepts the 11 views of that CR (13 total after CR-GC-761)', () => {
    for (const v of CR220_VIEWS) expect(() => MarkdownViewSchema.parse(v)).not.toThrow();
    expect(MARKDOWN_VIEWS.length).toBe(13);
    // CR-GC-305: `spec` is gone and must be a HARD reject, not a silent fallback —
    // a consumer still passing it has to fail loudly, not receive some other view.
    expect([...MARKDOWN_VIEWS]).not.toContain('spec');
    expect(() => MarkdownViewSchema.parse('spec')).toThrow();
  });

  it('CR-GC-220: every new view renders non-empty with the GENERATED header', () => {
    for (const v of CR220_VIEWS) {
      const md = exportMarkdown(graph, v);
      expect(md.length).toBeGreaterThan(0);
      expect(md).toContain('GENERATED by @sigloch/graphcode exportMarkdown');
      expect(md).toContain('DO NOT HAND-EDIT');
      expect(md).not.toContain('```mermaid');
    }
  });

  it('CR-GC-220: every new view is byte-identical across two renders (determinism)', () => {
    for (const v of CR220_VIEWS) {
      const a = exportMarkdown(graph, v);
      const b = exportMarkdown(graph, v);
      expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    }
  });

  it('CR-GC-305: SRS is THE requirements view — the type-grouped dump is gone', () => {
    const srs = exportMarkdown(graph, 'srs');
    expect(srs).toContain('System Requirements Specification');
    expect(srs).toContain('#### 3.3.1  Functional requirements');
    // The former `spec` view grouped by element type (`## FUNC`, `## MOD`, …) under
    // the heading "Modell-Spezifikation". No remaining view may reintroduce that
    // shape — the second requirements document WAS the duplication this CR removed.
    expect(srs).not.toContain('## FUNC');
    for (const v of MARKDOWN_VIEWS) {
      expect(exportMarkdown(graph, v)).not.toContain('Modell-Spezifikation');
    }
  });

  // -------------------------------------------------------------------------
  // CR-GVE-172 — SRS as a full textual spec (aise text-view pattern).
  // -------------------------------------------------------------------------

  it('CR-GVE-172: SRS places each REQ under its satisfy element, repeats multi-satisfier occurrences', () => {
    const g: Graph = {
      nodes: [
        { uid: 'SYS-x', type: 'SYS', name: 'X', description: 'the system', attributes: {} },
        { uid: 'ACTOR-a', type: 'ACTOR', name: 'A', description: 'actor', attributes: {} },
        { uid: 'UC-u', type: 'UC', name: 'U', description: 'use case', attributes: {} },
        { uid: 'FCHAIN-c', type: 'FCHAIN', name: 'C', description: 'chain', attributes: {} },
        { uid: 'FUNC-first', type: 'FUNC', name: 'First', description: 'f1', attributes: {} },
        { uid: 'FUNC-second', type: 'FUNC', name: 'Second', description: 'f2', attributes: {} },
        { uid: 'FLOW-f', type: 'FLOW', name: 'F', description: 'flow', attributes: {} },
        { uid: 'SCHEMA-s', type: 'SCHEMA', name: 'S', description: 'schema', attributes: {} },
        { uid: 'MOD-m', type: 'MOD', name: 'M', description: 'module', attributes: {} },
        { uid: 'REQ-shared', type: 'REQ', name: 'shared', description: 'satisfied twice', attributes: {} },
        { uid: 'REQ-orphan', type: 'REQ', name: 'orphan', description: 'no satisfier', attributes: {} },
        { uid: 'TEST-t', type: 'TEST', name: 'T', description: 'test', attributes: {} },
      ],
      edges: [
        { sourceId: 'SYS-x', targetId: 'UC-u', edgeType: 'compose', attributes: {} },
        { sourceId: 'UC-u', targetId: 'FCHAIN-c', edgeType: 'compose', attributes: {} },
        { sourceId: 'FCHAIN-c', targetId: 'FUNC-first', edgeType: 'compose', attributes: {} },
        { sourceId: 'FCHAIN-c', targetId: 'FUNC-second', edgeType: 'compose', attributes: {} },
        // io chain runs Second-less uid AFTER First: FUNC-first → FLOW-f → FUNC-second.
        { sourceId: 'FUNC-first', targetId: 'FLOW-f', edgeType: 'io', attributes: {} },
        { sourceId: 'FLOW-f', targetId: 'FUNC-second', edgeType: 'io', attributes: {} },
        { sourceId: 'ACTOR-a', targetId: 'UC-u', edgeType: 'io', attributes: {} },
        { sourceId: 'FLOW-f', targetId: 'SCHEMA-s', edgeType: 'relation', attributes: {} },
        { sourceId: 'FUNC-second', targetId: 'REQ-shared', edgeType: 'satisfy', attributes: {} },
        { sourceId: 'FCHAIN-c', targetId: 'REQ-shared', edgeType: 'satisfy', attributes: {} },
        { sourceId: 'MOD-m', targetId: 'REQ-shared', edgeType: 'satisfy', attributes: {} },
        { sourceId: 'FUNC-second', targetId: 'MOD-m', edgeType: 'allocate', attributes: {} },
        { sourceId: 'TEST-t', targetId: 'REQ-shared', edgeType: 'verify', attributes: {} },
      ],
    };
    const srs = exportMarkdown(g, 'srs', 'test');

    // Every ontology type with instances appears (SESSION/CR/MS excluded by design).
    for (const uid of ['SYS-x', 'ACTOR-a', 'UC-u', 'FCHAIN-c', 'FUNC-first', 'FUNC-second', 'FLOW-f', 'SCHEMA-s', 'MOD-m', 'REQ-shared', 'REQ-orphan', 'TEST-t']) {
      expect(srs).toContain(uid);
    }

    // io-topological order: FUNC-first HEADING precedes FUNC-second's (plain
    // indexOf would hit `FUNC-second` in REQ-shared's trace line first).
    expect(srs.indexOf('`FUNC-first` —')).toBeLessThan(srs.indexOf('`FUNC-second` —'));

    // Durchgezogene Dezimal-Nummerierung unter den Abschnitten der 29148-Gliederung
    // (CR-GC-909); REQ-Einträge (unterste Ebene) bleiben unnummeriert, h6 ist die Grenze.
    expect(srs).toContain('#### 2.1.1  `ACTOR-a`'); // StRS: Stakeholder
    expect(srs).toContain('##### 3.3.1.1  `UC-u`');
    expect(srs).toContain('###### 3.3.1.1.1  `FCHAIN-c`');
    expect(srs).toContain('###### 3.3.1.1.1.1  `FUNC-first`');
    expect(srs).toContain('###### 3.3.1.1.1.2  `FUNC-second`');
    expect(srs).toContain('###### 3.3.4.2.1  `SCHEMA-s`'); // System interfaces: Datenformate
    expect(srs).toContain('##### 3.3.7.1  `MOD-m`'); // Physical characteristics: der MOD-Baum
    expect(srs).toMatch(/#{3,6} `REQ-shared`/); // unnummeriert

    // REQ-shared (keine kinds = functional) appears under BOTH functional carriers (FCHAIN +
    // FUNC) with the cross-note; Physical characteristics carries it only as the MOD's
    // satisfy ▶ line, and the functional orphan lands under „Anforderungen ohne Funktion“.
    const first = srs.indexOf('`REQ-shared`');
    const second = srs.indexOf('`REQ-shared`', first + 1);
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
    expect(srs).toContain('auch unter');
    const arch = srs.slice(srs.indexOf('#### 3.3.7  '), srs.indexOf('#### 3.3.8  '));
    expect(arch).not.toMatch(/#{3,6} `REQ-/); // eine functional REQ ist hier kein Eintrag
    expect(arch).toContain('satisfy ▶ `REQ-shared`'); // aber als Trace-Zeile am MOD
    const rest = srs.indexOf('##### 3.3.1.2  Anforderungen ohne Funktion');
    expect(rest).toBeGreaterThan(-1);
    expect(srs.indexOf('`REQ-orphan`')).toBeGreaterThan(rest);
  });

  // -------------------------------------------------------------------------
  // CR-GC-909 — Gliederung nach ISO/IEC/IEEE 29148:2018 Kl. 9 (BRS, StRS, SyRS).
  // -------------------------------------------------------------------------

  it('CR-GC-909: jeder Abschnitt von SRS_OUTLINE ist eine Überschrift, in Normreihenfolge, leere mit dem Leersatz', () => {
    for (const g of [graph, { nodes: [], edges: [] } as Graph]) {
      const srs = exportMarkdown(g, 'srs', 'test');
      const nums = new Set(SRS_OUTLINE.map((s) => s.num));
      const found = srs
        .split('\n')
        .map((l) => /^(#{2,6}) (\d+(?:\.\d+)*)  ([^`].*)$/.exec(l))
        .filter((m): m is RegExpExecArray => m !== null && nums.has(m[2]!))
        .map((m) => ({ level: m[1]!.length, num: m[2]!, title: m[3]! }));
      expect(found.map((f) => `${f.num} ${f.title}`)).toEqual(SRS_OUTLINE.map((s) => `${s.num} ${s.title}`));
      for (const f of found) expect(f.level).toBe(f.num.split('.').length + 1);
      // Ein Abschnitt ohne Inhalt trägt den Leersatz, nie gar nichts.
      for (const num of ['3.2', '3.3.2', '3.3.5', '3.3.6', '3.3.8', '3.3.9', '3.3.10', '3.3.12', '3.3.13', '3.5.1', '3.5.2']) {
        const at = srs.indexOf(`${num}  ${SRS_OUTLINE.find((s) => s.num === num)!.title}`);
        expect(srs.slice(at).split('\n')[2], num).toBe(SRS_EMPTY);
      }
    }
  });

  it('CR-GC-909: kinds und satisfy-Träger legen den Abschnitt fest (Entscheidung 2026-11-12)', () => {
    expect(srsSection(['functional'], 'MOD')).toBe('3.3.1');
    expect(srsSection([], undefined)).toBe('3.3.1');
    expect(srsSection(['non-functional'], 'FCHAIN')).toBe('3.3.3');
    expect(srsSection(['non-functional'], 'FUNC')).toBe('3.3.3');
    expect(srsSection(['non-functional'], 'MOD')).toBe('3.3.7');
    expect(srsSection(['non-functional'], 'SYS')).toBe('3.3.11');
    expect(srsSection(['non-functional'], undefined)).toBe('3.3.11');

    const g: Graph = {
      nodes: [
        { uid: 'SYS-x', type: 'SYS', name: 'X', attributes: {} },
        { uid: 'FCHAIN-c', type: 'FCHAIN', name: 'C', attributes: {} },
        { uid: 'MOD-m', type: 'MOD', name: 'M', attributes: {} },
        { uid: 'REQ-zeit', type: 'REQ', name: 'Zeit', attributes: { kinds: ['non-functional'] } },
        { uid: 'REQ-gewicht', type: 'REQ', name: 'Gewicht', attributes: { kinds: ['non-functional'] } },
        { uid: 'REQ-regel', type: 'REQ', name: 'Regel', attributes: { kinds: ['non-functional'] } },
      ],
      edges: [
        { sourceId: 'FCHAIN-c', targetId: 'REQ-zeit', edgeType: 'satisfy', attributes: {} },
        { sourceId: 'MOD-m', targetId: 'REQ-gewicht', edgeType: 'satisfy', attributes: {} },
        { sourceId: 'SYS-x', targetId: 'REQ-regel', edgeType: 'satisfy', attributes: {} },
      ],
    };
    const srs = exportMarkdown(g, 'srs', 'test');
    const part = (a: string, b: string): string => srs.slice(srs.indexOf(`#### ${a}  `), srs.indexOf(`#### ${b}  `));
    expect(part('3.3.3', '3.3.4')).toMatch(/#{3,6} `REQ-zeit`/);
    expect(part('3.3.7', '3.3.8')).toMatch(/#{3,6} `REQ-gewicht`/);
    expect(part('3.3.11', '3.3.12')).toMatch(/#{3,6} `REQ-regel`/);
    expect(part('3.3.1', '3.3.2')).not.toMatch(/`REQ-/);
  });

  it('CR-GVE-172: io order wins over uid order within a FCHAIN', () => {
    // uid order would render FUNC-alpha first; the io chain runs beta → alpha.
    const g: Graph = {
      nodes: [
        { uid: 'SYS-x', type: 'SYS', name: 'X', attributes: {} },
        { uid: 'UC-u', type: 'UC', name: 'U', attributes: {} },
        { uid: 'FCHAIN-c', type: 'FCHAIN', name: 'C', attributes: {} },
        { uid: 'FUNC-alpha', type: 'FUNC', name: 'Alpha', attributes: {} },
        { uid: 'FUNC-beta', type: 'FUNC', name: 'Beta', attributes: {} },
        { uid: 'FLOW-f', type: 'FLOW', name: 'F', attributes: {} },
      ],
      edges: [
        { sourceId: 'UC-u', targetId: 'FCHAIN-c', edgeType: 'compose', attributes: {} },
        { sourceId: 'FCHAIN-c', targetId: 'FUNC-alpha', edgeType: 'compose', attributes: {} },
        { sourceId: 'FCHAIN-c', targetId: 'FUNC-beta', edgeType: 'compose', attributes: {} },
        { sourceId: 'FUNC-beta', targetId: 'FLOW-f', edgeType: 'io', attributes: {} },
        { sourceId: 'FLOW-f', targetId: 'FUNC-alpha', edgeType: 'io', attributes: {} },
      ],
    };
    const srs = exportMarkdown(g, 'srs', 'test');
    expect(srs.indexOf('`FUNC-beta`')).toBeLessThan(srs.indexOf('`FUNC-alpha`'));
  });

  it('CR-GC-220: NFR view only lists non-functional REQ', () => {
    const nfr = exportMarkdown(graph, 'nfr');
    const nonFunc = graph.nodes.filter(
      (n) => n.type === 'REQ' && Array.isArray(n.attributes['kinds']) &&
        (n.attributes['kinds'] as string[]).includes('non-functional'),
    );
    expect(nonFunc.length).toBeGreaterThan(0);
    expect(nfr).toContain(nonFunc[0].uid);
    // A purely functional REQ (kinds without non-functional) must NOT appear.
    const func = graph.nodes.find(
      (n) => n.type === 'REQ' && Array.isArray(n.attributes['kinds']) &&
        (n.attributes['kinds'] as string[]).includes('functional') &&
        !(n.attributes['kinds'] as string[]).includes('non-functional'),
    );
    if (func) expect(nfr).not.toContain(func.uid);
  });

  it('CR-GC-220/240: TestConcept shows System E2E as ✗ MISSING when 0 E2E-level tests exist (level from graph position)', () => {
    // A FUNC-satisfied REQ verified by a test, but no REQ composed by SYS at
    // all → the System row must be ✗, not blank. No testRef.level anywhere.
    const zeroE2e: Graph = {
      nodes: [
        { uid: 'SYS-x', type: 'SYS', name: 'X', attributes: {} },
        { uid: 'UC-x', type: 'UC', name: 'UC', attributes: {} },
        { uid: 'FUNC-x', type: 'FUNC', name: 'F', attributes: {} },
        { uid: 'REQ-func', type: 'REQ', name: 'r', attributes: {} },
        { uid: 'TEST-unit', type: 'TEST', name: 'unit', attributes: {} },
      ],
      edges: [
        { sourceId: 'FUNC-x', targetId: 'REQ-func', edgeType: 'satisfy', attributes: {} },
        { sourceId: 'TEST-unit', targetId: 'REQ-func', edgeType: 'verify', attributes: {} },
      ],
    };
    const md = exportMarkdown(zeroE2e, 'testconcept');
    expect(md).toContain('✗ MISSING');
    expect(md).toContain('no system requirement is verified');
    // The System row reports 0 tests of system requirements, loudly — named after the norm (CR-GC-762).
    expect(md).toMatch(/System \| SYS \(1\) \| system verification \(SYS\.5\) \| 0/);
    expect(md).not.toContain('E2E');

    // Adding a SYS-composed REQ verified by a test flips the row to ✓ — purely
    // via graph position (CR-GC-240), still no testRef.level anywhere.
    const withE2e: Graph = {
      nodes: [
        ...zeroE2e.nodes,
        { uid: 'REQ-sys', type: 'REQ', name: 'r2', attributes: {} },
        { uid: 'TEST-e2e', type: 'TEST', name: 'e2e', attributes: {} },
      ],
      edges: [
        ...zeroE2e.edges,
        { sourceId: 'SYS-x', targetId: 'REQ-sys', edgeType: 'compose', attributes: {} },
        { sourceId: 'TEST-e2e', targetId: 'REQ-sys', edgeType: 'verify', attributes: {} },
      ],
    };
    const md2 = exportMarkdown(withE2e, 'testconcept');
    expect(md2).not.toContain('✗ MISSING');
    expect(md2).toMatch(/System \| SYS \(1\) \| system verification \(SYS\.5\) \| 1 \| 1 \/ 1 system requirements \| ✓/);
  });

  it('CR-GC-240: full REQ coverage renders a clean pyramid with ZERO testRef.level attributes anywhere', () => {
    // 1 SYS, 2 UC, 1 FUNC — every REQ verified, no TEST carries testRef/level.
    // Before CR-GC-240 this degenerated to e2e=integration=unit=0 (attribute-based).
    const graph: Graph = {
      nodes: [
        { uid: 'SYS-p', type: 'SYS', name: 'sys', attributes: {} },
        { uid: 'UC-1', type: 'UC', name: 'uc1', attributes: {} },
        { uid: 'UC-2', type: 'UC', name: 'uc2', attributes: {} },
        { uid: 'FUNC-p', type: 'FUNC', name: 'func', attributes: {} },
        { uid: 'REQ-sys', type: 'REQ', name: 'sys req', attributes: {} },
        { uid: 'REQ-uc1', type: 'REQ', name: 'uc1 req', attributes: {} },
        { uid: 'REQ-uc2', type: 'REQ', name: 'uc2 req', attributes: {} },
        { uid: 'REQ-func', type: 'REQ', name: 'func req', attributes: {} },
        { uid: 'TEST-sys', type: 'TEST', name: 't-sys', attributes: {} },
        { uid: 'TEST-uc1', type: 'TEST', name: 't-uc1', attributes: {} },
        { uid: 'TEST-uc2', type: 'TEST', name: 't-uc2', attributes: {} },
        { uid: 'TEST-func', type: 'TEST', name: 't-func', attributes: {} },
      ],
      edges: [
        { sourceId: 'SYS-p', targetId: 'REQ-sys', edgeType: 'compose', attributes: {} },
        { sourceId: 'UC-1', targetId: 'REQ-uc1', edgeType: 'compose', attributes: {} },
        { sourceId: 'UC-2', targetId: 'REQ-uc2', edgeType: 'compose', attributes: {} },
        { sourceId: 'FUNC-p', targetId: 'REQ-func', edgeType: 'satisfy', attributes: {} },
        { sourceId: 'TEST-sys', targetId: 'REQ-sys', edgeType: 'verify', attributes: {} },
        { sourceId: 'TEST-uc1', targetId: 'REQ-uc1', edgeType: 'verify', attributes: {} },
        { sourceId: 'TEST-uc2', targetId: 'REQ-uc2', edgeType: 'verify', attributes: {} },
        { sourceId: 'TEST-func', targetId: 'REQ-func', edgeType: 'verify', attributes: {} },
      ],
    };
    const md = exportMarkdown(graph, 'testconcept');
    expect(md).not.toContain('✗ MISSING');
    expect(md).not.toContain('GAP');
    expect(md).not.toContain('UC without a verified requirement');
    expect(md).toMatch(/System \| SYS \(1\) \| system verification \(SYS\.5\) \| 1 \| 1 \/ 1 system requirements \| ✓/);
    expect(md).toMatch(/Use-case \| UC \(2\) \| requirements verification \(SWE\.6 · HWE\.4\) \| 2 \| 2 \/ 2 use cases \| ✓/);
    expect(md).toMatch(/Function \| FUNC \(1\) \| unit verification \(SWE\.4 · HWE\.3\) \| 1 \| 1 \/ 1 \| ✓/);
    // CR-GC-893: die UC-REQ sind verifiziert, aber nicht vom SYS getragen — kein UC ist durchgespielt.
    expect(md).toMatch(/Validation \| UC \(2\) \| validation \(VAL\.1\) \| 0 \| 0 \/ 2 use cases played through \| ⚠ 2 UC not played through/);
  });

  it('R-21: TestConcept flags a FUNC↔FUNC connection with no integration test as ✗ GAP', () => {
    // FUNC-a ─io→ FLOW-x ─io→ FUNC-b, both in FCHAIN-c, but the chain REQ is unverified.
    const uncovered: Graph = {
      nodes: [
        { uid: 'FUNC-a', type: 'FUNC', name: 'a', attributes: {} },
        { uid: 'FUNC-b', type: 'FUNC', name: 'b', attributes: {} },
        { uid: 'FLOW-x', type: 'FLOW', name: 'x', attributes: {} },
        { uid: 'FCHAIN-c', type: 'FCHAIN', name: 'c', attributes: {} },
        { uid: 'REQ-int', type: 'REQ', name: 'int req', attributes: {} },
      ],
      edges: [
        { sourceId: 'FUNC-a', targetId: 'FLOW-x', edgeType: 'io', attributes: {} },
        { sourceId: 'FLOW-x', targetId: 'FUNC-b', edgeType: 'io', attributes: {} },
        { sourceId: 'FCHAIN-c', targetId: 'FUNC-a', edgeType: 'compose', attributes: {} },
        { sourceId: 'FCHAIN-c', targetId: 'FUNC-b', edgeType: 'compose', attributes: {} },
        { sourceId: 'FCHAIN-c', targetId: 'REQ-int', edgeType: 'satisfy', attributes: {} },
      ],
    };
    const md = exportMarkdown(uncovered, 'testconcept');
    // FUNC↔FUNC integration sits in the integration band — ABOVE the unit row.
    expect(md.indexOf('| Integration | FUNC↔FUNC')).toBeLessThan(md.indexOf('| Function |'));
    expect(md.indexOf('| Integration | FUNC↔FUNC')).toBeGreaterThan(md.indexOf('| Use-case |'));
    expect(md).toContain('0/1 FUNC↔FUNC connections tested  ← GAP');
    expect(md).toMatch(/Integration \| FUNC↔FUNC \(1 conn\) \| integration verification \(SYS\.4 · SWE\.5\) \| 0 \| 0 \/ 1 connections \| ✗ 1 uncovered/);

    // Add the verifying integration test → connection covered, integration level counted.
    const covered: Graph = {
      nodes: [...uncovered.nodes, { uid: 'TEST-int', type: 'TEST', name: 't-int', attributes: {} }],
      edges: [...uncovered.edges, { sourceId: 'TEST-int', targetId: 'REQ-int', edgeType: 'verify', attributes: {} }],
    };
    const md2 = exportMarkdown(covered, 'testconcept');
    expect(md2).toContain('✓ 1/1 FUNC↔FUNC connections integration-tested');
    expect(md2).not.toContain('FUNC↔FUNC connections tested  ← GAP');
    // FCHAIN-satisfied REQ verified → the test counts as integration level.
    expect(md2).toMatch(/Integration \| FUNC↔FUNC \(1 conn\) \| integration verification \(SYS\.4 · SWE\.5\) \| 1 \| 1 \/ 1 connections \| ✓/);
  });

  it('CR-GC-762: Modul- und Schema-Tests haben eine Stufe — vorher zaehlte die Uebersicht sie nicht', () => {
    const g: Graph = {
      nodes: [
        { uid: 'SYS-x', type: 'SYS', name: 'x', attributes: {} },
        { uid: 'MOD-m', type: 'MOD', name: 'm', attributes: {} },
        { uid: 'REQ-nf', type: 'REQ', name: 'nf', attributes: {} },
        { uid: 'SCHEMA-s', type: 'SCHEMA', name: 's', attributes: {} },
        { uid: 'SCHEMA-ohne', type: 'SCHEMA', name: 'o', attributes: {} },
        { uid: 'TEST-m', type: 'TEST', name: 'tm', attributes: {} },
        { uid: 'TEST-s', type: 'TEST', name: 'ts', attributes: {} },
      ],
      edges: [
        { sourceId: 'MOD-m', targetId: 'REQ-nf', edgeType: 'satisfy', attributes: {} },
        { sourceId: 'TEST-m', targetId: 'REQ-nf', edgeType: 'verify', attributes: {} },
        { sourceId: 'TEST-s', targetId: 'SCHEMA-s', edgeType: 'verify', attributes: {} },
      ],
    };
    const md = exportMarkdown(g, 'testconcept');
    expect(md).toMatch(/Module \| MOD \(1\) \| component verification \(SWE\.5 · HWE\.3\) \| 1 \| 1 \/ 1 \| ✓/);
    expect(md).toMatch(/Interface \| SCHEMA \(2\) \| integration verification \(SYS\.4 · SWE\.5\) \| 1 \| 1 \/ 2 schemas \| ⚠ 1 without a test/);
    // der Schema-Test zaehlt NICHT in die Zeile der Funktion-zu-Funktion-Verbindungen
    expect(md).toMatch(/Integration \| FUNC↔FUNC \(0 conn\) \| integration verification \(SYS\.4 · SWE\.5\) \| 0 \|/);
  });

  it('CR-GC-893: Elternfunktion ohne eigene REQ zaehlt nicht in die Unit-Zeile', () => {
    const g: Graph = {
      nodes: [
        { uid: 'FUNC-eltern', type: 'FUNC', name: 'eltern', attributes: {} },
        { uid: 'FUNC-blatt', type: 'FUNC', name: 'blatt', attributes: {} },
        { uid: 'REQ-blatt', type: 'REQ', name: 'r', attributes: {} },
        { uid: 'TEST-blatt', type: 'TEST', name: 't', attributes: {} },
      ],
      edges: [
        { sourceId: 'FUNC-eltern', targetId: 'FUNC-blatt', edgeType: 'compose', attributes: {} },
        { sourceId: 'FUNC-blatt', targetId: 'REQ-blatt', edgeType: 'satisfy', attributes: {} },
        { sourceId: 'TEST-blatt', targetId: 'REQ-blatt', edgeType: 'verify', attributes: {} },
      ],
    };
    const md = exportMarkdown(g, 'testconcept');
    expect(md).toMatch(/Function \| FUNC \(1\) \| unit verification \(SWE\.4 · HWE\.3\) \| 1 \| 1 \/ 1 \| ✓/);
    expect(md).toContain('1 composite FUNC without an own REQ are not counted');
  });

  it('CR-GC-893: Validierung liegt am UC — seine REQ, vom SYS getragen und verifiziert', () => {
    const base: Graph = {
      nodes: [
        { uid: 'SYS-s', type: 'SYS', name: 's', attributes: {} },
        { uid: 'UC-a', type: 'UC', name: 'a', attributes: {} },
        { uid: 'UC-b', type: 'UC', name: 'b', attributes: {} },
        { uid: 'REQ-a-durch', type: 'REQ', name: 'a durchspielen', attributes: {} },
        { uid: 'REQ-b-teil', type: 'REQ', name: 'b nur verifiziert', attributes: {} },
        { uid: 'TEST-a', type: 'TEST', name: 'ta', attributes: {} },
        { uid: 'TEST-b', type: 'TEST', name: 'tb', attributes: {} },
      ],
      edges: [
        { sourceId: 'UC-a', targetId: 'REQ-a-durch', edgeType: 'compose', attributes: {} },
        { sourceId: 'SYS-s', targetId: 'REQ-a-durch', edgeType: 'satisfy', attributes: {} },
        { sourceId: 'TEST-a', targetId: 'REQ-a-durch', edgeType: 'verify', attributes: {} },
        // UC-b: verifizierte REQ, aber nicht vom ganzen System getragen → nicht validiert
        { sourceId: 'UC-b', targetId: 'REQ-b-teil', edgeType: 'compose', attributes: {} },
        { sourceId: 'TEST-b', targetId: 'REQ-b-teil', edgeType: 'verify', attributes: {} },
      ],
    };
    const md = exportMarkdown(base, 'testconcept');
    expect(md).not.toContain('no position in the model');
    expect(md).toMatch(/Validation \| UC \(2\) \| validation \(VAL\.1\) \| 1 \| 1 \/ 2 use cases played through \| ⚠ 1 UC not played through/);
    // die Validierung steht ueber der Systemzeile
    expect(md.indexOf('| Validation |')).toBeLessThan(md.indexOf('| System |'));
  });

  it('CR-GC-893: eine vom SYS getragene REQ (satisfy, RD-01) liegt auf Systemebene', () => {
    const g: Graph = {
      nodes: [
        { uid: 'SYS-s', type: 'SYS', name: 's', attributes: {} },
        { uid: 'REQ-sat', type: 'REQ', name: 'getragen', attributes: {} },
        { uid: 'TEST-sat', type: 'TEST', name: 't', attributes: {} },
      ],
      edges: [
        { sourceId: 'SYS-s', targetId: 'REQ-sat', edgeType: 'satisfy', attributes: {} },
        { sourceId: 'TEST-sat', targetId: 'REQ-sat', edgeType: 'verify', attributes: {} },
      ],
    };
    const md = exportMarkdown(g, 'testconcept');
    expect(md).toMatch(/System \| SYS \(1\) \| system verification \(SYS\.5\) \| 1 \| 1 \/ 1 system requirements \| ✓/);
    expect(md).toMatch(/\(no position\) \| TEST \| — \| 0 \|/);
  });

  it('CR-GC-893: Zeile ohne Lage zaehlt Tests, die nichts verifizieren — nicht das Attribut level', () => {
    const g: Graph = {
      nodes: [
        { uid: 'SYS-s', type: 'SYS', name: 's', attributes: {} },
        { uid: 'REQ-c', type: 'REQ', name: 'constraint', attributes: {} },
        { uid: 'TEST-mit-lage', type: 'TEST', name: 'm', attributes: { testRefs: [{ file: 'a.test.ts', level: 'conformance' }] } },
        { uid: 'TEST-ohne-lage', type: 'TEST', name: 'o', attributes: {} },
      ],
      edges: [
        { sourceId: 'SYS-s', targetId: 'REQ-c', edgeType: 'compose', attributes: {} },
        { sourceId: 'TEST-mit-lage', targetId: 'REQ-c', edgeType: 'verify', attributes: {} },
      ],
    };
    const md = exportMarkdown(g, 'testconcept');
    expect(md).not.toContain('codec round-trip');
    expect(md).not.toContain('(support)');
    expect(md).toMatch(/\(no position\) \| TEST \| — \| 1 \| verifies no REQ or SCHEMA \|/);
  });

  it('CR-GC-220: FMEA renders an explicit empty-state (never silently blank)', () => {
    // The live graph has no risk REQ yet — must say so, not be empty.
    const fmea = exportMarkdown(graph, 'fmea');
    expect(fmea).toContain('FMEA');
  });

  it('CR-GC-756: die Sicht Variantenvergleich gibt es nicht mehr — Entscheidungen stehen in der Aenderungsliste', () => {
    expect(MarkdownViewSchema.safeParse('trade').success).toBe(false);
    const g: Graph = {
      nodes: [
        { uid: 'CR-wahl', type: 'CR', name: 'Store-Wahl', description: '', attributes: { status: 'done' } },
        { uid: 'MOD-store', type: 'MOD', name: 'store', description: 'Der Store.', attributes: {} },
      ],
      edges: [{ sourceId: 'CR-wahl', targetId: 'MOD-store', edgeType: 'relation', attributes: {} }],
    };
    expect(exportMarkdown(g, 'changelog', 'x')).toContain('CR-wahl');
  });

  it('CR-GC-220: VIEW_FILENAMES covers every view exactly once', () => {
    for (const v of MARKDOWN_VIEWS) {
      expect(VIEW_FILENAMES[v]).toMatch(/\.md$/);
    }
    const files = MARKDOWN_VIEWS.map((v) => VIEW_FILENAMES[v]);
    expect(new Set(files).size).toBe(files.length); // no filename collision
  });
});

// ---------------------------------------------------------------------------
// CR-GC-304 — ConOps as an ISO/IEC/IEEE 29148 §5.2.4 OpsCon projection.
//
// Three defects this pins against:
//   1. The former filter `REQ.kinds ∋ "operational"` was UNSATISFIABLE — ReqKind
//      in @sigloch/contracts has 7 values and `operational` is not one of them, so
//      the gate can never accept such a REQ and the table was permanently empty.
//   2. The view advertised "actors/system/use-cases" and rendered no UC at all —
//      operational scenarios are the CORE of a ConOps and were entirely absent.
//   3. The change sections (29148 "nature of changes" / "summary of impacts") had
//      no rendering, although the meta-model has carried `CR relation → {UC, REQ,
//      FUNC, MOD}` since CR-155 precisely to bundle what a change produced.
//
// Operational scope is a GRAPH POSITION, not a `kind`: a non-functional REQ hanging
// off the SYS root (or off an ACTOR) constrains the system as a whole; one allocated
// to a single FUNC/MOD is design and stays out.
// ---------------------------------------------------------------------------

function cn(uid: string, type: string, name: string, description = '', attributes: Record<string, unknown> = {}): {
  uid: string;
  type: string;
  name: string;
  description: string;
  attributes: Record<string, unknown>;
} {
  return { uid, type, name, description, attributes };
}
function ce(sourceId: string, edgeType: string, targetId: string): {
  sourceId: string;
  targetId: string;
  edgeType: string;
  attributes: Record<string, unknown>;
} {
  return { sourceId, targetId, edgeType, attributes: {} };
}

/** A graph exercising every one of the six ConOps sections at once. */
function conOpsGraph(): Graph {
  return {
    nodes: [
      cn('SYS-shop', 'SYS', 'Shop', 'Ein Shop, der Ersatzteile verkauft.'),
      cn('ACTOR-kunde', 'ACTOR', 'Kunde', 'Bestellt Ersatzteile.'),
      cn('ACTOR-betreiber', 'ACTOR', 'Betreiber', 'Betreibt den Shop.'),
      // §2 operational: non-functional AND system-scoped
      cn('REQ-persistenz', 'REQ', 'Bestellungen ueberleben Neustart', 'Auf Disk, nie im Speicher.', {
        kinds: ['non-functional'],
        status: 'done',
      }),
      // §2 boundary case: non-functional but allocated to ONE module → design, not ConOps
      cn('REQ-modul-budget', 'REQ', 'Modul haelt 50MB', 'Speicherbudget des Moduls.', {
        kinds: ['non-functional'],
      }),
      // §2 boundary case: system-scoped but FUNCTIONAL → not an operational constraint
      cn('REQ-funktional', 'REQ', 'Bestellung anlegen', 'Das System legt eine Bestellung an.', {
        kinds: ['functional'],
      }),
      // §2 boundary case: system-scoped non-functional but an FMEA risk (role) → FMEA view, not ConOps
      cn('REQ-risiko', 'REQ', 'Datenverlust bei Stromausfall', 'Gefaehrdung.', {
        kinds: ['non-functional'],
        role: 'risk',
      }),
      cn('MOD-core', 'MOD', 'core', 'Kernmodul.'),
      // §4 operational scenarios
      cn('UC-bestellen', 'UC', 'Bestellen', 'Kunde bestellt ein Ersatzteil.'),
      cn('UC-verwalten', 'UC', 'Verwalten', 'Betreiber pflegt den Katalog.'),
      cn('FCHAIN-bestellablauf', 'FCHAIN', 'Bestellablauf', 'Von Auswahl bis Bestaetigung.'),
      cn('FUNC-pruefen', 'FUNC', 'pruefen()', 'Prueft die Bestellung.'),
      cn('FUNC-buchen', 'FUNC', 'buchen()', 'Bucht die Bestellung.'),
      // §6 change sections
      cn('CR-1', 'CR', 'Persistenz nachruesten', 'Store auf Disk.', { status: 'done' }),
      cn('CR-2', 'CR', 'Nur Planung', 'Reine Milestone-Zuordnung.', { status: 'open' }),
      cn('CR-3', 'CR', 'Ohne Bezug', 'Noch nichts zugeordnet.', { status: 'open' }),
      cn('MS-1', 'MS', 'Erster Meilenstein', 'MS.'),
    ],
    edges: [
      ce('SYS-shop', 'compose', 'REQ-persistenz'),
      ce('SYS-shop', 'compose', 'REQ-funktional'),
      ce('SYS-shop', 'compose', 'REQ-risiko'),
      ce('MOD-core', 'satisfy', 'REQ-modul-budget'),
      ce('SYS-shop', 'compose', 'UC-bestellen'),
      ce('SYS-shop', 'compose', 'UC-verwalten'),
      ce('UC-bestellen', 'compose', 'FCHAIN-bestellablauf'),
      ce('FCHAIN-bestellablauf', 'compose', 'FUNC-pruefen'),
      ce('FCHAIN-bestellablauf', 'compose', 'FUNC-buchen'),
      // UC-verwalten has NO FCHAIN on purpose — must be called out, not dropped.
      ce('CR-1', 'relation', 'REQ-persistenz'),
      ce('CR-1', 'relation', 'FUNC-pruefen'),
      ce('CR-2', 'relation', 'MS-1'), // planning only → not an impact
    ],
  };
}

describe('CR-GC-304: ConOps renders the 29148 OpsCon sections from existing nodes', () => {
  const md = (): string => exportMarkdown(conOpsGraph(), 'conops', 'shop');
  /** Nur Abschnitt 2 — REQ-persistenz steht auch in §6 (CR-Wirkung), ein Test ueber die ganze Sicht saehe es immer. */
  const abschnitt2 = (): string => md().split('## 2 ')[1]!.split('\n## ')[0]!;

  it('§2 lists a system-scoped non-functional REQ as an operational constraint', () => {
    expect(abschnitt2()).toContain('REQ-persistenz');
  });

  it('§2 excludes a REQ allocated to a single MOD — design, not ConOps', () => {
    expect(md()).not.toContain('REQ-modul-budget');
  });

  it('§2 excludes a system-scoped FUNCTIONAL REQ', () => {
    expect(md()).not.toContain('REQ-funktional');
  });

  it('§2 excludes an FMEA REQ (role risk/mitigation) — it belongs to the FMEA view (CR-SM-365)', () => {
    expect(abschnitt2()).not.toContain('REQ-risiko');
    expect(abschnitt2(), 'die Pruefung sieht den Abschnitt wirklich').toContain('REQ-persistenz');
  });

  it('§3 characterises each user class, it does not merely name it (CR-GC-455)', () => {
    const out = md();
    // ISO 29148 §5.2.4 wants the class described. The old render printed name + UC list
    // only, so everything distinguishing one class from another lived in the node and
    // reached no reader. That became load-bearing when three human personas were merged
    // into one ACTOR: their difference is now IN the description or nowhere.
    expect(out).toContain('Bestellt Ersatzteile.');
    expect(out).toContain('Betreibt den Shop.');
    // and it must stay attached to its own actor, not float somewhere in the document
    expect(out).toMatch(/ACTOR-kunde[\s\S]{0,400}?Bestellt Ersatzteile\./);
  });

  it('§4 renders operational scenarios: UC → FCHAIN → its function sequence', () => {
    const out = md();
    expect(out).toContain('UC-bestellen');
    expect(out).toContain('FCHAIN-bestellablauf');
    expect(out).toContain('FUNC-pruefen');
    expect(out).toContain('FUNC-buchen');
  });

  it('§4 calls out a UC without any FCHAIN instead of silently dropping it', () => {
    const out = md();
    expect(out).toContain('UC-verwalten');
    expect(out).toMatch(/UC-verwalten[\s\S]{0,300}?kein Betriebsablauf/);
  });

  it('§5 states the Modes-of-Operation gap explicitly (no MODE element type)', () => {
    expect(md()).toMatch(/Modes of Operation|Betriebsmodi/);
  });

  it('§6 bundles a CR with everything it touched, across element types', () => {
    const out = md();
    expect(out).toMatch(/CR-1[\s\S]{0,400}?REQ-persistenz/);
    expect(out).toMatch(/CR-1[\s\S]{0,400}?FUNC-pruefen/);
  });

  it('§6 skips a CR that only carries a milestone relation — planning is not impact', () => {
    // CR relation → MS is the plan axis (rendered by the changelog view), not a
    // change to the operational concept.
    expect(md()).not.toContain('CR-2');
  });

  it('§6 skips a CR with no relation edges at all', () => {
    expect(md()).not.toContain('CR-3');
  });

  it('renders an explicit empty-state per section on a bare graph, never a blank table', () => {
    const bare = exportMarkdown({ nodes: [cn('SYS-x', 'SYS', 'x', 'Nur die Wurzel.')], edges: [] }, 'conops', 'x');
    // No operational REQ, no actor, no UC, no CR — each must SAY so.
    expect(bare).toMatch(/—/);
    expect(bare.length).toBeGreaterThan(200);
    // And it must not claim the old, unsatisfiable filter any more.
    expect(bare).not.toContain('kind=operational');
  });

  it('stays deterministic — two renders are byte-identical', () => {
    expect(md()).toBe(md());
  });
});

// ---------------------------------------------------------------------------
// CR-GC-873 — die Rolle eines Akteurs je Kette kommt aus `chainRoles` (@sigloch/contracts/se,
// CR-SM-420), nicht aus der blossen Beruehrung. Bis hierher zaehlte jeder Akteur, der eine
// Funktion der Kette beruehrt, in BEIDEN Richtungen als Ausloeser: die Freigeberin, die mitten in
// der Kette einen Vorschlag sieht und freigibt, und der Leser, der nur das Ergebnis bekommt, standen
// unter „Ausgeloest von" (Beleg immo-infra v58).
//
// Kette: Auftraggeber -auftrag-> entwerfen -vorschlag(sync)-> Freigeberin -freigabe-> veroeffentlichen
//        -ergebnis-> Leser; entwerfen -entwurf-> veroeffentlichen.
// ---------------------------------------------------------------------------

function freigabeGraph(): Graph {
  const flow = (uid: string, sync: 'sync' | 'async') => cn(uid, 'FLOW', uid.slice(5), '', { sync });
  return {
    nodes: [
      cn('SYS-blog', 'SYS', 'Blog', 'Veroeffentlicht Beitraege nach Freigabe.'),
      cn('ACTOR-auftraggeber', 'ACTOR', 'Auftraggeber', 'Bestellt einen Beitrag.'),
      cn('ACTOR-freigeberin', 'ACTOR', 'Freigeberin', 'Gibt einen Vorschlag frei.'),
      cn('ACTOR-leser', 'ACTOR', 'Leser', 'Liest den Beitrag.'),
      cn('UC-beitrag', 'UC', 'Beitrag veroeffentlichen', 'Ein Beitrag geht nach Freigabe online.'),
      cn('FCHAIN-beitrag', 'FCHAIN', 'Beitrag', 'Vom Auftrag bis zum Leser.'),
      cn('FUNC-entwerfen', 'FUNC', 'entwerfen()', 'Entwirft den Beitrag.'),
      cn('FUNC-veroeffentlichen', 'FUNC', 'veroeffentlichen()', 'Stellt den Beitrag online.'),
      flow('FLOW-auftrag', 'async'),
      flow('FLOW-vorschlag', 'sync'),
      flow('FLOW-freigabe', 'async'),
      flow('FLOW-entwurf', 'async'),
      flow('FLOW-ergebnis', 'async'),
    ],
    edges: [
      ce('SYS-blog', 'compose', 'UC-beitrag'),
      ce('UC-beitrag', 'compose', 'FCHAIN-beitrag'),
      ce('FCHAIN-beitrag', 'compose', 'FUNC-entwerfen'),
      ce('FCHAIN-beitrag', 'compose', 'FUNC-veroeffentlichen'),
      ce('ACTOR-auftraggeber', 'io', 'FLOW-auftrag'),
      ce('FLOW-auftrag', 'io', 'FUNC-entwerfen'),
      ce('FUNC-entwerfen', 'io', 'FLOW-vorschlag'),
      ce('FLOW-vorschlag', 'io', 'ACTOR-freigeberin'),
      ce('ACTOR-freigeberin', 'io', 'FLOW-freigabe'),
      ce('FLOW-freigabe', 'io', 'FUNC-veroeffentlichen'),
      ce('FUNC-entwerfen', 'io', 'FLOW-entwurf'),
      ce('FLOW-entwurf', 'io', 'FUNC-veroeffentlichen'),
      ce('FUNC-veroeffentlichen', 'io', 'FLOW-ergebnis'),
      ce('FLOW-ergebnis', 'io', 'ACTOR-leser'),
    ],
  };
}

describe('CR-GC-873: ConOps nennt die Rolle des Akteurs je Kette (chainRoles)', () => {
  const md = (): string => exportMarkdown(freigabeGraph(), 'conops', 'blog');
  const abschnitt = (nr: number): string => md().split(`## ${nr} `)[1]!.split('\n## ')[0]!;
  const zeile = (text: string, start: string): string => text.split('\n').find((l) => l.startsWith(start)) ?? '';
  const akteur = (uid: string): string => abschnitt(3).split('\n').find((l) => l.includes(`(\`${uid}\`)`)) ?? '';

  it('§4 „Ausgeloest von" nennt nur den Ausloeser, nicht die Freigeberin in der Mitte und nicht den Leser', () => {
    expect(zeile(abschnitt(4), 'Ausgeloest von:')).toBe('Ausgeloest von: `ACTOR-auftraggeber`');
  });

  it('§4 „Beteiligt" nennt den Akteur in der Mitte', () => {
    expect(zeile(abschnitt(4), 'Beteiligt:')).toBe('Beteiligt: `ACTOR-freigeberin`');
  });

  it('§4 „Empfaenger" nennt die Senke, ohne den Akteur in der Mitte ein zweites Mal', () => {
    expect(zeile(abschnitt(4), 'Empfaenger:')).toBe('Empfaenger: `ACTOR-leser`');
  });

  it('§3 „triggert" steht nur beim Ausloeser; die anderen tragen ihre Rolle', () => {
    expect(akteur('ACTOR-auftraggeber')).toContain('triggert `UC-beitrag`');
    expect(akteur('ACTOR-freigeberin')).not.toContain('triggert');
    expect(akteur('ACTOR-freigeberin')).toContain('beteiligt an `UC-beitrag`');
    expect(akteur('ACTOR-leser')).not.toContain('triggert');
    expect(akteur('ACTOR-leser')).toContain('empfaengt aus `UC-beitrag`');
  });

  it('ein Akteur ohne Fluss in eine Kette bleibt ohne UC-Kopplung', () => {
    expect(exportMarkdown(conOpsGraph(), 'conops', 'shop')).toMatch(/ACTOR-kunde`\) — keine UC-Kopplung im Graph/);
  });
});
