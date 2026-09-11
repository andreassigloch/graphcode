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
 *   1. ND-Funde erscheinen in `rules_evaluate` (rot vor CR-GC-442: kein Fund).
 *   2. Das Gate blockiert daran NIE — `SE_DESCRIPTOR.rules` trägt ND nicht.
 *
 * CR-SM-286 / CR-GC-488: **die Injektionsnaht ist ersatzlos entfallen.** ND-01/ND-02 rechnen
 * ihre Ähnlichkeit selbst (`similarity.ts`, je Graph gecacht); `injectNDMatrices`,
 * `clearNDMatrices`, `withNDMatrices` und `getND02SimilarityMatrix` gibt es nicht mehr. Der
 * zweite Block dieses Tests hat damit seinen Gegenstand verloren — er bewachte einen globalen
 * Modulzustand und die `finally`-Klammer darum. **Was er zusicherte, gilt weiter und stärker:**
 * das Gate-Urteil hängt nicht davon ab, ob vorher ein Report- oder Steering-Lauf stattgefunden
 * hat. Vorher hielt eine Klammer das zusammen, jetzt gibt es nichts mehr zu klammern — und
 * genau diese Invarianz steht unten noch, als Verhalten statt als Mechanik.
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

import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { evaluateAll, readinessOf, type Finding } from '../src/kernel/evaluation.js';
import { takeSteeringSnapshot } from '../src/kernel/measure/steering-snapshot.js';
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

describe('Ohne Naht: das Gate-Urteil ist von Report- und Steering-Läufen unabhängig (CR-GC-488)', () => {
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

  /**
   * Die eigentliche Zusage — vorher von `withNDMatrices` samt `finally` getragen, jetzt
   * strukturell: es gibt keinen prozessweiten Zustand mehr, den ein Lauf hinterlassen könnte.
   * Der Test bleibt trotzdem stehen: er prüft das VERHALTEN, nicht den Mechanismus, und würde
   * jede künftige Wiedereinführung eines solchen Zustands sofort melden.
   */
  it('zwei Gate-Läufe um einen Report- und Steering-Lauf herum liefern identische Verstöße', () => {
    const before = harness.evaluateRules();
    evaluateAll(harness);
    takeSteeringSnapshot(harness.getGraph(), harness.getMetricPolicy());
    expect(harness.evaluateRules()).toEqual(before);
  });

  it('der Report-Lauf sieht das Duplikat — ohne dass ihn jemand vorbereiten muss', () => {
    // Vorher war das der Beleg dafür, dass der Lauf "wirklich injiziert" hat. Die Vorbereitung
    // gibt es nicht mehr; die Aussage ist jetzt, dass es sie auch nicht braucht.
    expect(ndOf(evaluateAll(harness).findings, 'ND-02')).toHaveLength(1);
  });
});
