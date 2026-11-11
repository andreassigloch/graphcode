/**
 * se-plan — graph-derived implementation-plan ordering (CR-GC-209).
 *
 * The testable core behind the generative `se-plan` skill: derive a build order
 * from the model's `depends-on` dependency DAG (a `relation` edge whose
 * `attributes.label === 'depends-on'`, e.g. MS→MS milestone dependencies). The
 * skill (`.claude/skills/se-plan.md`) reasons over the graph and writes the
 * MS/CR/relation nodes through the gate; THIS function is the deterministic
 * ordering spec the test pins (and the eventual core of an out-of-scope
 * server-side `graph_plan` tool). It is NOT a parallel renderer — the view `docs/views/implplan.md`
 * RENDERS an existing plan; this DERIVES the order.
 *
 * A plan must (a) respect every `depends-on` (a prerequisite precedes its
 * dependent), (b) refuse to silently order a cycle, and (c) surface a
 * "forward dependency" — a lower-numbered item that depends on a higher-numbered
 * one, where naive id-order would violate the dependency.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import type { Graph, GraphEdge } from '@sigloch/graph-api-core';

/**
 * Die REQ-Deckung des Plans (CR-GC-550) — die Zahl, die der Plan ueber sich selbst schuldet.
 *
 * `leaf` ist die Grundgesamtheit: jedes REQ ohne `compose`→REQ-Kind, dieselbe wie bei RD-01 und
 * CR-SM-343 (ein Elter wird ueber seine Kinder gedeckt). `covered` sind die, die einen Bauauftrag
 * haben, `uncovered` der Rest — und `uncovered` ist die eigentliche Aussage: **ist sie nicht leer,
 * ist der Plan nicht fertig.**
 */
export interface ReqCoverage {
  /** Alle Blatt-REQ des Graphen, uid-sortiert. */
  leaf: string[];
  /** Die davon beauftragten. */
  covered: string[];
  /** Die ohne Bauauftrag — nicht leer heisst: der Plan ist nicht fertig. */
  uncovered: string[];
}

export interface ImplPlanResult {
  /** Topo-sorted uids — every `depends-on` respected (prerequisite before dependent). */
  order: string[];
  /** Dependency cycles (each a uid list) — unorderable, must be broken before building. */
  cycles: string[][];
  /**
   * `depends-on` edges where a lower-numbered item depends on a higher-numbered one
   * (the forward-dependency anomaly: building in id-order would violate the dependency).
   */
  forwardViolations: Array<{ from: string; to: string }>;
  /** Welche Blatt-REQ einen Bauauftrag haben — die Vollstaendigkeitsaussage des Plans (CR-GC-550). */
  reqCoverage: ReqCoverage;
}

const DEPENDS_ON = 'depends-on';

/** A `depends-on` dependency edge: `relation` + `label: 'depends-on'`, or the bare edgeType. */
function isDependsOn(e: GraphEdge): boolean {
  return (
    e.edgeType === DEPENDS_ON ||
    (e.edgeType === 'relation' && (e.attributes as { label?: string })?.label === DEPENDS_ON)
  );
}

/** The last run of digits in a uid (`CR-GC-209` → 209), for forward-dependency detection. */
function idNum(uid: string): number | null {
  const m = uid.match(/(\d+)(?!.*\d)/);
  return m ? Number(m[1]) : null;
}


/**
 * CR-GC-550 — die Deckung zaehlt ueber REQ, nicht ueber FUNC-Blaetter.
 *
 * Der Befund, aus dem dieser Code kommt (Fremdlauf sigllm, 17./18.09.): `se-plan` leitete 22
 * Bauauftraege aus 20 FUNC-Blaettern ab und meldete "20 von 20 geordnet, keine Zyklen" — eine
 * Vollstaendigkeitsaussage ueber die Menge, die er sich selbst gewaehlt hatte. Im selben
 * Graphstand hatten 40 von 64 Blatt-REQ einen Bauauftrag; die uebrigen 24 milderten alle 16
 * offenen FM-03-Risiken. Die Sortierung war korrekt. Falsch war die GRUNDMENGE.
 *
 * Die Deckungsdefinition ist woertlich die von CR-SM-343 — ein Blatt-REQ ist beauftragt, wenn
 *   (a) ein CR eine `relation` DIREKT darauf traegt, oder
 *   (b) ein CR eine `relation` auf ein FUNC oder FCHAIN traegt, das dieses REQ `satisfy`t.
 *
 * **MOD und SYS zaehlen nicht**, und das ist die tragende Entscheidung, nicht ein Detail: rechnet
 * man sie mit, liest dieselbe Stelle am selben Graphstand 55 von 64 statt 40 von 64 und sieht
 * gesund aus, waehrend 24 REQ keinen Auftrag haben. Ein Modul ist ein Behaelter; dass ein CR es
 * beruehrt, sagt nichts ueber die Anforderung, die daran haengt. Die Konvention, die daraus folgt:
 * ein Bauauftrag fuer ein REQ an einem MOD- oder SYS-Traeger traegt seine `relation` DIREKT auf
 * das REQ.
 *
 * Weicht diese Rechnung von der Regel in contracts ab, ist die Zahl wieder zwei Wahrheiten.
 */
