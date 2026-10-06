/**
 * CR-GC-598 — eine Fokusmenge fuer Schritt, Probe und Bericht; `blockingErrors` zaehlt die Fehler-Funde
 * dieser Menge — abgenommene nicht.
 *
 * Rewind opus5-12: die Probe meldete "blockingErrors 0 → 8" fuer S/O/D an den Risiko-REQs — das
 * waren FM-03-Fehler, am Gate `gating: false` und abnehmbar. Der Agent liess FM-01 deshalb offen,
 * statt S/O/D zu setzen und FM-03 abzunehmen. Und ein ausdrueckliches `defer` vergass der Folgeschritt.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ALL_RULE_DEFS, DEFAULT_METRIC_POLICY, TASK_ENTRY, type OntologyGraph, type RuleViolation } from '@sigloch/contracts/se';
import type { Graph } from '@sigloch/graph-api-core';
import { focusViolations, blockingOf, ABNEHMBAR, ABNEHMBAR_BEGRUENDET } from '../src/kernel/measure/focus-set.js';
import { takeSteeringSnapshot } from '../src/kernel/measure/steering-snapshot.js';
import { alsFormatE } from './helpers/format-e.js';
import { createHarness, bindToolsToHarness, type GraphCodeHarness } from '../src/index.js';

const v = (rule_id: string, severity: 'error' | 'warning' | 'info', element_id = 'REQ-r'): RuleViolation =>
  ({ rule_id, severity, element_id, message: 'x' }) as RuleViolation;
const og = (attrs: Record<string, unknown> = {}): OntologyGraph =>
  ({ elements: [{ id: 'SYS-s', type: 'SYS', name: 'S' }, { id: 'REQ-r', type: 'REQ', name: 'R', attributes: attrs }], traces: [] }) as never;

describe('CR-GC-598: eine Fokusmenge, und blockingErrors kennt die Abnahme', () => {
  it('eine offene abnehmbare Regel zaehlt als Fund — abgenommen nicht mehr (AF-05 am SYS)', () => {
    const sysAb = { elements: [{ id: 'SYS-s', type: 'SYS', name: 'S', attributes: { acceptedFindings: [{ ruleId: 'AF-05', reason: 'lean' }] } }], traces: [] } as never;
    expect(focusViolations(og(), [v('AF-05', 'warning', 'SYS-s')]).length).toBe(1);
    expect(focusViolations(sysAb, [v('AF-05', 'warning', 'SYS-s')]).length).toBe(0);
    expect(blockingOf(focusViolations(og(), [v('R-01', 'error')]))).toBe(1); // R-01 ist ein echter Gate-Fehler
  });

  // CR-GC-748: bis contracts 10 nahm der Arbeitsschritt `fmea` dem Kern FM-01..03 ab (CR-GC-599/600).
  // Die gekuerzte Zuordnung (CR-SM-395) laesst sie beim Kern: sie schweigen, solange es keine
  // Risiko-Anforderung gibt, und stehen danach an ihrer Stufe.
  it('die Regeln der Analysen stehen im Kern-Fokus, sobald sie melden — FM-03 bleibt abnehmbar', () => {
    const kern = focusViolations(og(), [v('FM-01', 'warning'), v('FM-02', 'warning'), v('FM-03', 'warning')]);
    expect(kern.map((x) => x.rule_id)).toEqual(['FM-01', 'FM-02', 'FM-03']);
    const ab = og({ acceptedFindings: [{ ruleId: 'FM-03', reason: 'Nachweis erst mit dem ersten Testlauf' }, { ruleId: 'FM-01', reason: 'x' }] });
    // FM-03 ist abgenommen und weg; FM-01 ist nicht abnehmbar — die Abnahme zaehlt nicht.
    expect(focusViolations(ab, [v('FM-01', 'warning'), v('FM-03', 'warning')]).map((x) => x.rule_id)).toEqual(['FM-01']);
  });

  it('ND-01/02 sind im Fokus, obwohl das Gate sie nie wertet (CR-GC-287)', () => {
    expect(focusViolations(og(), [v('ND-01', 'warning', 'REQ-r')]).map((x) => x.rule_id)).toEqual(['ND-01']);
  });

  it('CR-GC-599: keine Regel-Klausel fuer FM-01 — der Loop setzt keine Bewertungen', async () => {
    const { RULE_CLAUSE } = await import('../src/loop/generate.js');
    expect(RULE_CLAUSE['FM-01']).toBeUndefined();
  });

  it('eine abgenommene Architekturregel bleibt im Fokus', () => {
    const attrs = { acceptedFindings: [{ ruleId: 'R-02', reason: 'versucht' }] };
    const focus = focusViolations(og(attrs), [v('R-02', 'warning')]);
    expect(focus.map((x) => x.rule_id)).toEqual(['R-02']);
    expect(ABNEHMBAR.has('R-02')).toBe(false);
  });

  it('CR-GC-600/748: ein Arbeitsschritt sieht seine Regeln und seinen Eintrittspunkt — die Schwere wird durchgereicht', () => {
    // Die Analysen fuehren kein eigenes Regelset mehr: im Schritt `fmea` steht nur sein Eintritt.
    const eintritt = TASK_ENTRY.fmea!;
    const f = focusViolations(og(), [v(eintritt, 'warning', 'SYS-s'), v('FM-03', 'warning'), v('UC-01', 'warning', 'SYS-s')], 'fmea');
    expect(f.map((x) => x.rule_id)).toEqual([eintritt]);
    // Die Textqualitaet der Anforderungen ist der eine Arbeitsschritt mit eigenen Regeln — im Kern unsichtbar.
    const bq = focusViolations(og(), [v('BQ-02', 'warning'), v('UC-01', 'warning', 'SYS-s')], 'anforderungsqualitaet');
    expect(bq.map((x) => x.rule_id)).toEqual(['BQ-02']);
    expect(focusViolations(og(), [v('BQ-02', 'warning')])).toEqual([]);
    // Die Schwere wird durchgereicht, nicht umgeschrieben — kein zweites Urteil im Fokus.
    expect(focusViolations(og(), [v('BQ-02', 'error')], 'anforderungsqualitaet')[0]!.severity).toBe('error');
    expect(blockingOf(bq)).toBe(0);
  });

  it('CR-GC-748: abnehmbar sind die Analysen (Rolle am Katalog), die Eintrittsregeln und die begruendeten Ausnahmen — sonst nichts', () => {
    const analysen = ALL_RULE_DEFS.filter((r) => r.role === 'analysis').map((r) => r.id);
    const eintritte = Object.values(TASK_ENTRY).filter((e): e is string => e !== null);
    expect(analysen.length).toBeGreaterThan(0);
    expect([...ABNEHMBAR].sort()).toEqual([...new Set([...analysen, ...eintritte, ...Object.keys(ABNEHMBAR_BEGRUENDET)])].sort());
    // Jede Ausnahme traegt ihren Grund und ist eine Regel des Katalogs.
    for (const [id, grund] of Object.entries(ABNEHMBAR_BEGRUENDET)) {
      expect(ALL_RULE_DEFS.some((r) => r.id === id), id).toBe(true);
      expect(grund.length, id).toBeGreaterThan(20);
    }
    // Die Bindungsregeln (Stufe 11) sind es nicht mehr: faellig sind sie erst im Bau, und dort sind sie die Arbeitsliste.
    for (const r of ALL_RULE_DEFS.filter((d) => d.stage === 11 || d.stage === 12)) expect(ABNEHMBAR.has(r.id), r.id).toBe(false);
  });

  it('Regeln ausserhalb des Gate-Katalogs (BQ-02) und info-Regeln sind nicht im Fokus', () => {
    expect(focusViolations(og(), [v('BQ-02', 'warning'), v('MT-04', 'info', 'SYS-s')])).toEqual([]);
  });
});

/**
 * CR-GC-748: „Code-Praesenz nur, wenn etwas gebunden ist" stand als Punkt 3 in der Fokusmenge. Das ist jetzt
 * die Faelligkeit der Regel (contracts `isDue`, am Katalog) — die Fokusmenge fragt den Zustand nicht mehr ab,
 * sie bekommt nur faellige Befunde. Hier am ECHTEN Regellauf, nicht an handgebauten Befunden.
 */
