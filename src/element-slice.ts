/**
 * element-slice.ts — die gefilterte Element-Scheibe aus dem Store (MOD-element-slice).
 *
 * Herausgelöst aus `GraphCodeHarness` (CR-GC-388). Der Grund ist gemessen, nicht
 * gefühlt: die Kohäsions-Metrik MT-02 rechnet über die zugeteilten FUNC eines MOD
 * und fand `FUNC-list-elements` als eigene Komponente — sie teilt mit dem Gate weder
 * einen FLOW noch eine REQ. Sie liest den Store und filtert; sie mutiert nichts,
 * hooked nichts, persistiert nichts.
 *
 * REQ-query-precision: eine Scheibe, nie ein Volldump — die Auswahl trifft der
 * Aufrufer über `type`/`search`, nicht ein Kompressor hinterher.
 *
 * @author andreas@siglochconsulting
 */
import type { StorageAdapter, GraphNode } from '@sigloch/graph-api-core';
import type { HarnessConfig } from '@sigloch/contracts/harness';

/** Filter einer Scheibe: Knotentyp und/oder Substring über uid, name, description. */
export interface ElementFilter {
  type?: string;
  search?: string;
}

/** Knoten aus dem Kuzu-Store, gefiltert (REQ-query-precision: Scheibe, nie Volldump). */
export async function listElements(
  storage: StorageAdapter,
  scope: HarnessConfig['scope'],
  filter: ElementFilter,
): Promise<GraphNode[]> {
  const { nodes } = await storage.loadGraph(scope);
  let result = nodes;
  if (filter.type) result = result.filter((n) => n.type === filter.type);
  if (filter.search) {
    const q = filter.search.toLowerCase();
    result = result.filter(
      (n) =>
        n.uid.toLowerCase().includes(q) ||
        n.name.toLowerCase().includes(q) ||
        (n.description ?? '').toLowerCase().includes(q),
    );
  }
  return result;
}