function computeReqCoverage(graph: Pick<Graph, 'nodes' | 'edges'>): ReqCoverage {
  const typeOf = new Map(graph.nodes.map((n) => [n.uid, n.type]));

  // Grundgesamtheit: Blatt-REQ. Ein REQ mit compose→REQ-Kindern wird ueber die Kinder gedeckt.
  const hatReqKind = new Set<string>();
  for (const e of graph.edges) {
    if (e.edgeType === 'compose' && typeOf.get(e.sourceId) === 'REQ' && typeOf.get(e.targetId) === 'REQ') {
      hatReqKind.add(e.sourceId);
    }
  }
  const leaf = graph.nodes
    .filter((n) => n.type === 'REQ' && !hatReqKind.has(n.uid))
    .map((n) => n.uid)
    .sort();

  // Was ein CR beruehrt. `depends-on` ist eine REIHENFOLGE-Kante, kein Umfang — sonst zaehlte
  // eine CR→CR-Abhaengigkeit als Bauauftrag fuer alles, was am anderen CR haengt.
  const beauftragt = new Set<string>();
  for (const e of graph.edges) {
    if (e.edgeType !== 'relation' || isDependsOn(e)) continue;
    if (typeOf.get(e.sourceId) === 'CR') beauftragt.add(e.targetId);
  }

  const gedeckt = new Set<string>(leaf.filter((uid) => beauftragt.has(uid))); // (a) direkt
  for (const e of graph.edges) {
    // (b) ueber den Traeger — und NUR ueber FUNC/FCHAIN.
    if (e.edgeType !== 'satisfy') continue;
    const traegerTyp = typeOf.get(e.sourceId);
    if (traegerTyp !== 'FUNC' && traegerTyp !== 'FCHAIN') continue;
    if (!beauftragt.has(e.sourceId)) continue;
    if (typeOf.get(e.targetId) === 'REQ') gedeckt.add(e.targetId);
  }

  return {
    leaf,
    covered: leaf.filter((uid) => gedeckt.has(uid)),
    uncovered: leaf.filter((uid) => !gedeckt.has(uid)),
  };
}

/**
 * Derive the build order from the graph's `depends-on` DAG. `source depends-on target`
 * means target is the prerequisite (target precedes source). Deterministic: the
 * zero-indegree frontier is drained in uid order, so a given graph always yields the
 * same plan.
 */
export function deriveImplPlan(graph: Pick<Graph, 'nodes' | 'edges'>): ImplPlanResult {
  const deps = graph.edges.filter(isDependsOn);

  const involved = new Set<string>();
  for (const e of deps) {
    involved.add(e.sourceId);
    involved.add(e.targetId);
  }

  // Edge target → source (prerequisite points at its dependents); indegree on dependents.
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const uid of involved) {
    adj.set(uid, []);
    indeg.set(uid, 0);
  }
  for (const e of deps) {
    adj.get(e.targetId)!.push(e.sourceId);
    indeg.set(e.sourceId, (indeg.get(e.sourceId) ?? 0) + 1);
  }

  // Kahn topological sort, deterministic frontier order.
  const order: string[] = [];
  const frontier = [...involved].filter((u) => indeg.get(u) === 0).sort();
  while (frontier.length) {
    const u = frontier.shift()!;
    order.push(u);
    for (const v of [...(adj.get(u) ?? [])].sort()) {
      indeg.set(v, (indeg.get(v) ?? 0) - 1);
      if (indeg.get(v) === 0) {
        frontier.push(v);
        frontier.sort();
      }
    }
  }

  // Anything never emitted sits in a cycle — reported, never silently ordered.
  const emitted = new Set(order);
  const cyclic = [...involved].filter((u) => !emitted.has(u)).sort();
  const cycles = cyclic.length ? [cyclic] : [];

  // Forward dependency: source depends-on a higher-numbered target.
  const forwardViolations = deps
    .filter((e) => {
      const a = idNum(e.sourceId);
      const b = idNum(e.targetId);
      return a !== null && b !== null && a < b;
    })
    .map((e) => ({ from: e.sourceId, to: e.targetId }))
    .sort((x, y) => x.from.localeCompare(y.from) || x.to.localeCompare(y.to));

  return { order, cycles, forwardViolations, reqCoverage: computeReqCoverage(graph) };
}