describe('CR-GC-748: die Fokusmenge zeigt Bindungsbefunde erst, wenn der Bau eroeffnet ist', () => {
  const n = (uid: string, type: string, attributes: Record<string, unknown> = {}) =>
    ({ uid, type, name: uid, description: `Das System muss ${uid} leisten.`, attributes });
  const e = (sourceId: string, targetId: string, edgeType: string) => ({ sourceId, targetId, edgeType, attributes: {} });
  const entwurf = (extra: unknown[] = [], kanten: unknown[] = []): Graph => ({
    nodes: [n('SYS-x', 'SYS'), n('REQ-r', 'REQ', { kinds: ['functional'] }), n('FUNC-f', 'FUNC'), n('TEST-t', 'TEST'), n('SCHEMA-s', 'SCHEMA'), ...extra],
    edges: [e('SYS-x', 'REQ-r', 'compose'), e('FUNC-f', 'REQ-r', 'satisfy'), e('TEST-t', 'REQ-r', 'verify'), ...kanten],
  }) as Graph;
  const bindung = new Set(ALL_RULE_DEFS.filter((r) => r.stage === 11).map((r) => r.id));
  const imFokus = (g: Graph) => takeSteeringSnapshot(g, DEFAULT_METRIC_POLICY).focus.filter((f) => bindung.has(f.rule_id));

  it('Entwurf ohne Auftrag und ohne Bindung: kein Bindungsbefund im Fokus — der Bauplan ist der Befund', () => {
    const snap = takeSteeringSnapshot(entwurf(), DEFAULT_METRIC_POLICY);
    expect(snap.focus.filter((f) => bindung.has(f.rule_id))).toEqual([]);
    expect(snap.focus.map((f) => f.rule_id)).toContain(TASK_ENTRY.plan);
  });

  it('ein offener Auftrag: die ungebundenen Elemente stehen im Fokus, der Bauplan-Befund ist weg', () => {
    const g = entwurf([n('CR-1', 'CR', { status: 'open' })], [e('CR-1', 'FUNC-f', 'relation')]);
    const elemente = imFokus(g).map((f) => f.element_id);
    expect(elemente).toEqual(expect.arrayContaining(['FUNC-f', 'TEST-t', 'SCHEMA-s']));
    expect(takeSteeringSnapshot(g, DEFAULT_METRIC_POLICY).focus.map((f) => f.rule_id)).not.toContain(TASK_ENTRY.plan);
  });

  it('ein erledigter Auftrag eroeffnet den Bau nicht', () => {
    const g = entwurf([n('CR-1', 'CR', { status: 'done', commitRef: 'abc1234' })], [e('CR-1', 'FUNC-f', 'relation')]);
    expect(imFokus(g)).toEqual([]);
  });

  it('eine Bindung von Hand, ohne Auftrag: die uebrigen ungebundenen Elemente stehen im Fokus', () => {
    const g = entwurf();
    g.nodes.find((x) => x.uid === 'FUNC-f')!.attributes = { realRef: { file: 'src/f.ts', symbol: 'f' } };
    const elemente = imFokus(g).map((f) => f.element_id);
    expect(elemente).toEqual(expect.arrayContaining(['TEST-t', 'SCHEMA-s']));
    expect(elemente).not.toContain('FUNC-f');
  });
});

