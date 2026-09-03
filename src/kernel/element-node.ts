/**
 * element-node.ts — das eine Import-Mapping: SSOT-Element (JSON) → Store-Knoten.
 *
 * Bis CR-GC-479 lag `elementToNode` im Exporter (`projections/exporter.ts`), obwohl es
 * die UMKEHRUNG des Exports ist und vom Import-Pfad des Kerns (`harness-import.ts`)
 * gebraucht wird — der Kern importierte die Projektion. Geteilt von
 * `harness.importGraph` und `scripts/export-graph.mjs` (über das Barrel) — kein
 * paralleler Pfad.
 *
 * @author andreas@siglochconsulting
 */
import type { GraphNode } from '@sigloch/graph-api-core';

/**
 * Flatten the redundant double-nested `attributes` artifact (CR-GC-219). A committed
 * element that carries a literal `attributes` object lands it as `node.attributes.attributes`
 * (the `...rest` spread nests it). This merges that object UP one level — preserving real
 * metadata (operatingMode / constraint / …) as top-level attributes — while
 * DROPPING `level`/`tool` that merely restate one of the element's `testRefs` (redundant), an empty
 * `{}`, and the nesting key itself. Idempotent: an element with no nested `attributes` is
 * returned unchanged, so re-import/export never reintroduces the nesting.
 */
function flattenNestedAttributes(rest: Record<string, unknown>): Record<string, unknown> {
  const nested = rest.attributes;
  if (nested === null || typeof nested !== 'object' || Array.isArray(nested)) return rest;
  const { attributes: _drop, ...top } = rest;
  // CR-GC-338: `testRefs` ist eine Liste — redundant ist ein Wert nur, wenn IRGENDEIN
  // Eintrag ihn schon traegt. Gegen den ersten zu pruefen loeschte bei gemischten Runnern
  // (vitest + playwright) den falschen.
  const testRefs = Array.isArray(top.testRefs) ? (top.testRefs as Record<string, unknown>[]) : [];
  const out: Record<string, unknown> = { ...top };
  for (const [k, v] of Object.entries(nested as Record<string, unknown>)) {
    // Drop level/tool that merely restate a runnable binding (testRefs) — redundant.
    if ((k === 'level' || k === 'tool') && testRefs.some((r) => r && r[k] === v)) continue;
    // Flatten up one level; never clobber an existing top-level attribute.
    if (!(k in out)) out[k] = v;
  }
  return out;
}

/**
 * Map a committed OntologyGraph JSON element to a `GraphNode` (the inverse of `nodeToElement`),
 * flattening the nested `attributes` artifact (CR-GC-219). The single import mapping — shared by
 * `harness.importGraph` and `scripts/export-graph.mjs` (no parallel path).
 */
export function elementToNode(e: Record<string, unknown>): GraphNode {
  const { id, type, name, description, ...rest } = e as {
    id: string;
    type: string;
    name?: string;
    description?: string;
    [k: string]: unknown;
  };
  return {
    uid: id,
    type,
    name: name ?? id,
    description: description ?? '',
    attributes: flattenNestedAttributes(rest),
  };
}
