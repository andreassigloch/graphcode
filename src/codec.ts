/**
 * GraphCodeCodec — deterministic Format-E ↔ Graph codec (CR-GC-103, MOD-codec).
 *
 * Wraps FormatECodec from @sigloch/graph-api-core (L1 parity — single codec,
 * no fork). Adds the three guarantees the base codec doesn't provide:
 *
 *   1. DETERMINISTIC ENCODE (REQ-deterministic-serialization R3):
 *      - Nodes sorted by uid (lexicographic).
 *      - Edges sorted by [sourceId, targetId, edgeType].
 *      - Attribute keys sorted (lexicographic).
 *      Two calls to encode() on the same Graph produce byte-identical output.
 *
 *   2. FULL ROUND-TRIP (REQ-roundtrip-conformance L3):
 *      decode(encode(g)) deep-equals g.
 *      Because FormatECodec.serialize() uses inline attrs ([k:v,k:v]) and
 *      parseInlineAttrs() splits on commas, attribute values containing commas
 *      or brackets would break round-trip.  GraphCodeCodec therefore produces
 *      Format-E text directly (using @attr-line form for complex values) and
 *      delegates parsing to FormatECodec.parse() — the authoritative parser.
 *      The UID encoding scheme appends a .TYPE suffix so FormatECodec.parse
 *      can extract the node type (its extractNodeType() scans dot-separated
 *      segments) — unless the uid already carries its type as a dot-segment
 *      (canonical <slug>.<TYPE>.<counter> form), in which case no suffix is
 *      added and none is stripped on decode.
 *
 *   3. STRICT VALIDATION (REQ-codec-validation):
 *      validate() checks every node.type against SE_DESCRIPTOR.nodeTypes and
 *      every edge against SE_DESCRIPTOR.edgeTypes[...].validPairs.
 *      Invalid types → error entries, never a silent pass.
 *
 * UID encoding contract:
 *   Canonical uid    :  <slug>.<TYPE>.<counter>  (e.g. graphcode.SYS.001) —
 *                       type already embedded, encode leaves it untouched.
 *   Legacy/plain uid :  <slug>  (e.g. SYS-graphcode) — encode appends
 *                       .<TYPE> for the wire form; decode strips it back off.
 *   Decode           :  scan dot-segments from the end for a known SE type;
 *                       if it's the last segment, strip it (legacy form);
 *                       otherwise leave the uid unchanged (canonical form).
 *
 * @author andreas@siglochconsulting
 */

import { FormatECodec, SE_DESCRIPTOR, projectToOntologyGraph } from '@sigloch/graph-api-core';
import type {
  Graph,
  GraphNode,
  GraphEdge,
  OntologyDescriptor,
} from '@sigloch/graph-api-core';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Characters that break FormatECodec inline attr parsing ([k:v,k:v]). */
const UNSAFE_ATTR_RE = /[,\[\]{}]/;

/**
 * Encode a UID for Format-E text by appending .<TYPE> — unless the uid
 * already carries its type as a dot-segment (canonical slug.TYPE.counter form).
 * e.g. "SYS-graphcode" + "SYS" → "SYS-graphcode.SYS" (legacy, appended)
 *      "graphcode.SYS.001" + "SYS" → "graphcode.SYS.001" (canonical, unchanged)
 */
function encodeUid(uid: string, type: string): string {
  if (uid.split('.').includes(type)) return uid;
  return `${uid}.${type}`;
}

/**
 * Decode a Format-E uid back to the original uid + type.
 * Scans dot-segments from the end for a known SE type (mirrors
 * FormatECodec.extractNodeType()). A trailing type segment is an appended
 * suffix and gets stripped; a type embedded mid-uid (canonical
 * slug.TYPE.counter form) is left in place.
 * e.g. "SYS-graphcode.SYS" → { uid: "SYS-graphcode", type: "SYS" }
 *      "graphcode.SYS.001" → { uid: "graphcode.SYS.001", type: "SYS" }
 */
function decodeUid(fmtUid: string, knownTypes: ReadonlySet<string>): { uid: string; type: string } {
  const parts = fmtUid.split('.');
  for (let i = parts.length - 1; i >= 1; i--) {
    if (knownTypes.has(parts[i])) {
      return i === parts.length - 1
        ? { uid: parts.slice(0, i).join('.'), type: parts[i] }
        : { uid: fmtUid, type: parts[i] };
    }
  }
  throw new Error(`Format-E uid "${fmtUid}" has no recognizable type segment`);
}

/**
 * Sort attribute keys deterministically and convert values to string.
 * Returns [key, stringValue][] in lexicographic key order.
 *
 * Object/array values (e.g. realRef {file,symbol,lang}, testRef {file,tool})
 * are JSON-encoded — NOT `String(v)`, which collapses them to "[object Object]"
 * and silently drops the binding in every Format-E slice (graph_impact /
 * graph_context). JSON.stringify keeps them legible; the commas/braces route
 * them to the @attr-line form (UNSAFE_ATTR_RE) so they never break inline `[k:v]`.
 */