describe('CR-GC-598: ein ausdrueckliches defer gilt fuer die Sitzung', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: ReturnType<typeof bindToolsToHarness>;
  const knoten = (uid: string, type: string, name: string, description: string) =>
    ({ op: 'add-node', node: { uid, type, name, description, attributes: {} } });

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'gc-focusset-'));
    mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
    harness = await createHarness({ repoRoot, scope: { workspaceId: 'w', systemId: 's' } });
    await harness.initialize();
    tools = bindToolsToHarness(harness);
    await tools.graph_mutate.handler({
      formatE: alsFormatE([
        knoten('SYS-s', 'SYS', 'S', 'Ein System fuer Bestellungen.'),
        knoten('UC-a', 'UC', 'Bestellen', 'Kunde bestellt ein Teil und erhaelt eine Bestaetigung.'),
        knoten('ACTOR-k', 'ACTOR', 'Kunde', 'Wer bestellt.'),
        { op: 'add-edge', edge: { sourceId: 'SYS-s', targetId: 'UC-a', edgeType: 'compose', attributes: {} } },
      ], harness),
      consumerId: 't',
    });
  });
  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('graph_generate {defer:[K]} — nach dem naechsten Zug nennt auch der Schritt K nicht mehr', async () => {
    const erst = await tools.graph_generate.handler({});
    const k = erst.focusKey!;
    const mitDefer = await tools.graph_generate.handler({ defer: [k] });
    expect(mitDefer.focusKey).not.toBe(k);
    await tools.graph_mutate.handler({
      formatE: alsFormatE([{ op: 'update-node', node: { uid: 'SYS-s', description: 'Fassung 2.' } }], harness),
      consumerId: 't',
    });
    expect((await tools.graph_generate.handler({})).focusKey).not.toBe(k);
  });
});
