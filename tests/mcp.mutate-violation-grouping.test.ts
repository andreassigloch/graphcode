/**
 * TEST-mutate-violation-grouping (CR-GC-570) — die Gate-Antwort traegt einen Befund
 * je (Regel, Meldungsmuster) statt einen je Element.
 *
 * Gemessen an `rig/greenfield-systemtest/runs/opus5-5`: `graph_mutate` stellte mit
 * 202.833 Zeichen 70 % aller Werkzeug-Ergebnisse im Kontextfenster und verursachte
 * 48 % der cache_creation — des Postens mit etwa dem Zwoelffachen des Lesepreises.
 * 23 Antworten trugen 487 Befunde, und in ALLEN 487 stand die elementId im
 * Meldungstext. Der Befundkoerper (Meldung + fixHint, zusammen Ø 151 Zeichen)
 * wiederholte sich damit je Element wortgleich bis auf die eine uid: `R-19` 73-mal,
 * `RD-01` 73-mal.
 *
 * CR-GC-570 hatte zuerst etwas anderes vorgeschlagen — nicht-blockierende Befunde nur
 * fuer die Fokus-Typen der Runde zu melden. Gegen denselben Lauf nachgerechnet bringt
 * das 0,2 %: die Batches beruehren fast alle Typen, also faellt fast nichts weg. Der
 * Befund war richtig, die vorgeschlagene Ursache nicht.
 *
 * Was hier steht, ist deshalb kein Kuerzen, sondern eine FAKTORISIERUNG — und damit
 * pruefbar verlustfrei: aus Muster plus Elementliste ist jede Originalmeldung wieder
 * herstellbar, auch jede blockierende. Genau das ist Akzeptanzkriterium 2.
 *
 * Echtes Disk-Kuzu (temp dir, nie :memory:). Keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { groupViolationsByRule, ELEMENT_PLACEHOLDER } from '../src/kernel/evaluation.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import type { HarnessConfig, RuleViolation } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

type Grouped = { ruleId: string; severity: string; message: string; fixHint?: string; elements: string[] };

/** `{el}` je Element wieder einsetzen — die Rueckrichtung, die der Aufrufer geht. */
function expand(grouped: Grouped[]): Array<Omit<RuleViolation, 'context'>> {
  const out: Array<Omit<RuleViolation, 'context'>> = [];
  for (const g of grouped) {
    const put = (elementId?: string) => {
      const fill = (t?: string) =>
        t === undefined || !elementId ? t : t.split(ELEMENT_PLACEHOLDER).join(elementId);
      out.push({
        ruleId: g.ruleId,
        severity: g.severity as RuleViolation['severity'],
        message: fill(g.message)!,
        ...(elementId ? { elementId } : {}),
        ...(g.fixHint === undefined ? {} : { fixHint: fill(g.fixHint) }),
      });
    };
    if (g.elements.length === 0) put();
    else for (const e of g.elements) put(e);
  }
  return out;
}

const v = (ruleId: string, elementId: string | undefined, message: string, fixHint?: string): RuleViolation =>
  ({ ruleId, severity: 'warning', message, ...(elementId ? { elementId } : {}), ...(fixHint ? { fixHint } : {}) }) as RuleViolation;

