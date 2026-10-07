/**
 * T-B4 (+ T-B1 follow-up) — CR-GC-353. The artifact branch of the steering proof.
 *
 * CR-GC-340/341 proved the controller: the ranking steers (T-C*), the loop
 * ratchets (T-B3), the ladder is read off the measurement (T-B1). What they
 * promised and never built is the ARTIFACT coupling — the claim that a generated
 * document is PROCESS OUTPUT, i.e. that "the phase gate is still open" and "the
 * document is still incomplete" are the same fact seen twice, not two opinions.
 *
 * Without this, "compliance" is a number a view can print on an empty graph —
 * exactly what CR-GC-308 caught once already ("compliance 1.0 auf leerer View").
 *
 * Four (gate · rule · element · view) triples, one per phase gate, from
 * `GATE_FIXTURE`:
 *
 *   SRR · R-16 · ACTOR-auditor    · conops        "keine UC-Kopplung im Graph"
 *   PDR · R-22 · FUNC-audit       · architecture  "⚠ nicht alloziert (R-22)"
 *   TRR · R-26 · SCHEMA-envelope  · icd           "⚠ kein realRef (R-26)"
 *   TRR · R-01 · REQ-audit-trail  · rtm           "⚠ R-01 no verify"
 *                                 + testmatrix    "✗" in the verify-Kante column
 *
 * The assertion that carries the weight is BEFORE, not after: the row must EXIST
 * and carry the finding. A missing row would also make "the marker is gone" pass
 * afterwards, and a document that omits its gaps is precisely the failure mode
 * this file exists to rule out.
 *
 * The state change comes from `harness.mutate()` with the scripted actuator's
 * batch — never from swapping fixtures, which would compare two worlds instead of
 * one world's progress.
 *
 * SCOPE, STATED PLAINLY (T-B1 follow-up): closing these four findings does NOT
 * move the first open mark, and this file does not pretend otherwise. `GATE_FIXTURE`
 * carries further open findings (UC-03/FC-02/…). What IS asserted on the real graph is
 * the coupling one level down — the set of open rules shrinks by the rules that were
 * repaired and gains nothing. The ordered-ladder property itself is T-B1 in
 * `steering.process-ratchet.test.ts`. (CR-GC-748: the per-gate `missing` list this used
 * to read is gone with the rule coverage per phase.)
 *
 * Real disk Kuzu (temp dir), no mocks, no `:memory:`.
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
import { exportMarkdown, type MarkdownView } from '../src/projections/exporter.js';
import { generationStep, STAGE_FOCUS_TYPES, RULE_CLAUSE } from '../src/loop/generate.js';
import { ALL_RULE_DEFS } from '@sigloch/contracts/se';
import { GATE_FIXTURE, GATE_FINDINGS, makeSteeringConfig, parseFocusKey, scriptedActor } from './fixtures/steering-graphs.js';
import type { MutateCommand } from '@sigloch/contracts/harness';

/** Which rendered view marks which rule's gap, and with what text. */
interface GapSpec {
  view: MarkdownView;
  /** The literal the renderer emits for this finding — no regex, no paraphrase. */
  marker: string;
}

const GAP_IN_VIEW: Record<string, GapSpec[]> = {
  'R-16': [{ view: 'conops', marker: 'keine UC-Kopplung im Graph' }],
  'R-22': [{ view: 'architecture', marker: '⚠ nicht alloziert (R-22)' }],
  'R-26': [{ view: 'icd', marker: '⚠ kein realRef (R-26)' }],
  // Two documents, one finding: the RTM names the rule, the VCRM shows the empty
  // verify column. If those two ever disagree, the coupling claim is dead.
  'R-01': [
    { view: 'rtm', marker: '⚠ R-01 no verify' },
    { view: 'testmatrix', marker: '| ✗ |' },
  ],
};

