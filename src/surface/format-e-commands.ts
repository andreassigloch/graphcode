/**
 * format-e-commands.ts — der EINE Weg von Format-E-Text zu `MutateCommand[]` (CR-GC-630).
 *
 * Bis hierher war diese Abbildung eine Closure in `bindWriteTools`. Genau deshalb konnte
 * `bootstrap()` sie nicht rufen und trug bis CR-GC-630 ihren Vorgaenger weiter:
 * `decode() → Graph → add-node/add-edge`. Ein Graph kann „diese Knoten existieren"
 * ausdruecken, nicht „diesen loeschen" — der Kaltstart kannte die Sprache deshalb nur halb.
 * Als gewoehnliche Funktion hat sie zwei Aufrufer und keinen Zwilling.
 *
 * @author andreas@siglochconsulting
 */

import { FormatECodec, SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { Graph } from '@sigloch/graph-api-core';
import type { MutateCommand } from '@sigloch/contracts/harness';

/**
 * Die EINE Format-E-Instanz des Prozesses. `FormatECodec` traegt keinen Zustand ueber den
 * Aufruf hinaus — eine zweite Instanz waere kein Fehler, aber eine zweite Stelle, an der
 * jemand einen anderen Deskriptor unterschieben koennte.
 */
export const FORMAT_E_CODEC = new FormatECodec(SE_DESCRIPTOR);

/**
 * Format-E-Block → MutateCommands (CR-GC-276, CR-GC-627, CR-GC-630). Ein Input-Codec, KEIN zweiter Schreibweg.
 *
 * CR-GC-627 — die PARSER-OPS werden direkt abgebildet, statt den Umweg über die
 * Graph-Rekonstruktion zu nehmen. Der Umweg ueber eine Graph-Rekonstruktion baute aus dem Operations-Diff
 * eine Menge `{nodes, edges}`, und ein Graph kann „diese Knoten existieren" ausdrücken, nicht
 * „diesen löschen" — jedes Nicht-Add-Op endete deshalb im Wurf. Die Beschränkung war
 * graphcodes eigene, keine Eigenschaft der Sprache: bis auf `update-edge` ist die Abbildung
 * Präfix → `MutateCommand` eins zu eins.
 *
 * CR-GC-630 — `bootstrap()` ruft dieselbe Funktion. Damit hatte die Rekonstruktion keinen
 * Aufrufer mehr, und CR-GC-631 hat sie samt ihrer Wrapper-Klasse geloescht.
 *
 * Was hier geprüft wird, weil `decode()` es prüfte:
 *   - Knotentyp vorhanden (`### <TYPE>`-Sektion) und NICHT im Widerspruch zum Speicher,
 *   - Endpunkte einer Kante hier deklariert ODER im Speicher auflösbar (Implicit-Add-Ablehnung,
 *     CR-GC-310) — eine unbekannte uid ist ein Tippfehler, kein neuer Knoten.
 * Knoten- und Kantentypen gegen die Ontologie prüft der Parser selbst (unbekannte Sektion,
 * unbekannter Pfeil = Parse-Fehler); Paar-Legalität ist R-18 am Gate.
 *
 * CR-GC-321: `unnamed` trägt die uids, deren Zeile kein `__name` hatte — exakt aus dem
 * Operations-Diff, nicht aus `name === uid` erraten (das träfe auch bewusst gleichnamige
 * technische Knoten). Nur `+`: bei `~` ist ein fehlender Name keine Aussage, sondern der
 * Patch-Normalfall.
 */
export function formatEToCommands(
  bestand: Graph,
  text: string,
): { commands: MutateCommand[]; unnamed: string[] } {
  // CR-GC-310: Typen bestehender Knoten kommen aus dem geladenen Graphen — dieselbe
  // Quelle, aus der das Gate ohnehin liest, kein zweiter Index. Damit braucht ein
  // reiner Kanten-Batch keine `### <TYPE>`-Sektionen mehr.
  const typeIndex = new Map(bestand.nodes.map((n) => [n.uid, n.type]));
  const resolveType = (uid: string): string | undefined => typeIndex.get(uid);
  const diff = FORMAT_E_CODEC.parse(text, { resolveType });
  if (diff.errors.length > 0) {
    throw new Error(`Format-E parse errors:\n  - ${diff.errors.join('\n  - ')}`);
  }

  const unnamed: string[] = [];
  /** Knoten, die DIESER Block anlegt — Endpunkt-Auflösung und Batch-Widerspruch lesen sie. */
  const angelegt = new Set<string>();
  const geloeschteKnoten = new Set<string>();
  const geloeschteKanten = new Set<string>();
  const angelegteKanten = new Set<string>();
  const kantenSchluessel = (s: string, t: string, et: string): string => `${s}|${et}|${t}`;

  // Die Reihenfolge der Kommandos ist NICHT die Zeilenreihenfolge, sondern vier Phasen:
  // Knoten anlegen/ändern → Kanten → Merges → Knoten löschen. Grund ist die Persistenz:
  // `GraphStore.commit` schreibt Upserts vor Deletes, und `delete-node` nimmt seine Kanten
  // mit. Ein Löschzug am Ende ist damit derselbe Zug im Kandidaten wie auf der Platte.
  const knotenSchreiben: MutateCommand[] = [];
  const kanten: MutateCommand[] = [];
  const merges: MutateCommand[] = [];
  const knotenLoeschen: MutateCommand[] = [];

  /** Der Typ aus der Sektion, gegen den Speicher gehalten — nie ein stilles Umtypisieren. */
  const typPruefen = (uid: string, type: string | undefined): string => {
    if (!type) {
      throw new Error(
        `Format-E: node "${uid}" carries no type — Format-E v2 declares it in a "### <TYPE>" section`,
      );
    }
    const storeType = resolveType(uid);
    if (storeType !== undefined && storeType !== type) {
      throw new Error(
        `Format-E: node "${uid}" is declared as "${type}" but exists as "${storeType}" — ` +
          'a type conflict is an error, not a silent retype.',
      );
    }
    return type;
  };

  /** `__name` heraus, private `__`-Felder weg — dieselbe Trennung wie im Decoder. */
  const attributeTeilen = (raw: Record<string, unknown>): { name?: string; attributes: Record<string, unknown> } => {
    const attributes: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!k.startsWith('__')) attributes[k] = v;
    }
    const name = raw['__name'] as string | undefined;
    return { ...(name !== undefined ? { name } : {}), attributes };
  };

  for (const op of diff.operations) {
    switch (op.type) {
      case 'add_node':
      case 'strict_add_node': {
        const uid = op.semanticId;
        const type = typPruefen(uid, op.elementType);
        const { name, attributes } = attributeTeilen(op.attributes ?? {});
        if (name === undefined) unnamed.push(uid);
        angelegt.add(uid);
        knotenSchreiben.push({
          op: 'add-node',
          node: { uid, type, name: name ?? uid, description: op.description ?? '', attributes },
        });
        break;
      }

      case 'update_node': {
        const uid = op.semanticId;
        const type = typPruefen(uid, op.elementType);
        const { name, attributes } = attributeTeilen(op.attributes ?? {});
        // PATCH: nur nennen, was die Zeile nennt. `description: undefined` liesse
        // `applyCommands` auf den Bestand zurueckfallen — ein leeres Feld waere eine
        // andere Aussage als „nicht angefasst".
        knotenSchreiben.push({
          op: 'update-node',
          node: {
            uid,
            type,
            ...(name !== undefined ? { name } : {}),
            ...(op.description !== undefined ? { description: op.description } : {}),
            ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
          },
        });
        break;
      }

      case 'remove_node': {
        const uid = op.semanticId;
        // KEIN `typPruefen` hier: der Parser gibt `remove_node` ohne `elementType` — löschen
        // braucht die Identität, nicht den Typ (`delete-node` trägt nur die uid). Geprüft wird
        // stattdessen die EXISTENZ: `applyCommands` löscht einen unbekannten Knoten still, und
        // ein stiller Löschzug auf einen Tippfehler ist genau die Klasse, die hier nicht
        // durchgeht. Die `### <TYPE>`-Sektion bleibt trotzdem Pflicht — der Parser verlangt sie
        // für JEDE Knotenzeile.
        if (resolveType(uid) === undefined) {
          throw new Error(
            `Format-E: delete rejected — node "${uid}" does not exist; a deletion must name a node the store holds.`,
          );
        }
        geloeschteKnoten.add(uid);
        knotenLoeschen.push({ op: 'delete-node', uid });
        break;
      }

      case 'add_edge':
      case 'strict_add_edge':
      case 'remove_edge': {
        const sourceId = op.sourceId!;
        const targetId = op.targetId!;
        const edgeType = op.edgeType!;
        // CR-GC-310: ein Endpunkt zählt als vorhanden, wenn dieser Block ihn anlegt ODER der
        // Speicher ihn kennt. Alles andere bleibt die Implicit-Add-Ablehnung.
        for (const [rolle, uid] of [['source', sourceId], ['target', targetId]] as const) {
          if (!angelegt.has(uid) && resolveType(uid) === undefined) {
            throw new Error(
              `Format-E: implicit-add rejected — ${rolle} "${uid}" not present; ` +
                'all nodes must be declared before referencing them in edges.',
            );
          }
        }
        const schluessel = kantenSchluessel(sourceId, targetId, edgeType);
        if (op.type === 'remove_edge') {
          geloeschteKanten.add(schluessel);
          kanten.push({ op: 'delete-edge', edge: { sourceId, targetId, edgeType } });
        } else {
          angelegteKanten.add(schluessel);
          kanten.push({ op: 'add-edge', edge: { sourceId, targetId, edgeType, attributes: op.attributes ?? {} } });
        }
        break;
      }

      case 'merge_nodes': {
        const ids = op.sourceIds ?? [];
        if (ids.length !== 2) {
          throw new Error(
            `Format-E: a merge line absorbs exactly ONE node into ONE other ("M source + target"); ` +
              `got ${ids.length} (${ids.join(' + ')}).`,
          );
        }
        const [sourceUid, targetUid] = ids;
        for (const uid of ids) {
          if (!angelegt.has(uid) && resolveType(uid) === undefined) {
            throw new Error(`Format-E: merge rejected — "${uid}" is neither declared here nor in the store.`);
          }
        }
        geloeschteKnoten.add(sourceUid);
        merges.push({ op: 'merge-nodes', sourceUid, targetUid });
        break;
      }

      default:
        throw new Error(`Format-E: unknown Format-E operation "${(op as { type: string }).type}"`);
    }
  }

  // Löschen UND Anlegen derselben Identität in EINEM Batch: der Kandidat trüge sie, die Platte
  // nicht — `commit` schreibt Upserts vor Deletes. Bekannt aus `import-code` (CR-GC-298), hier
  // an der Textform. Eine widersprüchliche Absicht gehört abgelehnt, nicht sortiert.
  const knotenKollision = [...geloeschteKnoten].filter((uid) => angelegt.has(uid));
  if (knotenKollision.length > 0) {
    throw new Error(
      `Format-E: the same uid is deleted AND written in one Batch: ${knotenKollision.join(', ')}. ` +
        'Persistence writes deletes last, so the store would lose what the candidate keeps — split the batch.',
    );
  }
  const kantenKollision = [...geloeschteKanten].filter((k) => angelegteKanten.has(k));
  if (kantenKollision.length > 0) {
    throw new Error(
      `Format-E: the same edge is deleted AND added in one Batch: ${kantenKollision.join(', ')}. ` +
        'Persistence writes deletes last — split the batch.',
    );
  }

  return { commands: [...knotenSchreiben, ...kanten, ...merges, ...knotenLoeschen], unnamed };
}
