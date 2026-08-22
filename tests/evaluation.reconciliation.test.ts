/**
 * TEST-evaluation-reconciliation (CR-GC-398) — die drei Lese-Flächen sind
 * PROJEKTIONEN EINER Liste, nicht drei Erhebungen.
 *
 * Vorher lieferte dieselbe Frage an denselben Graphen zwei Summen: 128 aus
 * `rules_get_violations`, 137 aus `graph_readiness.violationsByRule`, Differenz
 * exakt die 9 Konformanz-Findings RC-04/RC-05, weil nur die Readiness den
 * Dateisystem-Pfad lief. Ohne Zwang driftet das zurück — deshalb hält dieser
 * Test die Summen zusammen, statt die Regel als Prosa zu notieren.
 *
 * Der Test läuft gegen das ECHTE Repo als repoRoot (sonst ist die
 * Konformanz-Quelle leer und die Versöhnung trivial) und gegen einen realen
 * Disk-Kuzu-Store, nie :memory:.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import { evaluateAll } from '../src/evaluation.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const REPO_ROOT = process.cwd();

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'reconcile-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

const sum = (byRule: Record<string, number>): number =>
  Object.values(byRule).reduce((a, b) => a + b, 0);

describe('TEST-evaluation-reconciliation: eine Auswertungsfläche (CR-GC-398)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: ReturnType<typeof bindToolsToHarness>;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-reconcile-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    // repoRoot = das echte Repo (nur dann ist die Konformanz-Quelle wirklich
    // befragbar), Store + Lock aber im tmp-Verzeichnis — sonst kollidiert der Test
    // mit dem laufenden Owner des Repo-Stores (O2, CR-GC-218).
    harness = new GraphCodeHarness(makeConfig(REPO_ROOT), storage, undefined, {
      lockDir: join(tmp, '.graphcode'),
    });
    await harness.initialize();
    await harness.importGraph(
      JSON.parse(readFileSync(join(REPO_ROOT, 'docs/graph/graphcode.graph.json'), 'utf8')),
    );
    tools = bindToolsToHarness(harness);
  }, 120_000);

  afterAll(async () => {
    await harness?.close();
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it('die Konformanz-Quelle ist hier wirklich aktiv — sonst prüft der Test nichts', async () => {
    const ev = evaluateAll(harness);
    expect(ev.skipped).toEqual([]);
    // Wäre diese Zahl 0, wäre die Versöhnung unten trivial erfüllt und blind.
    expect(ev.findings.filter((f) => f.source === 'conformance').length).toBeGreaterThan(0);
  });

  it('Σ rules_get_violations (ungefiltert) === Σ graph_readiness.violationsByRule', async () => {
    const flat = await tools.rules_get_violations.handler({});
    const readiness = await tools.graph_readiness.handler({ detail: false });

    expect(sum(readiness.violationsByRule)).toBe(flat.total);
    // Beide Flächen deklarieren dieselbe (leere) Menge übersprungener Quellen —
    // ohne diese Zusicherung könnten sie mit gleicher Summe verschiedene Fragen
    // beantwortet haben.
    expect(readiness.skipped).toEqual(flat.skipped);
  });

  it('rules_evaluate ist dieselbe Grundgesamtheit wie rules_get_violations', async () => {
    const evaluate = await tools.rules_evaluate.handler({});
    const flat = await tools.rules_get_violations.handler({});
    expect(evaluate.violations.length).toBe(flat.total);
  });

  it('jedes Finding trägt seine Herkunft, und RC-Findings sind über ALLE Flächen sichtbar', async () => {
    const { violations, skipped } = await tools.rules_evaluate.handler({});
    expect(skipped).toEqual([]);
    expect(violations.every((v) => v.source === 'rules' || v.source === 'conformance')).toBe(true);

    // Die konkrete Lücke aus dem CR: RC-Regeln waren in rules_* unsichtbar (stumm 0),
    // obwohl graph_readiness sie meldete.
    const rcInFlat = violations.filter((v) => v.ruleId.startsWith('RC-')).map((v) => v.ruleId);
    const readiness = await tools.graph_readiness.handler({ detail: false });
    const rcInReadiness = Object.keys(readiness.violationsByRule).filter((r) => r.startsWith('RC-'));
    expect([...new Set(rcInFlat)].sort()).toEqual(rcInReadiness.sort());
  });

  it('fällt eine Quelle aus, sagen es BEIDE Flächen — statt still zu schrumpfen', async () => {
    // Unlesbarer repoRoot = die Konformanz-Quelle ist nicht beschaffbar. Vorher
    // hätte das eine Fläche stumm um die RC-Findings verkleinert; jetzt ist die
    // Abwesenheit deklariert und in beiden Projektionen identisch.
    const full = evaluateAll(harness);
    const degraded = evaluateAll({
      evaluateRules: () => harness.evaluateRules(),
      getGraph: () => harness.getGraph(),
      getRepoRoot: () => join(tmp, 'does-not-exist'),
    });

    expect(degraded.skipped).toEqual(['conformance']);
    expect(degraded.findings.every((f) => f.source === 'rules')).toBe(true);
    expect(degraded.findings.length).toBeLessThan(full.findings.length);
  });

  it('detail:"summary" kürzt nur die Projektion, nie die Grundgesamtheit', async () => {
    const full = await tools.rules_get_violations.handler({ detail: 'full' });
    const summary = await tools.rules_get_violations.handler({ detail: 'summary' });

    expect(summary.total).toBe(full.total);
    expect(summary.violations.every((v) => v.context === undefined)).toBe(true);
    expect(full.violations.some((v) => v.context !== undefined)).toBe(true);
  });
});
