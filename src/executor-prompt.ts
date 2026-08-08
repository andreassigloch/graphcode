/**
 * executor-prompt.ts — System-Prompt, Tool-Auswahl und Runden-Injektion des
 * embedded Executors (CR-GC-320, aus `executor.ts` herausgeschnitten).
 *
 * Diese Achse ist zustandsfrei: reine Stringerzeugung aus Registry-Reads, kein
 * Closure-Bezug zum Runden-Loop. Der Loop importiert sie, sie kennt den Loop
 * nicht — das ist der ganze Grund, warum der Schnitt hier mechanisch ist.
 *
 * @author andreas@siglochconsulting
 */
import { ElementType } from '@sigloch/contracts/se';
import type { MCPToolRegistry } from './mcp-tools.js';
import type { GenerationStep } from './generate.js';

// ---------------------------------------------------------------------------
// System-Prompt — bewusst ~1 Seite; die Methode kommt aus graph_generate.
// ---------------------------------------------------------------------------

/** Exportiert für den Contracts-Drift-Test (CR-GC-291): jeder ElementType.options-Wert
 * muss in diesem Prompt auftauchen, sonst halluziniert das Modell einen unbekannten Typ. */
export const SYSTEM = `Du autorierst Elemente in einen graphcode-Graphen. Der Graph ist die einzige Wahrheit — kein Code, keine Prosa.

Legale Elementtypen (NUR diese ${ElementType.options.length}): ${ElementType.options.join(', ')}. Kein anderer Typ
existiert — auch nicht für Dokumente/Specs (die bleiben Prosa, kein Graph-Knoten).

Jede Nachricht gibt dir EINE präzise Generierungs-Instruktion (inkl. der legalen Kanten). Führe genau sie aus:
emittiere den geforderten Batch als EINEN graphcode_graph_mutate-Aufruf im commands-Format, dann STOPP.

graph_mutate-Form (exakt):
{"commands":[
  {"op":"add-node","node":{"uid":"UC-login","type":"UC","name":"Login","description":"...","attributes":{}}},
  {"op":"add-edge","edge":{"sourceId":"ACTOR-user","targetId":"UC-login","edgeType":"io","attributes":{}}}
]}
uid = "<TYP>-<kebab-name>". Nutze GENAU die Kanten aus der Instruktion (z.B. "ACTOR io→UC, SYS compose→UC").
Kanten-Grammatik der Fokus-Typen und Element-Index (uid · type · name) stehen BEREITS in der Instruktion —
rufe graph_authoring_guide/graph_elements NICHT dafür auf, nur für darüber hinausgehende Details (graph_get_node).
Lehnt das Gate deinen Batch ab (success:false), korrigiere NUR die beanstandeten Commands anhand der
violations/fixHints und reiche den VOLLSTÄNDIGEN korrigierten Batch erneut ein.
list_dir/read_file/grep über ./material nur sparsam, um echte Modul-Namen zu finden — nicht statt Bauen.
Handeln vor Analysieren: rufe graph_mutate, rate die Instruktion nicht tot.`;

export const EMIT_SUFFIX =
  '\n\nEmittiere GENAU diesen Schritt als EINEN graph_mutate-Aufruf im commands-Format ' +
  '({"commands":[{"op":"add-node","node":{"uid","type","name","description","attributes":{}}},' +
  '{"op":"add-edge","edge":{"sourceId","targetId","edgeType","attributes":{}}}]}).';

/** Handlungs-Zwang bei Idle-Turns: Coder-Modelle dithern gern in Prosa (Rig-Befund
 * "6× guide/Runde") — EIN Nachfassen pro Step statt den Schritt still aufzugeben. */
export const IDLE_NUDGE =
  'Du hast KEINEN graph_mutate-Call emittiert. Emittiere JETZT den geforderten Batch als EINEN ' +
  'graphcode_graph_mutate-Tool-Call im commands-Format — keine Prosa, keine weitere Analyse.';

/** Diese Tools ruft der EXECUTOR deterministisch — dem Modell werden sie vorenthalten. */
export const WITHHELD_TOOLS = new Set(['graph_generate', 'graph_next_step']);

/** Das kuratierte Minimal-Set für den generativen Loop (toolset 'authoring'). */
export const AUTHORING_TOOLS = new Set([
  'graph_mutate',
  'graph_authoring_guide',
  'graph_get_node',
  'graph_elements',
  'graph_readiness',
]);

// ---------------------------------------------------------------------------
// Runden-Prompt-Injektion (CR-GC-285): deterministisch berechenbare Lese-
// Inhalte (Guide-Slice der Fokus-Typen + Element-Index) direkt in den Runden-
// Prompt statt sie das Modell erfragen zu lassen — Turn-Analyse der Testläufe:
// 41–59 % reine Lese-Turns, graph_authoring_guide 72–107× pro Lauf für
// dieselben Typen (History resettet pro Runde). Die Lese-Tools bleiben im
// Toolset (Detail-Nachfragen); nur der Standard-Rundenstart braucht sie nicht.
// ---------------------------------------------------------------------------

/** Zeichen-Budget des Element-Index (~2k-Token-Äquivalent). Überschreitung ⇒
 * deterministisch auf Fokus-Typen filtern, danach harte Kappe von vorn. */
export const INDEX_CHAR_BUDGET = 8000;

/** Zeichen-Budget eines einzelnen Tool-Ergebnisses im Runden-Prompt. */
export const TOOL_RESULT_CHAR_BUDGET = 6000;

