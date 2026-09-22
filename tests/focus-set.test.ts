/**
 * CR-GC-598 — eine Fokusmenge fuer Schritt, Probe und Bericht; `blockingErrors` zaehlt die Fehler-Funde
 * dieser Menge — abgenommene nicht.
 *
 * Rewind opus5-12: die Probe meldete "blockingErrors 0 → 8" fuer S/O/D an den Risiko-REQs — das
 * waren FM-03-Fehler, am Gate `gating: false` und abnehmbar. Der Agent liess FM-01 deshalb offen,
 * statt S/O/D zu setzen und FM-03 abzunehmen. Und ein ausdrueckliches `defer` vergass `next`.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { OntologyGraph, RuleViolation } from '@sigloch/contracts/se';
import { focusViolations, blockingOf, abnehmbar } from '../src/kernel/measure/focus-set.js';
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

  it('CR-GC-599/600: FM-01/02/03 sind nie im KERN-Fokus — S/O/D setzt nur die FMEA', () => {
    expect(focusViolations(og(), [v('FM-01', 'warning'), v('FM-02', 'warning'), v('FM-03', 'warning')])).toEqual([]);
    expect(abnehmbar('kern').has('FM-03')).toBe(false);
    expect(abnehmbar('fmea').has('FM-03')).toBe(true); // im FMEA-Task abnehmbar (CR-GC-600)
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
    expect(abnehmbar('kern').has('R-02')).toBe(false);
  });

  it('CR-GC-600/605: der Task sieht sein Regelset — Warnungen, weil keine Task-Regel error ist (CR-SM-353)', () => {
    const f = focusViolations(og(), [v('FM-03', 'warning'), v('UC-01', 'warning', 'SYS-s')], 'fmea');
    expect(f.map((x) => x.rule_id)).toEqual(['FM-03']);
    expect(f[0].severity).toBe('warning');
    expect(blockingOf(f)).toBe(0);
    // Die Schwere wird durchgereicht, nicht umgeschrieben — kein zweites Urteil im Fokus.
    expect(focusViolations(og(), [v('FM-03', 'error')], 'fmea')[0].severity).toBe('error');
    const plan = focusViolations(og(), [v('CR-R03', 'warning'), v('MS-01', 'warning', 'SYS-s')], 'plan');
    expect(plan.map((x) => x.rule_id).sort()).toEqual(['CR-R03', 'MS-01']);
    expect(focusViolations(og(), [v('CR-R03', 'warning')]).length).toBe(0); // im Kern unsichtbar
  });

  it('CR-GC-600: im Kern sind nur die Eintrittspunkte abnehmbar', () => {
    expect([...abnehmbar('kern')].sort()).toEqual(['AF-01', 'AF-02', 'AF-03', 'AF-04', 'AF-05']);
  });

  it('Regeln ausserhalb des Gate-Katalogs (BQ-02) und info-Regeln sind nicht im Fokus', () => {
    expect(focusViolations(og(), [v('BQ-02', 'warning'), v('UC-05', 'info', 'SYS-s')])).toEqual([]);
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
      commands: [
        knoten('SYS-s', 'SYS', 'S', 'Ein System fuer Bestellungen.'),
        knoten('UC-a', 'UC', 'Bestellen', 'Kunde bestellt ein Teil und erhaelt eine Bestaetigung.'),
        knoten('ACTOR-k', 'ACTOR', 'Kunde', 'Wer bestellt.'),
        { op: 'add-edge', edge: { sourceId: 'SYS-s', targetId: 'UC-a', edgeType: 'compose', attributes: {} } },
      ],
      consumerId: 't',
    });
  });
  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('graph_generate {defer:[K]} — danach nennt auch next K nicht mehr', async () => {
    const erst = await tools.graph_generate.handler({});
    const k = erst.focusKey!;
    const mitDefer = await tools.graph_generate.handler({ defer: [k] });
    expect(mitDefer.focusKey).not.toBe(k);
    const r = (await tools.graph_mutate.handler({
      commands: [{ op: 'update-node', node: { uid: 'SYS-s', description: 'Fassung 2.' } }],
      consumerId: 't',
    })) as { next?: { focusKey: string | null } };
    expect(r.next!.focusKey).not.toBe(k);
  });
});