/** Every uid a marked row points at, deduplicated (the RTM lists a REQ per layer). */
function markedUids(markdown: string, marker: string): string[] {
  const uids = new Set<string>();
  for (const line of markdown.split('\n')) {
    if (!line.includes(marker)) continue;
    const m = line.match(/`([^`]+)`/);
    if (m) uids.add(m[1]);
  }
  return [...uids].sort();
}

/** Does the document mention this element at all? Distinguishes "gap closed" from "row gone". */
function mentions(markdown: string, uid: string): boolean {
  return markdown.includes(`\`${uid}\``);
}

describe('T-B4 (CR-GC-353): a rule finding and a document gap are the same fact', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-artifact-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeSteeringConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(GATE_FIXTURE);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  const openFor = (ruleId: string): string[] =>
    harness
      .evaluateRules()
      .filter((v) => v.ruleId === ruleId)
      .map((v) => v.elementId ?? '')
      .sort();

  const render = (view: MarkdownView): string => exportMarkdown(harness.getGraph(), view, 'gate-fixture');

  /** Apply the scripted actuator's canonical repair for one finding, through the gate. */
  async function repair(ruleId: string, elementId: string, seq: number): Promise<void> {
    const batch = scriptedActor({ dimension: 'artifact', ruleId, elementIds: [elementId] }, seq);
    expect(batch, `no scripted repair for ${ruleId} — the test would measure nothing`).not.toBeNull();
    const res = await harness.mutate(batch as MutateCommand[]);
    expect(res.success, `gate rejected the repair for ${ruleId}: ${JSON.stringify(res.violations)}`).toBe(true);
  }

  for (const { ruleId, elementId } of GATE_FINDINGS) {
    const mark = ALL_RULE_DEFS.find((r) => r.id === ruleId)?.mark ?? 'immer';
    it(`${mark} · ${ruleId} — the gap is WRITTEN in the document before, and gone after`, async () => {
      // ── before ────────────────────────────────────────────────────────────
      expect(openFor(ruleId)).toEqual([elementId]);

      for (const { view, marker } of GAP_IN_VIEW[ruleId]) {
        const before = render(view);
        // The row exists — a document that simply omits its gaps would pass the
        // "marker is gone" half below without ever having said anything.
        expect(mentions(before, elementId), `${view} does not mention ${elementId} at all`).toBe(true);
        expect(before, `${view} does not mark ${elementId} as a gap`).toContain(marker);
        // COUPLING: what the document flags == what the gate holds open. Not a
        // subset, not "contains" — the same set.
        expect(markedUids(before, marker), `${view} marks something the gate does not`).toEqual([elementId]);
      }

      // ── the state change: a real gated mutation, not a fixture swap ────────
      await repair(ruleId, elementId, 1);

      // ── after ─────────────────────────────────────────────────────────────
      expect(openFor(ruleId)).toEqual([]);

      for (const { view, marker } of GAP_IN_VIEW[ruleId]) {
        const after = render(view);
        expect(mentions(after, elementId), `${view} lost the row for ${elementId} instead of completing it`).toBe(true);
        expect(markedUids(after, marker), `${view} still flags ${elementId}`).toEqual([]);
      }
    });
  }

  it('the four findings are the ONLY reason those four rules fire — otherwise the equality above is luck', async () => {
    // Guards the fixture, not the product: if a later edit adds a second R-22
    // element, every "== [elementId]" above would still pass for the wrong reason
    // right up until it fails confusingly.
    for (const { ruleId, elementId } of GATE_FINDINGS) expect(openFor(ruleId)).toEqual([elementId]);
  });

  it('T-B1 follow-up — on a REAL graph the open rules lose the ones that were repaired, and gain none', async () => {
    const offeneRegeln = (): string[] => [...new Set(harness.evaluateRules().map((v) => v.ruleId))].sort();

    const before = offeneRegeln();
    for (const { ruleId } of GATE_FINDINGS) expect(before, `${ruleId} is not open before the repair`).toContain(ruleId);

    let seq = 1;
    for (const { ruleId, elementId } of GATE_FINDINGS) await repair(ruleId, elementId, seq++);

    const after = offeneRegeln();
    for (const { ruleId } of GATE_FINDINGS) expect(after, `${ruleId} still open after its repair`).not.toContain(ruleId);
    // MONOTONE, not "exactly four rules less". Measured: allocating FUNC-audit into
    // MOD-parsing (R-22) also cleared MT-01, because the module's instability dropped
    // back under the judging threshold. That is a real second-order effect of a
    // structural edit, and demanding "only the target rule moved" would assert
    // something false about the model. What must hold is that repairing opens NOTHING new.
    expect(after.filter((r) => !before.includes(r)), 'the repairs opened new rules').toEqual([]);
  });

  it('T-B1 follow-up — focusTypes stay read off the measurement in BOTH states', async () => {
    const step = () =>
      generationStep(harness.getGraph(), harness.getMetricPolicy(), 'steering reference system', harness.getFocusThreshold(), []);

    const check = (label: string): void => {
      const s = step();
      expect(s.focusKey, `${label}: no focus although findings are open`).toBeTruthy();
      // focusTypes is not free text — it is what the rule clause declares, or failing
      // that the focus STAGE (CR-GC-566, CR-GC-757 — the fixture helper still names the key head `dimension`: the clause wins, same precedence as the
      // imperative in CR-GC-564).
      const regel = s.focusKey!.split(':')[1];
      expect(s.focusTypes, `${label}: focusTypes drifted from its declared source`).toEqual(
        RULE_CLAUSE[regel]?.types ?? STAGE_FOCUS_TYPES[parseFocusKey(s.focusKey!).dimension],
      );
    };

    check('before');
    let seq = 1;
    for (const { ruleId, elementId } of GATE_FINDINGS) await repair(ruleId, elementId, seq++);
    check('after');
  });
});

