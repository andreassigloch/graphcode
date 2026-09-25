/**
 * executor-inventory.ts — der Inventar-Kanal der Rundeninjektion: welche vorhandenen Knoten das
 * Modell als uid-Liste mitbekommt (CR-GC-285; aus executor-prompt.ts geschnitten mit CR-GC-652).
 *
 * Zwei Zuschnitte, je nach Art des Schritts — kein Rueckfall des einen auf den anderen:
 *   - **mit Fund** (expand): der Kontext des Funds — der gerichtete Weg hinauf zum Besitzer und
 *     hinunter durch seine Realisierung (`fund-kontext.ts`). Hat ein Fund keinen Besitzer, steht
 *     das ausdruecklich da, statt einer Ersatzliste (Entscheidung Auftraggeber 2026-09-24).
 *   - **ohne Fund** (seed, Task-Einstieg): nach Fokus-Typ, reihum, gedeckelt — der Seed-Graph ist
 *     klein, und es gibt keinen Fund, von dem aus sich ein Weg gehen liesse.
 *
 * Fehlertolerant wie die ganze Injektion: ein Fehler kostet den Block, nie die Runde.
 *
 * @author andreas@siglochconsulting
 */
import type { MCPToolRegistry } from '../kernel/tool-contract.js';
import type { ChannelBlock } from './channel-rank.js';
import type { GenerationStep } from './generate.js';
import { fundKontext, type KontextKante, type KontextKnoten } from './fund-kontext.js';

/** Zeichen-Budget des Element-Index (~2k-Token-Äquivalent). Überschreitung ⇒ harte Kappe von vorn, angesagt. */
export const INDEX_CHAR_BUDGET = 8000;

/** Hoechstens so viele UCs in der Uebersicht der Fund-Liste (CR-GC-664). */
const UC_UEBERSICHT_MAX = 20;

/** Die Kanten, entlang derer der Fund-Kontext laeuft (fund-kontext.ts): hinauf compose, hinunter compose/allocate. */
const KONTEXT_KANTEN = ['compose', 'allocate'] as const;

const toLine = (n: { uid: string; type: string; name: string }): string => `${n.uid} · ${n.type} · ${n.name}`;

/** Deterministisch von vorn kappen; was wegfaellt, wird als Zahl angesagt. */
function gekappt(lines: string[]): { lines: string[]; rest: number } {
  let total = 0;
  for (let i = 0; i < lines.length; i++) {
    total += lines[i].length + 1;
    if (total > INDEX_CHAR_BUDGET) return { lines: lines.slice(0, i), rest: lines.length - i };
  }
  return { lines, rest: 0 };
}

export async function buildInventoryBlock(
  registry: MCPToolRegistry,
  step: Pick<GenerationStep, 'focusTypes' | 'focusElements'>,
): Promise<ChannelBlock | null> {
  const elementsTool = registry['graph_elements'];
  if (!elementsTool) return null;
  try {
    const fund = step.focusElements ?? [];
    return fund.length > 0 ? await ausFundKontext(registry, fund, step.focusTypes ?? []) : await nachTyp(registry, step.focusTypes ?? []);
  } catch {
    // Index optional — Injektion darf den Lauf nie brechen
    return null;
  }
}

