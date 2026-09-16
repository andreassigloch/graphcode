/**
 * TEST-readiness-steer (CR-GC-537, aus ITEM-2026-059) — der Host EXPORTIERT den
 * Steuerungsraum, statt ihn nur indirekt sichtbar zu machen.
 *
 * Readiness misst ABDECKUNG ("wie viele Stellen sind erledigt"), der Steuer-Score
 * AUSPRÄGUNG ("wie schlimm ist die schlimmste offene"). Beide lesen denselben Regelstrom.
 * Bis hierher waren die Zahlen nur als `verdict.steer.improvement` je Suggestion zu sehen —
 * das GVE-Dashboard (ITEM-2026-018 Punkt 1) hätte `steerScore` nachbauen müssen, und eine
 * zweite Rechnung ist eine zweite Wahrheit.
 *
 * Der Kern dieses Tests ist deshalb NICHT, dass das Feld da ist, sondern dass es aus
 * DERSELBEN Rechnung kommt wie das Verdict am Gate (Fall 3). Ein Feld, das dieselbe Zahl
 * auf einem zweiten Weg herstellt, wäre genau der Defekt, den der CR verhindern soll.
 *
 * Echtes Disk-Kuzu, echte Repo-Wurzel, echte SSOT. Keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { SteerSpace } from '@sigloch/contracts/se';
import { STEER_RULES } from '@sigloch/se-engine';
import { KuzuAdapter } from './helpers/store.js';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { openMeasured, type Measured } from '../src/surface/measured.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';

const REPO_ROOT = join(__dirname, '..');

type SteerSpaceOut = {
  worst: number;
  worstAt: { ruleId: string; elementId: string } | null;
  mean: number;
  score: number;
  measured: number;
  terms: Array<{ ruleId: string; elementId: string; value: number; threshold: number; overshoot: number }>;
};

describe('TEST-readiness-steer: graph_readiness liefert den Steuerungsraum (CR-GC-537)', () => {
  let measured: Measured;
  let tools: MCPToolRegistry;
  let steer: SteerSpaceOut;

  beforeAll(async () => {
    measured = await openMeasured({
      graph: join(REPO_ROOT, 'docs', 'graph', 'graphcode.graph.json'),
      repoRoot: REPO_ROOT,
      systemId: 'graphcode',
      workspaceId: 'test-ws',
    });
    tools = bindToolsToHarness(measured.harness);
    steer = ((await tools.graph_readiness.handler({ detail: false })) as { steer: SteerSpaceOut }).steer;
  }, 300000);

  afterAll(async () => {
    await measured.close();
  });

  it('(a) erfüllt den Vertrag aus contracts — Stufe 1 und Stufe 2 passen zusammen', () => {
    const parsed = SteerSpace.safeParse(steer);
    expect(parsed.success, JSON.stringify(parsed.error?.issues ?? [])).toBe(true);
  });

  it('(b) trägt die fünf Score-Felder UND einen Term je gemessener Blackbox', () => {
    for (const feld of ['worst', 'worstAt', 'mean', 'score', 'measured', 'terms'] as const) {
      expect(feld in steer, `${feld} fehlt im Steuerungsraum`).toBe(true);
    }
    expect(steer.measured).toBe(steer.terms.length);
  });

  it('(c) jeder Term stammt aus STEER_RULES — die geschlossene Liste, nicht "was zufällig eine Zahl trägt"', () => {
    for (const t of steer.terms) {
      expect(STEER_RULES as readonly string[]).toContain(t.ruleId);
    }
  });

  it('(d) die Normierung ist die der Regelschwelle: overshoot = max(0, (value − threshold)/threshold)', () => {
    for (const t of steer.terms) {
      expect(t.threshold).toBeGreaterThan(0);
      expect(t.overshoot).toBeCloseTo(Math.max(0, (t.value - t.threshold) / t.threshold), 12);
    }
    // `worst` ist das Maximum über die Terme (Chebyshev), nicht ihre Summe.
    expect(steer.worst).toBe(steer.terms.length > 0 ? Math.max(...steer.terms.map((t) => t.overshoot)) : 0);
    if (steer.worstAt !== null) {
      const schlimmster = steer.terms.find((t) => t.overshoot === steer.worst);
      expect(steer.worstAt).toEqual({ ruleId: schlimmster?.ruleId, elementId: schlimmster?.elementId });
    }
  });

  // AK2 — DER Fall. Dieselbe se-engine-Rechnung wie `verdict.steer.improvement`, kein
  // zweiter Rechenweg. `before` ist der Score des JETZIGEN Graphen, also genau das, was
  // der Bericht meldet; liefe der Bericht über eine eigene Normierung oder einen anderen
  // Regelkatalog (Gate-Delta statt Full), gingen die beiden Zahlen auseinander.
  it('(e) die Zahl ist DIESELBE wie im Gate-Verdict — kein zweiter Rechenweg', async () => {
    const verdict = (await tools.graph_mutate.handler({
      formatE: '## Edges\n+ TEST-roundtrip -verify-> REQ-roundtrip-conformance\n',
      dryRun: true,
      consumerId: 't',
    })) as { steerAdvisory?: { before: number; worstAt: unknown } };

    expect(verdict.steerAdvisory, 'das dryRun-Verdict trägt kein steerAdvisory').toBeDefined();
    expect(verdict.steerAdvisory!.before).toBe(steer.score);
  }, 300000);
});

// AK1 — „ohne Daten keine stille Null": `measured` ist eine ZAHL. Score 0 bei measured 0
// heisst "nichts gemessen", Score 0 bei measured > 0 heisst "jede Blackbox im Budget" —
// ohne das Feld sähen beide Lagen gleich aus, und ein Dashboard meldete Ruhe statt Blindheit.
describe('TEST-readiness-steer: ohne messbare Blackbox ist measured 0, nicht stumm', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'steer-leer-'));
    harness = new GraphCodeHarness(
      { repoRoot: tmp, scope: { workspaceId: 'w', systemId: 's' }, consumerType: 'system', preCommitTimeout: 5000 },
      new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') }),
      undefined,
      { lockDir: tmp },
    );
    await harness.initialize();
    await harness.importGraph({
      elements: [{ id: 'SYS-leer', type: 'SYS', name: 'Leer', description: 'Ein System ohne Module.' }],
      traces: [],
    });
    tools = bindToolsToHarness(harness);
  }, 300000);

  afterAll(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('measured 0, terms leer, score 0 — und die drei sagen zusammen "nicht gemessen"', async () => {
    const { steer } = (await tools.graph_readiness.handler({ detail: false })) as { steer: SteerSpaceOut };
    expect(steer.measured).toBe(0);
    expect(steer.terms).toEqual([]);
    expect(steer.worstAt).toBeNull();
    expect(steer.score).toBe(0);
  }, 300000);
});