/**
 * Ein Tool-Ergebnis als **gültiges JSON** unter dem Budget (CR-GC-309).
 *
 * Vorher stand hier zweimal `JSON.stringify(x).slice(0, N)`. Ein Byte-Schnitt
 * zerlegt das JSON mitten im Objekt: bei einer 70-KB-Antwort bekam das lokale
 * Modell einen abgehackten Blob — nicht parsebar, also auch keine verwertbare
 * Violation. Statt zu schneiden geben wir ein KLEINERES, gültiges Objekt zurück,
 * das sagt, was fehlt.
 *
 * Der Summary-Default aus demselben CR macht das für Mutationen zum seltenen Fall;
 * seltener heißt aber nicht nie — ein großer Graph kann auch eine Leseantwort über
 * das Budget heben, und dann ist "gültig, aber knapp" das einzig Brauchbare.
 */
export function jsonCapped(value: unknown, budget = TOOL_RESULT_CHAR_BUDGET): string {
  const full = JSON.stringify(value) ?? 'null';
  if (full.length <= budget) return full;
  // Skalare Felder der obersten Ebene behalten — dort stehen success/tier/counts,
  // also genau das, wonach der Treiber verzweigt. Arrays/Objekte fallen weg; ihre
  // Größe ist der Grund für die Überschreitung.
  const scalars: Record<string, unknown> = {};
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null || typeof v !== 'object') scalars[k] = v;
    }
  }
  return JSON.stringify({
    ...scalars,
    truncated: true,
    originalChars: full.length,
    note:
      `Ergebnis über ${budget} Zeichen und deshalb gekürzt — verschachtelte Felder entfernt. ` +
      'Gezielt nachfragen (rules_get_violations, graph_impact) statt das volle Ergebnis anzufordern.',
  });
}

interface GuideSlice {
  outgoing: { edgeType: string; targetType: string; cardinality?: string }[];
  incoming: { edgeType: string; sourceType: string; cardinality?: string }[];
  requiredAttrs: string[];
}

/**
 * Baut die beiden Injektions-Blöcke für den Rundenstart: (a) Kanten-Grammatik
 * der `focusTypes` (in-process `graph_authoring_guide`), (b) Element-Index des
 * Graph-Zustands als `uid · type · name`-Zeilen (in-process `graph_elements`).
 * Fehlertolerant — die Injektion darf den Lauf nie brechen (leerer Block statt
 * Throw); leerer Graph ⇒ kein Index-Block.
 */
export async function buildRoundInjection(
  registry: MCPToolRegistry,
  step: Pick<GenerationStep, 'focusTypes'>,
): Promise<string> {
  const blocks: string[] = [];
  const focusTypes = step.focusTypes ?? [];

  if (focusTypes.length > 0 && registry['graph_authoring_guide']) {
    const lines: string[] = [];
    for (const type of focusTypes) {
      try {
        const g = (await registry['graph_authoring_guide'].handler({ type })) as GuideSlice;
        const card = (c?: string): string => (c ? ` (${c})` : '');
        const out =
          g.outgoing.map((e) => `${e.edgeType}→${e.targetType}${card(e.cardinality)}`).join(', ') || '-';
        const inc =
          g.incoming.map((e) => `${e.sourceType} ${e.edgeType}→${card(e.cardinality)}`).join(', ') || '-';
        const attrs = g.requiredAttrs.length > 0 ? `; Pflicht-Attrs: ${g.requiredAttrs.join(', ')}` : '';
        lines.push(`- ${type}: ausgehend: ${out}; eingehend: ${inc}${attrs}`);
      } catch {
        // unbekannter Typ / Handler-Fehler: Typ überspringen, Rest injizieren
      }
    }
    if (lines.length > 0) {
      blocks.push(
        'Kanten-Grammatik der Fokus-Typen (bereits eingebettet — graph_authoring_guide dafür NICHT ' +
          'erneut aufrufen; Gate-Protokoll Schritt 1 ist damit erledigt):\n' + lines.join('\n'),
      );
    }
  }

  if (registry['graph_elements']) {
    try {
      const res = (await registry['graph_elements'].handler({})) as {
        nodes?: { uid: string; type: string; name: string }[];
      };
      const nodes = [...(res.nodes ?? [])].sort((a, b) => a.uid.localeCompare(b.uid));
      if (nodes.length > 0) {
        const toLine = (n: { uid: string; type: string; name: string }): string =>
          `${n.uid} · ${n.type} · ${n.name}`;
        let selected = nodes;
        let note = '';
        if (nodes.map(toLine).join('\n').length > INDEX_CHAR_BUDGET && focusTypes.length > 0) {
          const keep = new Set(focusTypes);
          selected = nodes.filter((n) => keep.has(n.type));
          note =
            `(auf die Fokus-Typen ${focusTypes.join('/')} gefiltert — ` +
            `${nodes.length - selected.length} weitere Elemente via graph_elements)`;
        }
        let lines = selected.map(toLine);
        // Harte Kappe: deterministisch von vorn (uid-sortiert), Rest als Zähler.
        let total = 0;
        let cut = lines.length;
        for (let i = 0; i < lines.length; i++) {
          total += lines[i].length + 1;
          if (total > INDEX_CHAR_BUDGET) {
            cut = i;
            break;
          }
        }
        if (cut < lines.length) {
          note = [note, `… (+${lines.length - cut} weitere — via graph_elements)`]
            .filter(Boolean)
            .join(' ');
          lines = lines.slice(0, cut);
        }
        blocks.push(
          'Element-Index des Graphen (uid · type · name; bereits eingebettet — graph_elements NICHT ' +
            'erneut aufrufen; existierende uids für Kanten referenzieren, keine Duplikate anlegen):\n' +
            lines.join('\n') +
            (note ? '\n' + note : ''),
        );
      }
    } catch {
      // Index optional — Injektion darf den Lauf nie brechen
    }
  }
  return blocks.join('\n\n');
}