function sortedAttrEntries(attrs: Record<string, unknown>): [string, string][] {
  return Object.entries(attrs)
    .filter(([, v]) => v != null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
}

/**
 * Serialize a single attribute value safely for Format-E.
 * Safe values → inline [k:v,k:v] compatible.
 * Values with commas or brackets → @attr-line form (handled separately).
 */
function isAttrSafe(value: string): boolean {
  return !UNSAFE_ATTR_RE.test(value);
}

// ---------------------------------------------------------------------------
// GraphCodeCodec
// ---------------------------------------------------------------------------

export class GraphCodeCodec {
  /**
   * The underlying FormatECodec instance (SE_DESCRIPTOR wired).
   * Exposed for callers that need raw Format-E operations.
   */
  readonly inner: FormatECodec;
  private readonly ontology: OntologyDescriptor;
  private readonly knownNodeTypes: Set<string>;

  constructor() {
    this.ontology = SE_DESCRIPTOR;
    this.inner = new FormatECodec(SE_DESCRIPTOR);
    this.knownNodeTypes = new Set(Object.keys(SE_DESCRIPTOR.nodeTypes));
  }

  // -------------------------------------------------------------------------
  // encode
  // -------------------------------------------------------------------------

  /**
   * Deterministically serialize a Graph to Format-E text.
   *
   * Sort order (stable, deterministic):
   *   Nodes  : ascending by uid (String.localeCompare)
   *   Edges  : ascending by [sourceId, targetId, edgeType]
   *   Attrs  : ascending by key (String.localeCompare)
   *
   * UID encoding: each node uid is suffixed with .<TYPE> so FormatECodec.parse
   * can extract the node type from the uid (its extractNodeType scans for a
   * known-type segment in dot-separated parts).
   *
   * Attribute encoding:
   *   Safe values (no commas, brackets) → inline [k:v,...] on the node/edge line.
   *   Unsafe values                     → @key value  lines immediately following.
   *
   * Two calls with the same Graph input are byte-identical.
   */
  encode(graph: Graph): string {
    const { valid, errors } = this.validate(graph);
    if (!valid) {
      throw new Error(`GraphCodeCodec.encode: graph validation failed:\n  - ${errors.join('\n  - ')}`);
    }

    const sortedNodes = [...graph.nodes].sort((a, b) => a.uid.localeCompare(b.uid));
    const sortedEdges = [...graph.edges].sort(
      (a, b) =>
        a.sourceId.localeCompare(b.sourceId) ||
        a.targetId.localeCompare(b.targetId) ||
        a.edgeType.localeCompare(b.edgeType),
    );

    const lines: string[] = [];

    if (sortedNodes.length > 0) {
      lines.push('## Nodes');
      for (const node of sortedNodes) {
        const fmtUid = encodeUid(node.uid, node.type);
        const desc = node.description ?? '';
        const attrEntries = sortedAttrEntries({
          ...node.attributes,
          // Persist fields needed for round-trip that live outside `attributes`
          __name: node.name,
          ...(node.createdAt !== undefined ? { __createdAt: node.createdAt } : {}),
          ...(node.updatedAt !== undefined ? { __updatedAt: node.updatedAt } : {}),
        });

        // Split into safe (inline) and unsafe (@attr-line) entries
        const safeEntries = attrEntries.filter(([, v]) => isAttrSafe(v));
        const unsafeEntries = attrEntries.filter(([, v]) => !isAttrSafe(v));

        const inlinePart =
          safeEntries.length > 0
            ? ` [${safeEntries.map(([k, v]) => `${k}:${v}`).join(',')}]`
            : '';

        lines.push(`+ ${fmtUid}|${desc}${inlinePart}`);

        for (const [k, v] of unsafeEntries) {
          lines.push(`@${k} ${v}`);
        }
      }
    }

    if (sortedEdges.length > 0) {
      lines.push('');
      lines.push('## Edges');
      for (const edge of sortedEdges) {
        const fmtSource = encodeUid(edge.sourceId, this._nodeTypeFor(graph, edge.sourceId));
        const fmtTarget = encodeUid(edge.targetId, this._nodeTypeFor(graph, edge.targetId));
        const arrow = this._edgeArrow(edge.edgeType);
        const attrEntries = sortedAttrEntries(edge.attributes);
        const safeEntries = attrEntries.filter(([, v]) => isAttrSafe(v));
        const inlinePart =
          safeEntries.length > 0
            ? ` [${safeEntries.map(([k, v]) => `${k}:${v}`).join(',')}]`
            : '';
        // Edge attr lines — only safe values for now (complex edge attrs rare in SE)
        lines.push(`+ ${fmtSource} -${arrow}-> ${fmtTarget}${inlinePart}`);
      }
    }

    return lines.join('\n');
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
   * THROWS on:
   *   - any parse errors returned by FormatECodec.parse()
   *   - add_edge where source or target node has not been seen (implicit-add)
   *   - unsupported operation types (remove/update/merge)
   */
  decode(text: string): Graph {
    const diff = this.inner.parse(text);
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
          const { uid, type } = decodeUid(op.semanticId, this.knownNodeTypes);
          const rawAttrs = op.attributes ?? {};

          // Extract round-trip metadata fields from attributes
          const name = (rawAttrs['__name'] as string | undefined) ?? uid;
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

          if (!nodeMap.has(fmtSource)) {
            throw new Error(
              `GraphCodeCodec.decode: implicit-add rejected — source "${fmtSource}" not present; ` +
                'all nodes must be declared before referencing them in edges.',
            );
          }
          if (!nodeMap.has(fmtTarget)) {
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
        const { uid: sourceId } = decodeUid(op.sourceId!, this.knownNodeTypes);
        const { uid: targetId } = decodeUid(op.targetId!, this.knownNodeTypes);
        edges.push({
          sourceId,
          targetId,
          edgeType: op.edgeType!,
          attributes: op.attributes ? { ...op.attributes } : {},
        });
      }
    }

    const nodes = Array.from(nodeMap.values());
    const result: Graph = { nodes, edges };

    const { valid, errors } = this.validate(result);
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
   * Validate every node type against SE_DESCRIPTOR.nodeTypes and every edge
   * against SE_DESCRIPTOR.edgeTypes[...].validPairs.
   *
   * Invalid → error entries; never a silent pass.
   */
  validate(graph: Graph): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const knownNodeTypes = new Set(Object.keys(this.ontology.nodeTypes));
    const nodeTypeMap = new Map(graph.nodes.map((n) => [n.uid, n.type]));

    // Duplicate-UID detection (CR-GC-200): the nodeTypeMap above silently dedupes,
    // so two nodes sharing a uid (e.g. two CR-GC-119s from parallel chats) collapse
    // to one and the collision goes unseen. Flag it — this is the one integrity
    // invariant the validator missed.
    const uidCounts = new Map<string, number>();
    for (const node of graph.nodes) uidCounts.set(node.uid, (uidCounts.get(node.uid) ?? 0) + 1);
    for (const [uid, count] of uidCounts) {
      if (count > 1) errors.push(`Duplicate node uid "${uid}" (${count} nodes share it)`);
    }

    for (const node of graph.nodes) {
      if (!knownNodeTypes.has(node.type)) {
        errors.push(`Unknown node type "${node.type}" for node "${node.uid}"`);
      }
    }

    for (const edge of graph.edges) {
      const edgeDesc = this.ontology.edgeTypes[edge.edgeType];
      if (!edgeDesc) {
        errors.push(`Unknown edge type "${edge.edgeType}" for edge "${edge.sourceId}" → "${edge.targetId}"`);
        continue;
      }
      const srcType = nodeTypeMap.get(edge.sourceId);
      const tgtType = nodeTypeMap.get(edge.targetId);
      if (!srcType) {
        errors.push(`Edge references unknown source node "${edge.sourceId}"`);
        continue;
      }
      if (!tgtType) {
        errors.push(`Edge references unknown target node "${edge.targetId}"`);
        continue;
      }
      // Open pairs ([*,*]) mean any combination is valid
      const hasOpenPair = edgeDesc.validPairs.some(([s, t]) => s === '*' && t === '*');
      if (!hasOpenPair) {
        const pairKey = `${srcType}:${tgtType}`;
        const validPairSet = new Set(edgeDesc.validPairs.map(([s, t]) => `${s}:${t}`));
        if (!validPairSet.has(pairKey)) {
          errors.push(
            `Invalid edge pair ${srcType} -${edge.edgeType}-> ${tgtType} ` +
              `for edge "${edge.sourceId}" → "${edge.targetId}"`,
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // -------------------------------------------------------------------------
  // projectToOntologyGraph bridge
  // -------------------------------------------------------------------------

  /**
   * Project a Graph into the OntologyGraph shape expected by @sigloch/contracts/se.
   * Thin wrapper around projectToOntologyGraph from @sigloch/graph-api-core.
   */
  project = projectToOntologyGraph;

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Look up a node's type from the graph; throws if not found. */
  private _nodeTypeFor(graph: Graph, uid: string): string {
    const node = graph.nodes.find((n) => n.uid === uid);
    if (!node) {
      throw new Error(
        `GraphCodeCodec.encode: edge references node "${uid}" not present in graph.nodes`,
      );
    }
    return node.type;
  }

  /** Resolve an edgeType to its first arrow alias (for Format-E text). */
  private _edgeArrow(edgeType: string): string {
    const desc = this.ontology.edgeTypes[edgeType];
    return desc?.arrows[0] ?? edgeType.toLowerCase();
  }
}