describe('TEST-mutate-violation-grouping: die Faltung (CR-GC-570)', () => {
  it('faltet dieselbe Regel mit demselben Muster auf EINEN Eintrag', () => {
    const grouped = groupViolationsByRule([
      v('R-19', 'REQ-a', 'REQ-a hat keinen verifizierenden TEST', 'verify-Kante ziehen'),
      v('R-19', 'REQ-b', 'REQ-b hat keinen verifizierenden TEST', 'verify-Kante ziehen'),
      v('R-19', 'REQ-c', 'REQ-c hat keinen verifizierenden TEST', 'verify-Kante ziehen'),
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].message).toBe(`${ELEMENT_PLACEHOLDER} hat keinen verifizierenden TEST`);
    expect(grouped[0].elements).toEqual(['REQ-a', 'REQ-b', 'REQ-c']);
  });

  it('faltet NICHT, was sich wirklich unterscheidet — gemessen R-18: 19 Muster auf 32 Funde', () => {
    // Der Schluessel ist das vollstaendige Muster, keine Heuristik auf der ruleId.
    const grouped = groupViolationsByRule([
      v('R-18', 'FLOW-a', 'FLOW-a: compose ist hier nicht erlaubt'),
      v('R-18', 'FLOW-b', 'FLOW-b: satisfy ist hier nicht erlaubt'),
    ]);
    expect(grouped).toHaveLength(2);
  });

  it('faltet auch den fixHint — er traegt die uid genauso', () => {
    const grouped = groupViolationsByRule([
      v('R-23', 'MOD-a', 'MOD-a hat keine FUNC', 'allocate MOD-a -> eine FUNC'),
      v('R-23', 'MOD-b', 'MOD-b hat keine FUNC', 'allocate MOD-b -> eine FUNC'),
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].fixHint).toBe(`allocate ${ELEMENT_PLACEHOLDER} -> eine FUNC`);
  });

  it('ein Befund ohne elementId wird nicht templatisiert und faltet nur bei wortgleicher Meldung', () => {
    const grouped = groupViolationsByRule([
      v('STRUCT', undefined, 'Unbekannter Knotentyp WIDGET'),
      v('STRUCT', undefined, 'Unbekannter Knotentyp WIDGET'),
      v('STRUCT', undefined, 'Unbekannter Kantentyp bounces'),
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].elements).toEqual([]);
    expect(grouped[0].message).not.toContain(ELEMENT_PLACEHOLDER);
  });

  it('haelt die Fundreihenfolge — sonst waeren Ranking, Test und Replay nicht vergleichbar', () => {
    const grouped = groupViolationsByRule([
      v('R-02', 'UC-x', 'UC-x ohne ACTOR'),
      v('R-19', 'REQ-a', 'REQ-a ohne TEST'),
      v('R-02', 'UC-y', 'UC-y ohne ACTOR'),
    ]);
    expect(grouped.map((g) => g.ruleId)).toEqual(['R-02', 'R-19']);
    expect(grouped[0].elements).toEqual(['UC-x', 'UC-y']);
  });
});

/** Eine MOD-Welle: jede MOD ohne allocate ist ein R-23 mit identischem Muster. */
const MOD_WAVE = Array.from({ length: 20 }, (_, i) => ({
  op: 'add-node',
  node: { uid: `MOD-welle-${i}`, type: 'MOD', name: `Welle ${i}`, description: 'Ein Modul ohne FUNC.' },
}));

/** Lauter einzelne REQs — R-01 ist ein error, der Batch wird geblockt. */
const BLOCKED_BATCH = Array.from({ length: 12 }, (_, i) => ({
  op: 'add-node',
  node: {
    uid: `REQ-blockt-${i}`,
    type: 'REQ',
    name: `Anforderung ${i}`,
    description: `Das System muss Sache ${i} innerhalb von 2 Sekunden bestaetigen und protokollieren.`,
  },
}));