async function ausFundKontext(
  registry: MCPToolRegistry,
  fund: string[],
  focusTypes: string[],
): Promise<ChannelBlock | null> {
  const elementsTool = registry['graph_elements'];
  const edgesTool = registry['graph_get_edges'];
  if (!edgesTool) return null;
  // Identitaet reicht (uid, Typ, Name) — keine Prosa. Durch das deklarierte Schema, wie jeder Aufruf.
  const res = (await elementsTool.handler(elementsTool.inputSchema.parse({ limit: 1_000_000 }))) as {
    nodes?: KontextKnoten[];
  };
  const edges: KontextKante[] = [];
  for (const edgeType of KONTEXT_KANTEN) {
    const r = (await edgesTool.handler(edgesTool.inputSchema.parse({ edgeType }))) as { edges?: KontextKante[] };
    edges.push(...(r.edges ?? []));
  }
  const kontext = fundKontext({ nodes: res.nodes ?? [], edges }, fund, focusTypes);
  const { lines, rest } = gekappt(kontext.knoten.map(toLine));
  const zeilen = [
    'Element-Liste aus dem Kontext des Funds (uid · type · name: der Fund, sein Besitzer UC/SYS und dessen ' +
      'Realisierung; bereits eingebettet — graph_elements dafür nicht aufrufen; existierende uids für Kanten ' +
      'referenzieren):',
    ...lines,
  ];
  if (rest > 0) zeilen.push(`… (+${rest} weitere — via graph_elements)`);
  // CR-GC-664: die UC-Uebersicht, auch wenn der Fund keine UCs im Kontext hat. Gemessen
  // (gcrun-120..122): in 24 von 36 Runden war die erste Abfrage graph_elements {type:UC} — die
  // Fund-Liste zeigte UCs nur als Besitzer. Nur uid und Name, gedeckelt: eine Orientierung, kein Index.
  const ucs = (res.nodes ?? []).filter((n) => n.type === 'UC').sort((a, b) => a.uid.localeCompare(b.uid));
  if (ucs.length > 0) {
    const gezeigt = ucs.slice(0, UC_UEBERSICHT_MAX).map((n) => `${n.uid} (${n.name})`);
    const mehr = ucs.length > UC_UEBERSICHT_MAX ? ` … (+${ucs.length - UC_UEBERSICHT_MAX})` : '';
    zeilen.push(`UCs im Modell: ${gezeigt.join(', ')}${mehr}`);
  }
  if (kontext.ohneBesitzer.length > 0) {
    zeilen.push(
      `Kein Besitzer im Modell für: ${kontext.ohneBesitzer.join(', ')} — diese Knoten hängen weder unter ` +
        'einem UC noch unter dem SYS. Das ist selbst ein Befund: hänge sie an ihren Besitzer, statt einen ' +
        'Erfüller zu raten.',
    );
  }
  return { channel: 'inventory', text: zeilen.join('\n') };
}

async function nachTyp(registry: MCPToolRegistry, focusTypes: string[]): Promise<ChannelBlock | null> {
  const elementsTool = registry['graph_elements'];
  // CR-GC-539: durch DIESELBE Schema-Schicht, die der MCP-Server davorschaltet. Der rohe
  // `handler({})` lief daran vorbei — `input.limit` war `undefined`, also kam der GANZE Graph, und
  // der Deckel kappte bei den ERSTEN 100 uid-sortierten: bei Fokus UC/FCHAIN kein einziger UC oder
  // FCHAIN darunter (100 von 100 Fremdtypen) — das Gegenteil der need-to-know-Whitebox.
  const parse = (arg: Record<string, unknown>): unknown => elementsTool.inputSchema.parse(arg);
  /** Der DEKLARIERTE Default, nicht eine zweite Zahl an dieser Stelle. */
  const limit = (parse({}) as { limit: number }).limit;

  // Je Fokus-Typ abfragen: nachtraeglich zu filtern waere sinnlos, die ersten `limit` Knoten des
  // ganzen Graphen enthalten von einem Fokus-Typ womoeglich keinen einzigen.
  const abfragen = focusTypes.length > 0 ? focusTypes.map((type) => ({ type })) : [{}];
  const jeTyp: KontextKnoten[][] = [];
  // `total` ist die Zahl VOR dem Zuschnitt — sonst untertreibt der Rest-Hinweis.
  let gesamt = 0;
  for (const arg of abfragen) {
    const res = (await elementsTool.handler(parse(arg))) as { nodes?: KontextKnoten[]; total?: number };
    const liste = [...(res.nodes ?? [])].sort((a, b) => a.uid.localeCompare(b.uid));
    gesamt += res.total ?? liste.length;
    jeTyp.push(liste);
  }

  // Reihum, damit die Gesamtkappe keinen Fokus-Typ aushungert.
  const nodes: KontextKnoten[] = [];
  for (let i = 0; nodes.length < limit; i++) {
    const runde = jeTyp.filter((liste) => i < liste.length);
    if (runde.length === 0) break;
    for (const liste of runde) {
      if (nodes.length >= limit) break;
      nodes.push(liste[i]);
    }
  }
  if (nodes.length === 0) return null;
  nodes.sort((a, b) => a.uid.localeCompare(b.uid));

  const { lines, rest } = gekappt(nodes.map(toLine));
  const notiz = [
    focusTypes.length > 0
      ? `(auf die Fokus-Typen ${focusTypes.join('/')} beschraenkt` +
        (gesamt > nodes.length ? ` — ${gesamt - nodes.length} weitere davon via graph_elements)` : ')')
      : gesamt > nodes.length
        ? `(${gesamt - nodes.length} weitere Elemente via graph_elements)`
        : '',
    rest > 0 ? `… (+${rest} weitere — via graph_elements)` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return {
    channel: 'inventory',
    text:
      'Element-Index des Graphen (uid · type · name; bereits eingebettet — graph_elements NICHT ' +
      'erneut aufrufen; existierende uids für Kanten referenzieren):\n' +
      lines.join('\n') +
      (notiz ? '\n' + notiz : ''),
  };
}
