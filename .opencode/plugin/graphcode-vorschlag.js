// graphcode — Vorschlag an den Nutzer (CR-GC-729/732). Ausgeliefert von `graphcode init`.
//
// Jede angewandte graph_mutate-Antwort traegt `vorschlag`: den naechsten Schritt als Satz an den NUTZER.
// Dieses Plugin nimmt ihn aus der Antwort, bevor der Agent sie liest — er ist kein Auftrag — und legt ihn
// ins Eingabefeld der TUI: Enter schickt ihn ab, aendern oder loeschen geht wie bei jeder Eingabe.
// Ohne TUI (`opencode run`) steht der letzte Vorschlag in .graphcode/vorschlag.txt.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const MUTATE = 'graphcode_graph_mutate';

/** Den Vorschlag aus dem JSON-Text nehmen; null, wenn keiner drin ist. */
function herausnehmen(text) {
  let antwort;
  try {
    antwort = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof antwort?.vorschlag !== 'string') return null;
  const { vorschlag, ...rest } = antwort;
  return { vorschlag, text: JSON.stringify(rest) };
}

export const GraphcodeVorschlag = async ({ client, directory }) => ({
  'tool.execute.after': async (input, output) => {
    if (input.tool !== MUTATE) return;
    // MCP-Werkzeuge liefern das rohe Ergebnis (content[]), eingebaute ein output-Feld.
    const teil = Array.isArray(output.content) ? output.content.find((c) => c.type === 'text') : null;
    const r = herausnehmen(teil ? teil.text : output.output);
    if (!r) return;
    if (teil) teil.text = r.text;
    else output.output = r.text;
    mkdirSync(join(directory, '.graphcode'), { recursive: true });
    writeFileSync(join(directory, '.graphcode', 'vorschlag.txt'), r.vorschlag + '\n');
    await client.tui.clearPrompt();
    await client.tui.appendPrompt({ body: { text: r.vorschlag } });
  },
});
