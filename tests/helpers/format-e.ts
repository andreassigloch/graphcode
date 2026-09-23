/**
 * helpers/format-e.ts — was ein Format-E-Text SAGT, fuer Zusicherungen in Tests (CR-GC-631).
 *
 * Bis CR-GC-631 fragten 13 Teststellen dasselbe ueber die geloeschte Wrapper-Klasse: sie bauten
 * aus dem Text einen ganzen Graphen, nur um danach eine uid-Liste oder eine Kantenzahl zu
 * pruefen. Die Klasse ist gefallen; dieser Helfer ist NICHT ihr Umzug:
 *
 *   - er PROJIZIERT die Parser-Operationen, er rekonstruiert keinen Graphen,
 *   - er prueft keine Typen, loest keine Endpunkte auf, kennt keine Merges und kein `~`/`-`,
 *   - er liegt in `tests/helpers/` wie `store.ts` und ist aus `src/` nicht erreichbar.
 *
 * Wer einen Graphen aus Text will, schickt ihn durchs Gate — das ist der eine Weg.
 *
 * @author andreas@siglochconsulting
 */

import { FORMAT_E_CODEC } from '../../src/surface/format-e-commands.js';

/** Ein Knoten, so wie die Zeile ihn nennt — ohne jede Rekonstruktion. */
export interface KnotenZeile {
  uid: string;
  type?: string;
  name?: string;
  description?: string;
  attributes: Record<string, unknown>;
  /** Die Attribute UNGEFILTERT, samt `__name`/`__createdAt`/`__updatedAt` — fuer den Rundlauf. */
  roh: Record<string, unknown>;
}

/** Eine Kante, so wie die Zeile sie nennt. */
export interface KantenZeile {
  sourceId: string;
  targetId: string;
  edgeType: string;
  attributes: Record<string, unknown>;
}

/** Wie `formatEToCommands` auch: `resolveType` typisiert uids, die der TEXT nicht deklariert. */
export interface LeseOptionen {
  resolveType?: (uid: string) => string | undefined;
}

function operationen(text: string, optionen?: LeseOptionen) {
  const diff = FORMAT_E_CODEC.parse(text, optionen?.resolveType ? { resolveType: optionen.resolveType } : undefined);
  if (diff.errors.length > 0) {
    throw new Error(`Format-E parse errors:\n  - ${diff.errors.join('\n  - ')}`);
  }
  return diff.operations;
}

/** Die Knotenzeilen des Textes, in Textreihenfolge. */
export function knotenAus(text: string, optionen?: LeseOptionen): KnotenZeile[] {
  return operationen(text, optionen)
    .filter((op) => op.type === 'add_node' || op.type === 'strict_add_node')
    .map((op) => {
      const roh = (op.attributes ?? {}) as Record<string, unknown>;
      const attributes = Object.fromEntries(Object.entries(roh).filter(([k]) => !k.startsWith('__')));
      return {
        uid: op.semanticId,
        ...(op.elementType !== undefined ? { type: op.elementType } : {}),
        ...(roh['__name'] !== undefined ? { name: roh['__name'] as string } : {}),
        ...(op.description !== undefined ? { description: op.description } : {}),
        attributes,
        roh,
      };
    });
}

/** Die Kantenzeilen des Textes, Fan-out bereits aufgefaltet (der Parser tut das). */
export function kantenAus(text: string, optionen?: LeseOptionen): KantenZeile[] {
  return operationen(text, optionen)
    .filter((op) => op.type === 'add_edge' || op.type === 'strict_add_edge')
    .map((op) => ({
      sourceId: op.sourceId!,
      targetId: op.targetId!,
      edgeType: op.edgeType!,
      attributes: (op.attributes ?? {}) as Record<string, unknown>,
    }));
}
