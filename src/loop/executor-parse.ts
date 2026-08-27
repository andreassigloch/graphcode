/**
 * executor-parse.ts — Prosa-Recovery des embedded Executors (CR-GC-280,
 * aus `executor.ts` herausgeschnitten mit CR-GC-320).
 *
 * Coder-Modelle (devstral) schreiben den Mutate gern als Text statt als
 * Tool-Call. Reine Textparser, keine Abhängigkeit auf Registry oder Loop.
 *
 * @author andreas@siglochconsulting
 */

export function extractMutateFromText(text: string): { commands: unknown[] } | null {
  if (!text || !text.includes('"commands"')) return null;
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
