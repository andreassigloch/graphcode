/**
 * New-member bootstrap through the gate (CR-GC-122, FUNC-import / REQ-bootstrap-through-gate).
 *
 * Fills the EMPTY graph of a NEW family member exclusively through the
 * `mutate()` Apply-Gate (L1) — the source is UNGOVERNED Format-E text
 * (e.g. graphify/slicer output, FLOW-bulk-formatE), NOT a direct write.
 *
 *   Format-E text → formatEToCommands()  ← DERSELBE Weg wie graph_mutate (CR-GC-630)
 *                 → MutateCommand[] (Knoten → Kanten → Merges → Loeschen)
 *                 → harness.mutate()  ← the ONE gate (REQ-one-gate-per-repo, L1)
 *                 → BootstrapResult (filled graph + violations report)
 *
 * ── Distinction from seedFromJson()/importGraph() (NOT a parallel path) ─────────
 *   harness.seedFromJson()/importGraph() are a DIRECT LOAD of the ALREADY
 *   GOVERNED, committed SSOT (graphcode's own graph, which carries legacy
 *   R-01 debt). That load MUST stay direct: routed through the gate it would
 *   BLOCK, because against an empty baseline graph every legacy violation would
 *   count as "newly introduced" (see the delta semantics in harness.mutate).
 *
 *   bootstrap() is the SECOND, separate path: UNGOVERNED foreign input MUST pass
 *   through the gate, so cold-start data lands governed or is reported/blocked.
 *   Both operations are needed and semantically different — do not merge them.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import type { MutateResult } from '@sigloch/contracts/harness';
import { MutateResultSchema } from '@sigloch/contracts/harness';
import { GraphCodeHarness } from '../kernel/harness.js';
import { formatEToCommands } from '../loop/format-e-commands.js';

/**
 * BootstrapResult (FLOW-bootstrap-result → SCHEMA-mutate-result): the gate
 * result (MutateResult) plus the count of nodes/edges fed in. MutateResult is
 * imported from @sigloch/contracts/harness — NOT redefined; only the
 * app-specific wrapper is local (schema-first).
 */
export const BootstrapResultSchema = z.object({
  /** Apply-Gate result (success/tier/violations/…) — the one gate (L1). */
  result: MutateResultSchema,
  /** Nodes parsed from the Format-E input (volume in, before the gate verdict). */
  nodes: z.number().int().nonnegative(),
  /** Edges parsed from the Format-E input (volume in, before the gate verdict). */
  edges: z.number().int().nonnegative(),
  /**
   * CR-GC-630: uids, deren Knotenzeile kein `__name` trug — ihr Name ist die uid geworden.
   * Derselbe Hinweis, den `graph_mutate` seit CR-GC-321 gibt; der Kaltstart schwieg bis hier.
   */
  unnamed: z.array(z.string()),
});
export type BootstrapResult = z.infer<typeof BootstrapResultSchema>;

/** Cold-start mode for a new member graph. */
export type BootstrapMode = 'replace' | 'merge';

/**
 * Minimal template of a GATE-VALID cold-start graph for a new member.
 *
 * Structure (all nodes + edges land in ONE gate batch):
 *   SYS  -compose-> REQ     (R-17: SYS is not empty)
 *   REQ  <-verify-  TEST     (R-01: REQ is verified — error otherwise)
 *   REQ  <-satisfy- MOD      (RD-01: REQ is resolved, not a leaf)
 *
 * With this, neither an error- nor a warning-rule fires: `harness.mutate()`
 * returns success=true with tier='auto-apply' on an empty disk Kuzu graph.
 *
 * Format-E v2: `### <TYPE>` sections, uids
 * verbatim (CR-GC-269), `__name` attr.
 */
export const TEMPLATE_FORMAT_E = [
  '## Nodes',
  '### MOD',
  '+ MOD-template|Module that satisfies the template requirement [__name:Template module]',
  '### REQ',
  // contracts 9.x: MOD -satisfy-> REQ verlangt strukturelle kinds am REQ (where-Prädikat).
  '+ REQ-template-root|First requirement of the new member graph [__name:Template root requirement]',
  '@kinds ["non-functional"]',
  '### SYS',
  '+ SYS-template|Cold-start system of a new family member [__name:Template system]',
  '### TEST',
  '+ TEST-template-root|Verifies the template root requirement [__name:Template root test]',
  '',
  '## Edges',
  // CR-GC-625: die Zielseite ist eine LISTE. Das Template ist fuer viele Mitglieder die erste
  // Format-E-Zeile, die sie ueberhaupt sehen — es zeigt die Gruppierung an der einen Quelle, die
  // hier zwei Ziele hat, statt sie auseinanderzuschreiben.
  '+ SYS-template -compose-> REQ-template-root, MOD-template',
  '+ MOD-template -satisfy-> REQ-template-root',
  '+ TEST-template-root -verify-> REQ-template-root',
].join('\n');

/**
 * Fill a (typically empty) member graph through the Apply-Gate from Format-E text.
 *
 * @param harness  Disk Kuzu harness of the new member (NEVER :memory:).
 * @param formatE  UNGOVERNED Format-E text (graphify/slicer output or template).
 * @param mode     Cold-start: 'replace'|'merge' both reduce to pure adds (the
 *                 graph is empty). Replace-on-nonempty (delete-then-add) is OUT
 *                 OF SCOPE for MVP-1 — cold-start is the only path here.
 *
 * Throws on Format-E parse errors (the parser surfaces them). Rule violations
 * are NOT thrown: they are the governed gate verdict in the result
 * (success=false, tier='block', e.g. R-01) — the graph then stays unchanged.
 */
export async function bootstrap(
  harness: GraphCodeHarness,
  formatE: string,
  mode: BootstrapMode = 'replace',
): Promise<BootstrapResult> {
  void mode; // Cold-start: both modes = pure adds (see @param).

  // 1. Text → MutateCommand[] — DIESELBE Funktion, die `graph_mutate` fuehrt (CR-GC-630).
  //    Sie ordnet selbst in vier Phasen (Knoten → Kanten → Merges → Loeschen) und wirft auf
  //    Parse-Fehler, unbekannte Endpunkte und Typkonflikte.
  const { commands, unnamed } = formatEToCommands(harness.getGraph(), formatE);

  // 3. Through the ONE gate (L1) — no direct write. On newly introduced
  //    error-violations the gate blocks and persists nothing.
  const result: MutateResult = await harness.mutate(commands);

  return {
    result,
    nodes: commands.filter((c) => c.op === 'add-node' || c.op === 'update-node' || c.op === 'delete-node').length,
    edges: commands.filter((c) => c.op === 'add-edge' || c.op === 'delete-edge' || c.op === 'update-edge').length,
    unnamed,
  };
}
