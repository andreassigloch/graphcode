/**
 * New-Member Bootstrap durchs Gate (CR-GC-122, FUNC-import / REQ-bootstrap-through-gate).
 *
 * Befüllt den LEEREN Graphen eines NEUEN Familie-Mitglieds ausschließlich über
 * das `mutate()`-Apply-Gate (L1) — Quelle ist UNGOVERNTER Format-E-Text
 * (z.B. graphify/Slicer-Output, FLOW-bulk-formatE), KEIN Direct-Write.
 *
 *   Format-E text → GraphCodeCodec.decode() → Graph
 *                 → MutateCommand[] (alle add-node ZUERST, dann add-edge)
 *                 → harness.mutate()  ← das EINE Gate (REQ-one-gate-per-repo, L1)
 *                 → BootstrapResult (befüllter Graph + Violations-Report)
 *
 * ── Abgrenzung zu seedFromJson()/importGraph() (KEIN paralleler Pfad) ──────────
 *   harness.seedFromJson()/importGraph() sind ein DIRECT-LOAD des BEREITS
 *   GOVERNTEN, committeten SSOT (graphcodes eigener 226-Element-Graph, der ~63
 *   Alt-R-01-Schulden trägt). Dieser Load MUSS direkt bleiben: durchs Gate
 *   geroutet würde er BLOCKEN, weil gegen einen leeren Baseline-Graphen alle 63
 *   Alt-Violations „neu eingeführt" wären (siehe Delta-Semantik in harness.mutate).
 *
 *   bootstrap() ist der ZWEITE, separate Pfad: UNGOVERNTER Fremd-Input MUSS durchs
 *   Gate, damit Cold-Start-Daten governt landen oder berichtet/geblockt werden.
 *   Beide Operationen sind nötig und semantisch verschieden — nicht zusammenführen.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import type { Graph } from '@sigloch/graph-api-core';
import type { MutateCommand, MutateResult } from '@sigloch/contracts/harness';
import { MutateResultSchema } from '@sigloch/contracts/harness';
import { GraphCodeHarness } from './harness.js';
import { GraphCodeCodec } from './codec.js';

/**
 * BootstrapResult (FLOW-bootstrap-result → SCHEMA-mutate-result): das
 * Gate-Ergebnis (MutateResult) plus die Zahl der eingespeisten Knoten/Kanten.
 * MutateResult wird aus @sigloch/contracts/harness importiert — NICHT neu
 * definiert; nur die app-spezifische Hülle ist lokal (Schema-First).
 */
export const BootstrapResultSchema = z.object({
  /** Apply-Gate-Ergebnis (success/tier/violations/…) — das eine Gate (L1). */
  result: MutateResultSchema,
  /** Aus dem Format-E geparste Knoten (Eingabe-Volumen, vor Gate-Verdikt). */
  nodes: z.number().int().nonnegative(),
  /** Aus dem Format-E geparste Kanten (Eingabe-Volumen, vor Gate-Verdikt). */
  edges: z.number().int().nonnegative(),
});
export type BootstrapResult = z.infer<typeof BootstrapResultSchema>;

/** Cold-Start-Modus für einen neuen Member-Graphen. */
export type BootstrapMode = 'replace' | 'merge';

/**
 * Minimal-Template eines GATE-VALIDEN Cold-Start-Graphen für ein neues Mitglied.
 *
 * Struktur (alle Knoten + Kanten landen in EINEM Gate-Batch):
 *   SYS  -compose-> REQ     (R-17: SYS ist nicht leer)
 *   REQ  <-verify-  TEST     (R-01: REQ ist verifiziert — error sonst)
 *   REQ  <-satisfy- MOD      (RD-01: REQ ist aufgelöst, kein Leaf)
 *
 * Damit feuert weder eine error- noch eine warning-Regel: `harness.mutate()`
 * gibt auf einem leeren Disk-Kuzu-Graphen success=true mit tier='auto-apply'.
 *
 * Format-E entspricht der GraphCodeCodec-Kodierung (uid.TYPE-Suffix, __name-Attr).
 */
export const TEMPLATE_FORMAT_E = [
  '## Nodes',
  '+ MOD-template.MOD|Module that satisfies the template requirement [__name:Template module]',
  '+ REQ-template-root.REQ|First requirement of the new member graph [__name:Template root requirement]',
  '+ SYS-template.SYS|Cold-start system of a new family member [__name:Template system]',
  '+ TEST-template-root.TEST|Verifies the template root requirement [__name:Template root test]',
  '',
  '## Edges',
  '+ MOD-template.MOD -satisfy-> REQ-template-root.REQ',
  '+ SYS-template.SYS -compose-> REQ-template-root.REQ',
  '+ TEST-template-root.TEST -verify-> REQ-template-root.REQ',
].join('\n');

/**
 * Befülle einen (typ. leeren) Member-Graphen durchs Apply-Gate aus Format-E-Text.
 *
 * @param harness  Disk-Kuzu-Harness des neuen Mitglieds (NIE :memory:).
 * @param formatE  UNGOVERNTER Format-E-Text (graphify/Slicer-Output o. Template).
 * @param mode     Cold-Start: 'replace'|'merge' reduzieren auf reine Adds (der
 *                 Graph ist leer). Replace-on-nonempty (delete-then-add) ist für
 *                 MVP-1 OUT OF SCOPE — Cold-Start ist der einzige Pfad hier.
 *
 * Wirft bei Format-E-Parsefehlern (Codec.decode surfaced sie). Rule-Violations
 * dagegen werden NICHT geworfen: sie sind das governte Gate-Verdikt im Result
 * (success=false, tier='block', z.B. R-01) — der Graph bleibt dann unverändert.
 */
export async function bootstrap(
  harness: GraphCodeHarness,
  formatE: string,
  mode: BootstrapMode = 'replace',
): Promise<BootstrapResult> {
  void mode; // Cold-Start: beide Modi = reine Adds (siehe @param).

  // 1. Parse: Format-E → Graph (autoritativer Parser; throws bei Parsefehlern).
  const codec = new GraphCodeCodec();
  const graph: Graph = codec.decode(formatE);

  // 2. Konvertiere zu MutateCommand[]: ERST alle Knoten, DANN alle Kanten.
  //    Endpunkte, die im selben Batch angelegt werden, sind ok — das Gate wendet
  //    die Commands in Reihenfolge an, bevor es die Regeln auswertet.
  const commands: MutateCommand[] = [
    ...graph.nodes.map(
      (n): MutateCommand => ({
        op: 'add-node',
        node: {
          uid: n.uid,
          type: n.type,
          name: n.name,
          description: n.description ?? '',
          attributes: n.attributes ?? {},
        },
      }),
    ),
    ...graph.edges.map(
      (e): MutateCommand => ({
        op: 'add-edge',
        edge: {
          sourceId: e.sourceId,
          targetId: e.targetId,
          edgeType: e.edgeType,
          attributes: e.attributes ?? {},
        },
      }),
    ),
  ];

  // 3. Durchs EINE Gate (L1) — kein Direct-Write. Bei neu eingeführten
  //    error-Violations blockt das Gate und persistiert nichts.
  const result: MutateResult = await harness.mutate(commands);

  return {
    result,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
  };
}
