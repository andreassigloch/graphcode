/**
 * TEST-nd-im-report (CR-GC-442) — Near-Duplicates sind im Report-/Dashboard-Pfad
 * sichtbar, und das Gate bleibt ND-frei.
 *
 * Vorher: ND-01/ND-02 leben in `@sigloch/contracts/se` und brauchen eine injizierte
 * Similarity-Matrix. Injiziert hat sie NUR `takeSteeringSnapshot`. `evaluateAll` —
 * die Grundgesamtheit von `rules_evaluate`, `rules_get_violations`, `graph_readiness`
 * und damit des Dashboards — injizierte nicht und wertete ND auch gar nicht aus. Ein
 * Beinahe-Duplikat war dort strukturell unsichtbar, und `skipped` wies das zwar aus
 * (`rule:ND-02`), aber niemand holte es nach.
 *
 * Zwei Aussagen, die zusammen gehören:
 *   1. ND-Funde erscheinen in `rules_evaluate` (rot vor dieser CR: kein Fund).
 *   2. Das Gate blockiert daran NIE — `SE_DESCRIPTOR.rules` trägt ND nicht, und der
 *      globale contracts-Modul-State bleibt nach jedem Lauf zurückgesetzt.
 *
 * Realer Disk-Kuzu-Store, echte Harness, echter Regellauf — kein Mock.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import {
  DEFAULT_METRIC_POLICY,
  evaluateAORules,
  getND02SimilarityMatrix,
  type OntologyGraph,
} from '@sigloch/contracts/se';
import { GraphCodeHarness } from '../src/harness/harness.js';
import { bindToolsToHarness } from '../src/tools/mcp-tools.js';
import { evaluateAll, readinessOf, type Finding } from '../src/conformance/evaluation.js';
import { takeSteeringSnapshot } from '../src/steering/steering-snapshot.js';
import { injectNDMatrices, clearNDMatrices, withNDMatrices } from '../src/steering/nd-similarity.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

/** Zwei feld- UND beschreibungsgleiche SCHEMAs — der ND-02-Fall. */
const DUP_FIELDS = ['metricIds', 'format', 'userId'];
const DUP_DESCR = 'Request payload for a custom report.';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'nd-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

const ndOf = (findings: readonly Finding[], ruleId: string): Finding[] =>
  findings.filter((f) => f.ruleId === ruleId);

