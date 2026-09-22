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
import { focusViolations, blockingOf, ABNEHMBARE_REGELN } from '../src/kernel/measure/focus-set.js';
import { createHarness, bindToolsToHarness, type GraphCodeHarness } from '../src/index.js';

const v = (rule_id: string, severity: 'error' | 'warning' | 'info', element_id = 'REQ-r'): RuleViolation =>
  ({ rule_id, severity, element_id, message: 'x' }) as RuleViolation;
const og = (attrs: Record<string, unknown> = {}): OntologyGraph =>
  ({ elements: [{ id: 'SYS-s', type: 'SYS', name: 'S' }, { id: 'REQ-r', type: 'REQ', name: 'R', attributes: attrs }], traces: [] }) as never;

describe('CR-GC-598: eine Fokusmenge, und blockingErrors kennt die Abnahme', () => {
  it('eine offene FM-03 zaehlt als Fehler-Fund — eine abgenommene nicht mehr', () => {
    expect(blockingOf(focusViolations(og(), [v('FM-03', 'error'), v('UC-01', 'error', 'SYS-s')]))).toBe(2);
    const ab = og({ acceptedFindings: [{ ruleId: 'FM-03', reason: 'Testlauf fehlt' }] });
    expect(blockingOf(focusViolations(ab, [v('FM-03', 'error'), v('UC-01', 'error', 'SYS-s')]))).toBe(1);
  });

  it('ND-01/02 sind im Fokus, obwohl das Gate sie nie wertet (CR-GC-287)', () => {
    expect(focusViolations(og(), [v('ND-01', 'error', 'REQ-r')]).map((x) => x.rule_id)).toEqual(['ND-01']);
  });

  it('FM-01 hat eine Regel-Klausel, die FM-03 als abnehmbar nennt — im Moment der Entscheidung', async () => {
    const { RULE_CLAUSE } = await import('../src/loop/generate.js');
    const t = RULE_CLAUSE['FM-01'].text(['REQ-r']);
    expect(t).toMatch(/severity, occurrence, detection/);
    expect(t).toMatch(/FM-03/);
    expect(t).toMatch(/acceptedFindings/);
  });

  it('eine abgenommene FM-03 verlaesst den Fokus; eine abgenommene Architekturregel nicht', () => {
    const attrs = { acceptedFindings: [{ ruleId: 'FM-03', reason: 'Testlauf fehlt' }, { ruleId: 'R-02', reason: 'versucht' }] };
    const focus = focusViolations(og(attrs), [v('FM-03', 'error'), v('R-02', 'warning')]);
    expect(focus.map((x) => x.rule_id)).toEqual(['R-02']);
    expect(ABNEHMBARE_REGELN.has('R-02')).toBe(false);
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
