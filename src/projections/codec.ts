/**
 * GraphCodeCodec — Format-E ↔ Graph für graphcode (CR-GC-103, MOD-codec).
 *
 * SEIT CR-GC-536 EINE DÜNNE SCHICHT über FormatECodec aus @sigloch/graph-api-core.
 * Alle drei Zusicherungen, die hier bis dahin nachgebaut waren, trägt jetzt der eine
 * Codec selbst (sigloch-modules CR-SM-332, graph-api-core 5.6.0):
 *
 *   1. DETERMINISTISCHES ENCODE (REQ-deterministic-serialization R3) — Knoten je
 *      `### <TYPE>`-Sektion nach uid, Kanten nach [sourceId, edgeType, targetId],
 *      Attributschlüssel nach Code-Einheiten. Zwei encode-Läufe sind bytegleich.
 *   2. VOLLER RUNDLAUF (REQ-roundtrip-conformance L3) — `serialize(g, {roundTrip:true})`
 *      schreibt die Felder neben `attributes` mit (`__name`/`__createdAt`/`__updatedAt`)
 *      und schickt jeden Wert mit Komma oder Klammer auf eine `@key`-Zeile, statt den
 *      Inline-Block zu brechen. decode(encode(g)) deep-equals g.
 *   3. STRENGE PRÜFUNG (REQ-codec-validation) — `validate()` prüft Knoten- und
 *      Kantentypen gegen die Ontologie, doppelte uids und auflösbare Endpunkte.
 *      Paar-Legalität bleibt R-18 (CR-GC-531).
 *
 * WARUM DIESE KLASSE BLEIBT: sie bindet SE_DESCRIPTOR fest und trägt die
 * graphcode-eigene Rekonstruktion in `decode` — aus dem Operations-Diff des Parsers
 * wieder einen Graph zu bauen, samt `onUnnamed` (CR-GC-321) und der
 * Implicit-Add-Ablehnung (CR-GC-310). Erzeugt wird hier nichts mehr.
 *
 * UID-Vertrag (Format-E v2, CR-GC-269): uids reisen unverändert in beide Richtungen;
 * der Typ steht einmal je `### <TYPE>`-Sektion.
 *
 * @author andreas@siglochconsulting
 */

import { FormatECodec, SE_DESCRIPTOR, projectToOntologyGraph } from '@sigloch/graph-api-core';
import type { Graph, GraphNode, GraphEdge } from '@sigloch/graph-api-core';

/**
 * CR-GC-269: `encodeUid`/`decodeUid` are gone. Their only job was to smuggle the type
 * into the uid so the parser could scan it back out. Format-E v2 (sigloch-modules
 * CR-SM-216) declares the type in the `### <TYPE>` section, so the uid travels
 * unchanged in both directions — and the parallel encoding path with it.
 */

// ---------------------------------------------------------------------------
// GraphCodeCodec
// ---------------------------------------------------------------------------

export class GraphCodeCodec {
  /**
   * The underlying FormatECodec instance (SE_DESCRIPTOR wired).
   * Exposed for callers that need raw Format-E operations.
   */
  readonly inner: FormatECodec;

  constructor() {
    this.inner = new FormatECodec(SE_DESCRIPTOR);
  }

  // -------------------------------------------------------------------------
  // encode
  // -------------------------------------------------------------------------

  /**
   * Serialize a Graph to Format-E text — DELEGATION, keine eigene Erzeugung (CR-GC-536).
   *
   * `roundTrip: true` ist genau die Fassung, die hier bis CR-GC-536 nachgebaut war:
   * Sortierung (Typ-Sektion, uid, Kanten, Attributschlüssel), die Felder neben
   * `attributes` (`__name`/`__createdAt`/`__updatedAt`), der immer gesetzte Pipe und
   * die Prüfung vor dem Schreiben. Zwei Läufe auf demselben Graphen sind bytegleich
   * (REQ-deterministic-serialization), decode(encode(g)) deep-equals g
   * (REQ-roundtrip-conformance).
   *
   * Wirft, wenn der Graph ungültig ist oder eine Beschreibung einen Zeilenumbruch
   * trägt — der Umbruch erzeugte bis CR-SM-332 still einen PHANTOM-KNOTEN.
   */
  encode(graph: Graph): string {
    return this.inner.serialize(graph, { roundTrip: true });
  }

  // -------------------------------------------------------------------------
  // decode
  // -------------------------------------------------------------------------