describe('TEST-nd-im-report: ND-Funde erscheinen im Report-Pfad (CR-GC-442)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: ReturnType<typeof bindToolsToHarness>;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-nd-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph({
      elements: [
        { id: 'SYS-report', type: 'SYS', name: 'Report', description: 'Ein System, das Reports erzeugt.' },
        {
          id: 'SCHEMA-report-request',
          type: 'SCHEMA',
          name: 'ReportRequest',
          description: DUP_DESCR,
          attributes: { fields: DUP_FIELDS },
        },
      ],
      traces: [],
    });
    tools = bindToolsToHarness(harness);
  }, 120_000);

  afterAll(async () => {
    await harness?.close();
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it('das Duplikat kommt durchs GATE — ND blockiert keine Mutation (Delta-Semantik unberührt)', async () => {
    const result = await harness.mutate([
      {
        op: 'add-node',
        node: {
          uid: 'SCHEMA-report-req',
          type: 'SCHEMA',
          name: 'ReportReq',
          description: DUP_DESCR,
          attributes: { fields: DUP_FIELDS },
        },
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.tier).not.toBe('block');
    // Und das Gate hat ND überhaupt nicht gesehen — nicht "gesehen, aber durchgelassen".
    expect(harness.evaluateRules().filter((v) => v.ruleId.startsWith('ND-'))).toEqual([]);
    expect((SE_DESCRIPTOR.rules ?? []).filter((r) => r.id.startsWith('ND-'))).toEqual([]);
  });

  it('ROT vor CR-GC-442: rules_evaluate meldet den ND-02-Fund für das feld-identische Paar', async () => {
    const evaluated = await tools.rules_evaluate.handler({ detail: 'full' });
    const nd02 = (evaluated.violations as Finding[]).filter((v) => v.ruleId === 'ND-02');

    expect(nd02).toHaveLength(1);
    expect(nd02[0].elementId).toBe('SCHEMA-report-request');
    expect(nd02[0].message).toContain('SCHEMA-report-req');
    // Severity kommt aus contracts, nicht von hier — kein lokaler Regel-Fork.
    expect(nd02[0].severity).toBe('error');
    expect(nd02[0].fixHint).toBeTruthy();
    // Und die Regel gilt damit nicht mehr als ausgelassen.
    expect(evaluated.skipped).not.toContain('rule:ND-02');
  });

  it('dieselbe Grundgesamtheit auf allen Lese-Flächen — auch das Dashboard sieht den Fund', async () => {
    const flat = await tools.rules_get_violations.handler({ detail: 'full' });
    const readiness = await tools.graph_readiness.handler({ detail: true });

    expect((flat.violations as Finding[]).filter((v) => v.ruleId === 'ND-02')).toHaveLength(1);
    expect(readiness.violationsByRule['ND-02']).toBe(1);
    // `notInGate` bleibt: ausgewertet ≠ gate-relevant (die beiden Aussagen sind getrennt).
    expect(readiness.catalogs.notInGate).toContain('ND-02');
    expect(readiness.skipped).not.toContain('rule:ND-02');
  });

  it('Compliance zählt den ND-Fund mit — das duplizierte Element gilt als fehlerbehaftet', () => {
    const ev = evaluateAll(harness);
    const nd02 = ndOf(ev.findings, 'ND-02');

    expect(nd02).toHaveLength(1);
    // error-Severity AN einem Element: genau das, was `computeReadiness` in
    // `elementsWithErrors` zählt — die Wirkung auf die Compliance-Zahl, ausgeschrieben.
    expect(nd02[0].severity).toBe('error');
    expect(nd02[0].elementId).toBe('SCHEMA-report-request');
    const report = readinessOf(ev, harness.getGraph());
    expect(report.compliance.elementsWithErrors).toBeGreaterThan(0);
  });
});

describe('Modul-State: die ND-Matrix leckt nicht zwischen den Pfaden (CR-GC-442)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-nd-state-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph({
      elements: [
        { id: 'SYS-x', type: 'SYS', name: 'x', description: 'Ein System.' },
        { id: 'SCHEMA-a', type: 'SCHEMA', name: 'A', description: DUP_DESCR, attributes: { fields: DUP_FIELDS } },
        { id: 'SCHEMA-b', type: 'SCHEMA', name: 'B', description: DUP_DESCR, attributes: { fields: DUP_FIELDS } },
      ],
      traces: [],
    });
  }, 120_000);

  afterAll(async () => {
    await harness?.close();
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it('nach jedem Report- und Steering-Lauf steht der contracts-Modul-State wieder auf null', () => {
    clearNDMatrices();

    const ev = evaluateAll(harness);
    expect(ndOf(ev.findings, 'ND-02')).toHaveLength(1); // der Lauf hat wirklich injiziert
    expect(getND02SimilarityMatrix()).toBeNull();

    takeSteeringSnapshot(harness.getGraph(), harness.getMetricPolicy(), harness.getFocusThreshold());
    expect(getND02SimilarityMatrix()).toBeNull();
  });

  it('die Klammer gibt den Zustand auch frei, wenn der Lauf wirft', () => {
    const og: OntologyGraph = { elements: [], traces: [] } as unknown as OntologyGraph;
    expect(() =>
      withNDMatrices(og, () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(getND02SimilarityMatrix()).toBeNull();
  });

  it('zwei Gate-Läufe um einen Report-/Steering-Lauf herum liefern identische Verstöße', () => {
    const before = harness.evaluateRules();
    evaluateAll(harness);
    takeSteeringSnapshot(harness.getGraph(), harness.getMetricPolicy(), harness.getFocusThreshold());
    expect(harness.evaluateRules()).toEqual(before);
  });

  it('WARUM die Klammer nötig ist: AO-D01 (Gate-Katalog) liest dieselbe ND-02-Matrix mit', () => {
    // Ein Relay: FUNC-relay erfüllt kein REQ und schickt io an zwei FUNCs, deren
    // SCHEMAs sich NICHT überlappen. Ohne Matrix überspringt AO-D01 die
    // Overlap-Prüfung ("no matrix → assume pass") und meldet; mit Matrix nicht.
    const og = {
      elements: [
        { id: 'FUNC-relay', type: 'FUNC', name: 'Relay', description: 'Leitet weiter.' },
        { id: 'FUNC-b', type: 'FUNC', name: 'B', description: 'Schreibt Audit-Zeilen.' },
        { id: 'FUNC-c', type: 'FUNC', name: 'C', description: 'Rendert Kacheln.' },
        { id: 'FLOW-b', type: 'FLOW', name: 'audit', description: 'Audit-Zeilen.' },
        { id: 'FLOW-c', type: 'FLOW', name: 'tiles', description: 'Kachel-Daten.' },
        { id: 'SCHEMA-b', type: 'SCHEMA', name: 'AuditEntry', description: 'Eine Audit-Zeile.', attributes: { fields: ['timestamp', 'author'] } },
        { id: 'SCHEMA-c', type: 'SCHEMA', name: 'Tile', description: 'Eine Kachel.', attributes: { fields: ['x', 'y', 'label'] } },
      ],
      traces: [
        { source: 'FUNC-relay', target: 'FUNC-b', type: 'io' },
        { source: 'FUNC-relay', target: 'FUNC-c', type: 'io' },
        { source: 'FUNC-b', target: 'FLOW-b', type: 'io' },
        { source: 'FUNC-c', target: 'FLOW-c', type: 'io' },
        { source: 'FLOW-b', target: 'SCHEMA-b', type: 'relation' },
        { source: 'FLOW-c', target: 'SCHEMA-c', type: 'relation' },
      ],
    } as unknown as OntologyGraph;

    clearNDMatrices();
    const withoutMatrix = evaluateAORules(og, DEFAULT_METRIC_POLICY).filter((v) => v.rule_id === 'AO-D01');
    injectNDMatrices(og);
    const withMatrix = evaluateAORules(og, DEFAULT_METRIC_POLICY).filter((v) => v.rule_id === 'AO-D01');
    clearNDMatrices();

    // Der Beweis, dass der Modul-State NICHT gate-neutral ist: dieselbe Regel,
    // derselbe Graph, zwei Ergebnisse — allein abhängig davon, ob vorher irgendwo
    // im Prozess injiziert wurde.
    expect(withoutMatrix).toHaveLength(1);
    expect(withMatrix).toHaveLength(0);
  });
});