/**
 * CR-GC-744 (contracts CR-SM-392): R-26 ist erst gestellt, wenn die Realisierung begonnen hat. Die
 * Kopplung „im Dokument markiert = am Gate offen" muss auch im Entwurf gelten — sonst zeigt das ICD an
 * jedem SCHEMA eine Warnung, die keine Regel haelt. POSITIVKONTROLLE: dieselben SCHEMAs, sobald eine
 * Bindung im Graphen steht.
 */
describe('T-B4 im Entwurf: das ICD markiert R-26 nur, wo die Regel gestellt ist', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  const MARKER = GAP_IN_VIEW['R-26'][0].marker;
  const r26 = (): string[] => harness.evaluateRules().filter((v) => v.ruleId === 'R-26').map((v) => v.elementId ?? '').sort();
  const icd = (): string => exportMarkdown(harness.getGraph(), 'icd', 'entwurf');

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-artifact-entwurf-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeSteeringConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph({
      elements: [
        { id: 'SYS-e', type: 'SYS', name: 'Entwurf', description: 'Ein System im Entwurf.' },
        { id: 'SCHEMA-a', type: 'SCHEMA', name: 'A', description: 'Vertrag A.' },
        { id: 'SCHEMA-b', type: 'SCHEMA', name: 'B', description: 'Vertrag B.' },
      ],
      traces: [],
    });
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('Entwurf: keine R-26 am Gate, keine R-26-Marke im ICD — die Zeile sagt „noch nicht gebunden"', () => {
    expect(r26()).toEqual([]);
    const md = icd();
    expect(mentions(md, 'SCHEMA-a')).toBe(true);
    expect(markedUids(md, MARKER)).toEqual([]);
    expect(markedUids(md, 'noch nicht gebunden (Entwurf)')).toEqual(['SCHEMA-a', 'SCHEMA-b']);
  });

  it('nach der ersten Bindung: das andere SCHEMA ist am Gate offen UND im ICD markiert', async () => {
    const res = await harness.mutate([
      { op: 'update-node', node: { uid: 'SCHEMA-a', type: 'SCHEMA', attributes: { realRef: { file: 'src/a.ts', symbol: 'A' } } } },
    ]);
    expect(res.success).toBe(true);
    expect(r26()).toEqual(['SCHEMA-b']);
    expect(markedUids(icd(), MARKER)).toEqual(['SCHEMA-b']);
  });
});
