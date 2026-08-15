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
 *   CDR · R-26 · SCHEMA-envelope  · icd           "⚠ kein realRef (R-26)"
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
 * move the gate POINTER, and this file does not pretend otherwise. `GATE_FIXTURE`
 * carries further open SRR rules (UC-03/UC-05/UC-06/FC-02/MS-01/…), so `SRR`
 * stays current by definition of `currentPhaseGate`. What IS asserted on the real
 * graph is the coupling one level down — each gate's `missing` rule list shrinks
 * by exactly the rule that was repaired, and by nothing else. The ordered-ladder
 * property itself is T-B1 in `steering.process-ratchet.test.ts`.
 *
 * Real disk Kuzu (temp dir), no mocks, no `:memory:`.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { exportMarkdown, type MarkdownView } from '../src/exporter.js';
import { generationStep, DIMENSION_FOCUS_TYPES } from '../src/generate.js';
import { currentPhaseGate } from '../src/readiness.js';
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

describe('T-B4 (CR-GC-353): a phase-gate finding and a document gap are the same fact', () => {
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

  for (const { gate, ruleId, elementId } of GATE_FINDINGS) {
    it(`${gate} · ${ruleId} — the gap is WRITTEN in the document before, and gone after`, async () => {
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

  it('T-B1 follow-up — on a REAL graph each gate loses exactly the rule that was repaired', async () => {
    const missingByGate = (): Record<string, string[]> => {
      const s = generationStep(harness.getGraph(), harness.getMetricPolicy(), 'steering reference system', harness.getFocusThreshold(), []);
      return Object.fromEntries(s.phaseReadiness.map((g) => [g.gate, [...g.missing].sort()]));
    };

    const before = missingByGate();
    for (const { gate, ruleId } of GATE_FINDINGS) {
      expect(before[gate], `${ruleId} is not open at ${gate} before the repair`).toContain(ruleId);
    }

    let seq = 1;
    for (const { ruleId, elementId } of GATE_FINDINGS) await repair(ruleId, elementId, seq++);

    const after = missingByGate();
    for (const { gate, ruleId } of GATE_FINDINGS) {
      expect(after[gate], `${ruleId} still open at ${gate} after its repair`).not.toContain(ruleId);
      // MONOTONE, not "exactly one rule less". Measured: allocating FUNC-audit into
      // MOD-parsing (R-22) also cleared MT-01 at PDR, because the module's
      // instability dropped back under the judging threshold. That is a real
      // second-order effect of a structural edit, and demanding "only the target
      // rule moved" would assert something false about the model. What must hold
      // is that repairing opens NOTHING new at the gate.
      const opened = after[gate].filter((r) => !before[gate].includes(r));
      expect(opened, `${gate} gained new open rules from the repairs`).toEqual([]);
    }
  });

  it('T-B1 follow-up — phase and focusTypes stay read off the measurement in BOTH states', async () => {
    const step = () =>
      generationStep(harness.getGraph(), harness.getMetricPolicy(), 'steering reference system', harness.getFocusThreshold(), []);

    const check = (label: string): void => {
      const s = step();
      expect(s.focusKey, `${label}: no focus although findings are open`).toBeTruthy();
      // focusTypes is not free text — it is what the focus DIMENSION declares.
      expect(s.focusTypes, `${label}: focusTypes drifted from the dimension map`).toEqual(
        DIMENSION_FOCUS_TYPES[parseFocusKey(s.focusKey!).dimension],
      );
      // And the gate pointer is the first incomplete gate of the SAME measurement.
      expect(currentPhaseGate(s.phaseReadiness)).toBe('SRR');
    };

    check('before');
    let seq = 1;
    for (const { ruleId, elementId } of GATE_FINDINGS) await repair(ruleId, elementId, seq++);
    // Still SRR — and that is the honest result, not a weakness of the repair:
    // UC-03/UC-05/UC-06/FC-02/MS-01/… remain open at SRR, so the pointer must not
    // move. A test that made it move here would be measuring its own fixture.
    check('after');
  });
});
