/**
 * executor-parse.ts — Prosa-Recovery des embedded Executors (CR-GC-280,
 * aus `executor.ts` herausgeschnitten mit CR-GC-320).
 *
 * Coder-Modelle (devstral) schreiben den Mutate gern als Text statt als
 * Tool-Call. Reine Textparser, keine Abhängigkeit auf Registry oder Loop.
 *
 * @author andreas@siglochconsulting
 */

/** Was die Text-Bergung liefert: die Eingabe eines graph_mutate-Aufrufs in einer der zwei Formen. */
export type RecoveredMutate = { commands: unknown[] } | { formatE: string };

/**
 * Einen graph_mutate-Batch aus Modell-TEXT bergen (kein Tool-Call). Seit CR-GC-650 emittiert der
 * Executor Format-E; ein Modell, das den Aufruf nicht absetzt, schreibt den Block dann als Text —
 * roh, in einem Code-Zaun oder als JSON `{"formatE": "..."}`. Die `commands`-Bergung bleibt fuer
 * Modelle, die trotz Anweisung JSON-Kommandos schreiben: beide Formen nimmt das Gate an.
 */
export function extractMutateFromText(text: string): RecoveredMutate | null {
  if (!text) return null;
  return extractFormatEFromText(text) ?? extractCommandsFromText(text);
}

/** Format-E aus Text: JSON-Feld `formatE` oder ein roher Block ab `## Nodes` / `## Edges`. */
function extractFormatEFromText(text: string): { formatE: string } | null {
  const feld = /"formatE"\s*:\s*("(?:[^"\\]|\\.)*")/.exec(text);
  if (feld) {
    try {
      const wert = JSON.parse(feld[1]) as unknown;
      if (typeof wert === 'string' && wert.trim()) return { formatE: wert };
    } catch {
      // kein gueltiges JSON-String-Literal — weiter mit dem rohen Block
    }
  }
  const start = /^## (Nodes|Edges)\s*$/m.exec(text);
  if (!start) return null;
  let block = text.slice(start.index);
  const zaun = block.indexOf('```');
  if (zaun >= 0) block = block.slice(0, zaun);
  return /^[+~-] /m.test(block) ? { formatE: block.trim() + '\n' } : null;
}

function extractCommandsFromText(text: string): { commands: unknown[] } | null {
  if (!text.includes('"commands"')) return null;
  const at = text.indexOf('"commands"');
  let start = text.lastIndexOf('{', at);
  while (start >= 0) {
    let depth = 0;
    let end = -1;
    for (let k = start; k < text.length; k++) {
      if (text[k] === '{') depth++;
      else if (text[k] === '}' && --depth === 0) {
        end = k;
        break;
      }
    }
    if (end > start) {
      try {
        const o = JSON.parse(text.slice(start, end + 1)) as { commands?: unknown };
        if (Array.isArray(o.commands)) return o as { commands: unknown[] };
      } catch {
        // kein valides JSON an dieser Klammer — weiter außen suchen
      }
    }
    // lastIndexOf clampt fromIndex<0 auf 0 — bei start=0 liefe die Suche endlos.
    start = start > 0 ? text.lastIndexOf('{', start - 1) : -1;
  }
  // Kein balanciertes Objekt — SALVAGE (v8-Befund): devstrals [ARGS]-Mega-Batches
  // werden vom maxTokens-Budget mitten im JSON abgeschnitten. Alle VOLLSTÄNDIGEN
  // Command-Objekte aus dem Array bergen; das Gate urteilt über den Teil-Batch.
  const salvaged = salvageCommands(text);
  return salvaged.length > 0 ? { commands: salvaged } : null;
}

/** String-bewusster Brace-Scan: birgt vollständige {…}-Objekte aus einem
 * (potenziell abgeschnittenen) `"commands": [ … `-Array. */
function salvageCommands(text: string): unknown[] {
  const at = text.indexOf('"commands"');
  if (at < 0) return [];
  const arr = text.indexOf('[', at);
  if (arr < 0) return [];
  const out: unknown[] = [];
  let i = arr + 1;
  while (i < text.length) {
    while (i < text.length && text[i] !== '{' && text[i] !== ']') i++;
    if (i >= text.length || text[i] === ']') break;
    const start = i;
    let depth = 0;
    let inString = false;
    let end = -1;
    for (; i < text.length; i++) {
      const c = text[i];
      if (inString) {
        if (c === '\\') i++; // Escape überspringen
        else if (c === '"') inString = false;
      } else if (c === '"') inString = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        end = i;
        break;
      }
    }
    if (end < 0) break; // abgeschnittenes letztes Objekt — verwerfen
    try {
      const o = JSON.parse(text.slice(start, end + 1)) as { op?: unknown };
      if (typeof o.op === 'string') out.push(o);
    } catch {
      break; // ab hier ist der Stream nicht mehr vertrauenswürdig
    }
    i = end + 1;
  }
  return out;
}

/**
 * `[ARGS]`-Text-Recovery (CR-GC-280): devstral schreibt Tool-Calls wiederholt
 * als Text — `graphcode_graph_elements[ARGS]{"type":"UC"}`. Den Call parsen
 * statt den Turn an die Nudge zu verlieren.
 */
export function extractToolCallFromText(text: string): { name: string; input: unknown } | null {
  if (!text) return null;
  const m = /([A-Za-z0-9_]+)\s*\[ARGS\]\s*(\{[\s\S]*)/.exec(text);
  if (!m) return null;
  const s = m[2];
  let depth = 0;
  let end = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  try {
    return { name: m[1], input: JSON.parse(s.slice(0, end + 1)) };
  } catch {
    return null;
  }
}

/**
 * CR-GC-667: die Fragezeile `? <Frage>` — der Kanal zum Auftraggeber in derselben Sprache wie der
 * Batch. Ein offener Punkt des Auftrags wird gefragt statt mit einer erfundenen Zahl gefuellt. Die
 * Zeile gehoert nicht zu Format-E: sie wird herausgenommen, bevor der Text den Codec erreicht.
 */
const FRAGEZEILE = /^[ \t]*\?[ \t]+(\S.*?)[ \t]*$/gm;

/** Fragezeilen aus einem Text: die Fragen und der Text ohne sie. */
export function extractQuestions(text: string): { rest: string; questions: string[] } {
  if (!text) return { rest: text, questions: [] };
  const questions = [...text.matchAll(FRAGEZEILE)].map((m) => m[1]);
  if (questions.length === 0) return { rest: text, questions };
  return { rest: text.replace(FRAGEZEILE, '').replace(/\n{3,}/g, '\n\n'), questions };
}

/** Dasselbe fuer die Eingabe eines graph_mutate-Aufrufs: nur das `formatE`-Feld traegt Fragezeilen. */
export function takeQuestionsFromInput(input: unknown): { input: unknown; questions: string[] } {
  if (typeof input !== 'object' || input === null) return { input, questions: [] };
  const formatE = (input as { formatE?: unknown }).formatE;
  if (typeof formatE !== 'string') return { input, questions: [] };
  const { rest, questions } = extractQuestions(formatE);
  if (questions.length === 0) return { input, questions };
  return { input: { ...(input as Record<string, unknown>), formatE: rest }, questions };
}