/** Ergebnis von `crGroups` (CR-GC-896): Gruppen in Reihenfolge, und die CRs, die ein Zyklus sperrt. */
export const CrGroupsSchema = z.object({
  groups: z.array(z.array(z.string()).min(1)),
  cyclic: z.array(z.string()),
});
export type CrGroups = z.infer<typeof CrGroupsSchema>;

/**
 * CR-GC-896 — welche offenen CRs eines Meilensteins gleichzeitig laufen duerfen.
 *
 * Gemessen in immo-infra: Subagenten liefen einmal, erst auf Nachfrage; ein Zug kostete dort 96 k
 * Token Kontext, in der Hauptsitzung 203 k. se-plan schnitt die CRs, sagte aber nicht, welche
 * unabhaengig sind — also arbeitete die Sitzung sie nacheinander ab.
 *
 * Zwei CRs duerfen nicht in dieselbe Gruppe, wenn einer vom anderen abhaengt (`depends-on`,
 * auch ueber Zwischenglieder im selben Meilenstein) oder wenn sie eine Datei teilen. Die Dateien
 * eines CR sind die `realRef`-Dateien dessen, worauf er eine `relation` traegt, und bei einer REQ die
 * ihrer Traeger (`satisfy`). Ein CR ohne bekannte Datei teilt keine.
 *
 * Ergebnis: Gruppen in Reihenfolge. Gruppe n+1 beginnt, wenn Gruppe n fertig ist; innerhalb einer
 * Gruppe laufen die CRs gleichzeitig. Deterministisch: Abhaengigkeit legt die fruehste Gruppe fest,
 * dann nimmt jeder CR in uid-Reihenfolge die erste Gruppe ab dort ohne gemeinsame Datei.
 */
export function crGroups(
  graph: Pick<Graph, 'nodes' | 'edges'>,
  crIds: readonly string[],
): CrGroups {
  const byId = new Map(graph.nodes.map((n) => [n.uid, n]));
  const ids = [...crIds].sort();
  const inSet = new Set(ids);

  const fileOf = (uid: string): string | undefined => {
    const n = byId.get(uid) as { attributes?: { realRef?: { file?: string } } } | undefined;
    return n?.attributes?.realRef?.file;
  };
  const carriers = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.edgeType !== 'satisfy') continue;
    carriers.set(e.targetId, [...(carriers.get(e.targetId) ?? []), e.sourceId]);
  }
  const files = new Map<string, Set<string>>(ids.map((id) => [id, new Set<string>()]));
  const prereq = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of graph.edges) {
    if (!inSet.has(e.sourceId)) continue;
    if (isDependsOn(e)) {
      if (inSet.has(e.targetId)) prereq.get(e.sourceId)!.push(e.targetId);
      continue;
    }
    if (e.edgeType !== 'relation') continue;
    const own = files.get(e.sourceId)!;
    for (const t of [e.targetId, ...(byId.get(e.targetId)?.type === 'REQ' ? carriers.get(e.targetId) ?? [] : [])]) {
      const f = fileOf(t);
      if (f) own.add(f);
    }
  }

  // Fruehste Gruppe je CR: eins nach der spaetesten Voraussetzung. Ein CR in einem Zyklus oder hinter
  // einem bekommt keine Gruppe und steht unter `cyclic` — er wird nicht still eingeordnet.
  const earliest = new Map<string, number>();
  const visiting = new Set<string>();
  const level = (id: string): number => {
    const known = earliest.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return Number.POSITIVE_INFINITY;
    visiting.add(id);
    const l = Math.max(-1, ...prereq.get(id)!.map(level)) + 1;
    visiting.delete(id);
    earliest.set(id, l);
    return l;
  };
  for (const id of ids) level(id);
  const cyclic = ids.filter((id) => earliest.get(id) === Number.POSITIVE_INFINITY);

  const groups: string[][] = [];
  const groupFiles: Set<string>[] = [];
  const groupOf = new Map<string, number>();
  const orderable = ids.filter((id) => !cyclic.includes(id));
  for (const id of orderable.sort((a, b) => level(a) - level(b) || a.localeCompare(b))) {
    let g = Math.max(level(id), ...prereq.get(id)!.map((p) => groupOf.get(p)! + 1));
    while (g < groups.length && [...files.get(id)!].some((f) => groupFiles[g]!.has(f))) g += 1;
    while (groups.length <= g) {
      groups.push([]);
      groupFiles.push(new Set());
    }
    groups[g]!.push(id);
    for (const f of files.get(id)!) groupFiles[g]!.add(f);
    groupOf.set(id, g);
  }
  // Der Erzeuger prueft seinen Vertrag selbst (keine leere Gruppe).
  return CrGroupsSchema.parse({ groups: groups.filter((g) => g.length > 0), cyclic });
}