describe('TEST-mutate-violation-grouping: am Gate (CR-GC-570)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-violation-grouping-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph({
      elements: [{ id: 'SYS-x', type: 'SYS', name: 'x', description: 'Ein System.' }],
      traces: [],
    });
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('AK2: ein geblockter Batch verliert keinen blockierenden Befund', async () => {
    const full = await tools.graph_mutate.handler({
      commands: BLOCKED_BATCH, consumerId: 't', violations: 'full', dryRun: true,
    });
    const summary = await tools.graph_mutate.handler({ commands: BLOCKED_BATCH, consumerId: 't', dryRun: true });
    expect(full.tier).toBe('block');
    expect(summary.tier).toBe('block');

    const fullErrors = (full.violations as RuleViolation[]).filter((x) => x.severity === 'error');
    expect(fullErrors.length).toBeGreaterThan(0);
    const backErrors = expand(summary.violations as Grouped[]).filter((x) => x.severity === 'error');
    // Nicht "ungefaehr so viele" — dieselben, Element fuer Element.
    expect(backErrors.map((x) => `${x.ruleId}@${x.elementId}`).sort())
      .toEqual(fullErrors.map((x) => `${x.ruleId}@${x.elementId}`).sort());
  });

  it('AK2: auch Meldung und fixHint kommen unveraendert zurueck', async () => {
    const full = await tools.graph_mutate.handler({
      commands: BLOCKED_BATCH, consumerId: 't', violations: 'full', dryRun: true,
    });
    const summary = await tools.graph_mutate.handler({ commands: BLOCKED_BATCH, consumerId: 't', dryRun: true });
    const key = (x: { ruleId: string; elementId?: string; message: string; fixHint?: string }) =>
      [x.ruleId, x.elementId ?? '', x.message, x.fixHint ?? ''].join(' | ');
    const fullSet = (full.violations as RuleViolation[]).map(key).sort();
    expect(expand(summary.violations as Grouped[]).map(key).sort()).toEqual(fullSet);
  });

  it('die Antwort schrumpft messbar — gleiche Befunde, weniger Bytes', async () => {
    const full = await tools.graph_mutate.handler({
      commands: MOD_WAVE, consumerId: 't', violations: 'full', dryRun: true,
    });
    const summary = await tools.graph_mutate.handler({ commands: MOD_WAVE, consumerId: 't', dryRun: true });
    const grouped = summary.violations as Grouped[];
    // Die Welle muss wirklich eine Welle sein, sonst beweist das Verhaeltnis nichts.
    expect(expand(grouped).length).toBeGreaterThanOrEqual(MOD_WAVE.length);
    const r23 = grouped.find((g) => g.ruleId === 'R-23');
    expect(r23?.elements.length).toBe(MOD_WAVE.length);
    // `full` traegt hier zusaetzlich `context`; verglichen wird deshalb gegen die
    // kontextfreie Fassung — sonst maesse der Test die CR-GC-309-Ersparnis mit.
    const perElement = JSON.stringify(
      (full.violations as RuleViolation[]).map(({ context: _c, ...rest }) => rest),
    ).length;
    const perRule = JSON.stringify(grouped).length;
    expect(perRule).toBeLessThan(perElement / 2);
  });
});

describe('TEST-mutate-violation-grouping: die Maskierung trifft nur ganze uids (CR-GC-570)', () => {
  it('laesst eine laengere uid, die mit der eigenen beginnt, unangetastet', () => {
    // `REQ-a` darf `REQ-ab` nicht zu `{el}b` machen. Aufloesbar waere das noch, aber
    // zwei verschiedene Meldungen koennten auf dasselbe Muster maskieren und dann
    // falsch zusammenfallen — ein stiller Inhaltsfehler statt gesparter Bytes.
    const grouped = groupViolationsByRule([
      v('R-18', 'REQ-a', 'REQ-a kollidiert mit REQ-ab'),
    ]);
    expect(grouped[0].message).toBe(`${ELEMENT_PLACEHOLDER} kollidiert mit REQ-ab`);
  });

  it('maskiert jedes Vorkommen der uid als ganzes Token', () => {
    const grouped = groupViolationsByRule([
      v('R-08', 'FLOW-x', 'FLOW-x: Quelle von FLOW-x fehlt', 'FLOW-x verdrahten'),
    ]);
    expect(grouped[0].message).toBe(`${ELEMENT_PLACEHOLDER}: Quelle von ${ELEMENT_PLACEHOLDER} fehlt`);
    expect(grouped[0].fixHint).toBe(`${ELEMENT_PLACEHOLDER} verdrahten`);
  });
});