  /**
   * Parse Format-E text produced by encode() back into a Graph.
   *
   * Delegates parsing to FormatECodec.parse() (the authoritative parser).
   * Then reconstructs Graph by applying operations to an empty state:
   *   add_node / strict_add_node → add node
   *   add_edge / strict_add_edge → add edge (rejects implicit-add if source/target missing)
   *
   * CR-GC-310: `options.resolveType` types uids the TEXT does not declare. A batch that
   * only adds edges between nodes the store already holds carries no `## Nodes` block —
   * without a resolver that is an error, with one it resolves against the caller's store.
   * The boundary is deliberate: **resolve what exists, invent nothing.** An unknown uid
   * still throws (a typo must not become a new node), and a type the text declares that
   * CONTRADICTS the store is an error too — never a silent retype.
   *
   * THROWS on:
   *   - any parse errors returned by FormatECodec.parse()
   *   - add_edge where source or target is neither declared here nor resolvable
   *   - a declared node type that conflicts with the resolver's type for that uid
   *   - unsupported operation types (remove/update/merge)
   */
  decode(
    text: string,
    options?: {
      resolveType?: (uid: string) => string | undefined;
      /**
       * CR-GC-321: called with every uid whose node line carried NO `__name`.
       * The decoder is the only place that knows this exactly — after decode the
       * fallback `name = uid` is indistinguishable from a deliberately equal name.
       */
      onUnnamed?: (uid: string) => void;
    },
  ): Graph {
    const resolveType = options?.resolveType;
    const diff = this.inner.parse(text, resolveType ? { resolveType } : undefined);
    if (diff.errors.length > 0) {
      throw new Error(
        `GraphCodeCodec.decode: parse errors:\n  - ${diff.errors.join('\n  - ')}`,
      );
    }

    const nodeMap = new Map<string, GraphNode>(); // fmtUid → GraphNode

    for (const op of diff.operations) {
      switch (op.type) {
        case 'add_node':
        case 'strict_add_node': {
          // CR-GC-269: uid verbatim, type from the parser's `### <TYPE>` section.
          const uid = op.semanticId;
          const type = op.elementType;
          if (!type) {
            throw new Error(
              `GraphCodeCodec.decode: node "${uid}" carries no type — Format-E v2 declares it in a "### <TYPE>" section`,
            );
          }
          // CR-GC-310: the text declares a type AND the store knows one — if they
          // disagree, that is an authoring error, not an update. Silently preferring
          // either side would retype a node through an additive batch.
          const storeType = resolveType?.(uid);
          if (storeType !== undefined && storeType !== type) {
            throw new Error(
              `GraphCodeCodec.decode: node "${uid}" is declared as "${type}" but exists as ` +
                `"${storeType}" — a type conflict is an error, not a silent retype.`,
            );
          }
          const rawAttrs = op.attributes ?? {};

          // Extract round-trip metadata fields from attributes
          const rawName = rawAttrs['__name'] as string | undefined;
          if (rawName === undefined) options?.onUnnamed?.(uid);
          const name = rawName ?? uid;
          const createdAt = rawAttrs['__createdAt'] as string | undefined;
          const updatedAt = rawAttrs['__updatedAt'] as string | undefined;

          // Remaining attributes (drop private __ fields)
          const attributes: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(rawAttrs)) {
            if (!k.startsWith('__')) {
              attributes[k] = v;
            }
          }

          const node: GraphNode = {
            uid,
            type,
            name,
            description: op.description,
            attributes,
            ...(createdAt !== undefined ? { createdAt } : {}),
            ...(updatedAt !== undefined ? { updatedAt } : {}),
          };
          nodeMap.set(op.semanticId, node);
          break;
        }

        case 'add_edge':
        case 'strict_add_edge': {
          // sourceId / targetId in op are the Format-E UIDs (with .TYPE suffix)
          const fmtSource = op.sourceId!;
          const fmtTarget = op.targetId!;

          // CR-GC-310: an endpoint counts as present when this text declares it OR the
          // caller's store resolves it. Everything else stays the implicit-add rejection.
          const known = (uid: string): boolean => nodeMap.has(uid) || resolveType?.(uid) !== undefined;
          if (!known(fmtSource)) {
            throw new Error(
              `GraphCodeCodec.decode: implicit-add rejected — source "${fmtSource}" not present; ` +
                'all nodes must be declared before referencing them in edges.',
            );
          }
          if (!known(fmtTarget)) {
            throw new Error(
              `GraphCodeCodec.decode: implicit-add rejected — target "${fmtTarget}" not present; ` +
                'all nodes must be declared before referencing them in edges.',
            );
          }

          // Edge is tracked lazily; we build the edge list after all ops
          // Store temporarily using semanticId as key
          break;
        }

        case 'remove_node':
        case 'remove_edge':
        case 'update_node':
        case 'merge_nodes':
          throw new Error(
            `GraphCodeCodec.decode: operation "${op.type}" is not supported for Graph reconstruction. ` +
              'Only add_node, strict_add_node, add_edge, strict_add_edge are valid in encode output.',
          );

        default:
          throw new Error(`GraphCodeCodec.decode: unknown operation type "${(op as { type: string }).type}"`);
      }
    }

    // Second pass: reconstruct edges (after all nodes confirmed present)
    const edges: GraphEdge[] = [];
    for (const op of diff.operations) {
      if (op.type === 'add_edge' || op.type === 'strict_add_edge') {
        edges.push({
          sourceId: op.sourceId!,
          targetId: op.targetId!,
          edgeType: op.edgeType!,
          attributes: op.attributes ? { ...op.attributes } : {},
        });
      }
    }

    const nodes = Array.from(nodeMap.values());
    const result: Graph = { nodes, edges };

    const { valid, errors } = this.validate(result, resolveType);
    if (!valid) {
      throw new Error(
        `GraphCodeCodec.decode: decoded graph failed validation:\n  - ${errors.join('\n  - ')}`,
      );
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // validate
  // -------------------------------------------------------------------------

  /**
   * Knoten- und Kantentypen gegen die Ontologie, doppelte uids, auflösbare Endpunkte —
   * DELEGATION an den einen Codec (CR-GC-536). Paar-Legalität wird hier nicht beurteilt:
   * das ist R-18, dort wo Daten in den Speicher gehen (CR-GC-531).
   *
   * `resolveType` (CR-GC-310) typisiert Endpunkte, die dieser Graph nicht trägt — ein
   * Batch aus reinen Kanten löst seine Endpunkte damit gegen den Speicher des Aufrufers auf.
   */
  validate(
    graph: Graph,
    resolveType?: (uid: string) => string | undefined,
  ): { valid: boolean; errors: string[] } {
    return this.inner.validate(graph, resolveType);
  }

  // -------------------------------------------------------------------------
  // projectToOntologyGraph bridge
  // -------------------------------------------------------------------------

  /**
   * Project a Graph into the OntologyGraph shape expected by @sigloch/contracts/se.
   * Thin wrapper around projectToOntologyGraph from @sigloch/graph-api-core.
   */
  project = projectToOntologyGraph;
}
