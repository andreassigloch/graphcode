/**
 * executor-task.ts — der Abschluss eines Analyse-Tasks im Executor (CR-GC-724).
 *
 * Die Rechnung steht rein in task-artifact.ts; hier ist nur die Registry-Seite: den Graphen lesen
 * und den Stempel durch dasselbe Gate schreiben wie jeden anderen Zug. Das Modell sieht den Stempel
 * nicht und setzt ihn nicht — er ist die Feststellung des Executors, dass das Artefakt steht.
 *
 * @author andreas@siglochconsulting
 */
import type { MCPToolRegistry } from '../kernel/tool-contract.js';
import { abschluss, artefakte, stempelZug, STEMPEL_ID, type AnalyseTask, type TaskGraph } from './task-artifact.js';

export interface TaskZustand {
  task: AnalyseTask;
  /** Die Einheiten, die schon vor dem Task im Graphen standen. */
  bestand: ReadonlySet<string>;
  /** Einheitenzahl bei der letzten Prüfung — `undefined`, solange noch nicht geprüft wurde. */
  gezaehlt: number | undefined;
  gestempelt: boolean;
}

export interface TaskStempel {
  task: AnalyseTask;
  einheiten: string[];
  graphVersion: number;
}

type Knoten = { uid: string; type: string; attributes?: Record<string, unknown> };
type Kante = { sourceId: string; targetId: string; edgeType: string; attributes?: Record<string, unknown> };

async function lies(registry: MCPToolRegistry): Promise<{ graph: TaskGraph; sys: Knoten | undefined; graphVersion: number }> {
  const elemente = registry['graph_elements'];
  const kanten = registry['graph_get_edges'];
  const e = (await elemente.handler(elemente.inputSchema.parse({ limit: 1_000_000 }))) as { nodes?: Knoten[]; graphVersion: number };
  const k = (await kanten.handler(kanten.inputSchema.parse({}))) as { edges?: Kante[] };
  const nodes = e.nodes ?? [];
  return {
    graph: {
      nodes: nodes.map((n) => ({ id: n.uid, type: n.type, attributes: n.attributes })),
      edges: (k.edges ?? []).map((x) => ({
        source: x.sourceId,
        type: x.edgeType,
        target: x.targetId,
        label: typeof x.attributes?.label === 'string' ? x.attributes.label : undefined,
      })),
    },
    sys: nodes.find((n) => n.type === 'SYS'),
    graphVersion: e.graphVersion,
  };
}

const stempelVon = (sys: Knoten | undefined): Record<string, unknown> =>
  (sys?.attributes?.analysisFreshness as Record<string, unknown> | undefined) ?? {};

/** Der Stand vor dem Task: was schon da ist, zählt bei conops/irr nicht als Ertrag des Tasks. */
export async function beginneTask(registry: MCPToolRegistry, task: AnalyseTask): Promise<TaskZustand> {
  const { graph, sys } = await lies(registry);
  return {
    task,
    bestand: new Set(artefakte(task, graph)),
    gezaehlt: undefined,
    gestempelt: stempelVon(sys)[STEMPEL_ID[task]] !== undefined,
  };
}

/**
 * Prüft vor jedem Schritt, ob das Artefakt steht, und setzt dann den Stempel. `null` = (noch) nicht.
 * Ein abgelehnter Stempel-Zug ist ein Fehler des Executors, kein Zustand, über den man hinweggeht.
 */
export async function schliesseTaskWennErfuellt(registry: MCPToolRegistry, z: TaskZustand): Promise<TaskStempel | null> {
  if (z.gestempelt) return null;
  const { graph, sys, graphVersion } = await lies(registry);
  const urteil = abschluss(z.task, graph, z.bestand, z.gezaehlt);
  z.gezaehlt = urteil.einheiten.length;
  if (!urteil.fertig || !sys) return null;
  // Der Stempel nennt die Version NACH diesem Zug: ein Batch hebt graphVersion um genau eins.
  const version = graphVersion + 1;
  const mutate = registry['graph_mutate'];
  const res = (await mutate.handler(
    mutate.inputSchema.parse({
      formatE: stempelZug(z.task, sys.uid, stempelVon(sys), version, urteil.einheiten),
      baseVersion: graphVersion,
      consumerId: 'graphcode-executor',
    }),
  )) as { success: boolean; violations?: unknown };
  if (!res.success) {
    throw new Error(`Task ${z.task}: der Stempel-Zug wurde abgelehnt — ${JSON.stringify(res.violations).slice(0, 400)}`);
  }
  z.gestempelt = true;
  return { task: z.task, einheiten: urteil.einheiten, graphVersion: version };
}
