/**
 * TEST-sitzung-kpi (CR-GC-897..899) — Kennzahlen je Sitzung aus dem Protokoll, und die Hausregeln in
 * der GRAPHCODE.md-Vorlage, aus denen sie folgen.
 *
 * Die Protokolle hier sind von Hand gebaut, im Format von Claude Code: je Inhaltsblock eine Zeile,
 * dieselbe `message.id` fuer alle Bloecke einer Antwort. Die Zahlen sind deshalb von Hand
 * nachrechenbar.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { zuege, einstieg, renderSitzung } from '../scripts/retro-kpi.mjs';
import { guardrailsContent } from '../src/surface/scaffold-docs.js';

/** Eine Antwort des Modells: Kontext in k, und je Werkzeugaufruf eine eigene Protokollzeile. */
function antwort(id: string, kontextK: number, aufrufe: Array<[string, Record<string, unknown>?]> = []) {
  const usage = { input_tokens: 0, cache_read_input_tokens: kontextK * 1000, cache_creation_input_tokens: 0, output_tokens: 100 };
  const zeilen = [{ type: 'assistant', message: { id: id, usage, content: [{ type: 'text', text: '…' }] } }];
  for (const [name, input] of aufrufe) {
    zeilen.push({ type: 'assistant', message: { id: id, usage, content: [{ type: 'tool_use', name, input: input ?? {} }] as never } });
  }
  return zeilen;
}

describe('TEST-sitzung-kpi: Einstieg (CR-GC-897)', () => {
  const protokoll = [
    { type: 'user', message: { content: 'los' } },
    ...antwort('m1', 50, [['Read'], ['Bash', { command: 'ls' }]]),
    ...antwort('m2', 60, [['mcp__graphcode__graph_elements']]),
    ...antwort('m3', 70, [['Edit']]),
    ...antwort('m4', 80),
    { type: 'assistant', isSidechain: true, message: { id: 'sub', usage: { input_tokens: 999999 }, content: [] } },
  ];

  it('fasst die Zeilen einer Antwort zu einem Zug zusammen und laesst Subagenten weg', () => {
    const zs = zuege(protokoll);
    expect(zs).toHaveLength(4);
    expect(zs[0].aufrufe.map((a: { name: string }) => a.name)).toEqual(['Read', 'Bash']);
  });

  it('zaehlt Zuege, Kontext und Token bis zur ersten Aenderung', () => {
    expect(einstieg(protokoll)).toEqual({
      zuege: 4,
      zuegeBisAenderung: 3,
      kontextBeiAenderung: 70000,
      tokenBisAenderung: 50000 + 60000 + 70000 + 3 * 100,
      kontextJeZug: 65000,
    });
  });

  it('graph_mutate zaehlt als Aenderung; ohne Aenderung bleibt der Wert leer, nicht 0', () => {
    expect(einstieg(antwort('a', 10, [['mcp__graphcode__graph_mutate']])).zuegeBisAenderung).toBe(1);
    expect(einstieg(antwort('b', 10, [['Read']])).zuegeBisAenderung).toBeNull();
  });

  it('die Tabelle nennt die Einstiegszeilen mit Ziel', () => {
    const t = renderSitzung(protokoll);
    expect(t).toContain('| Einstieg: Zuege bis zur ersten Aenderung | 3 | < 10 |');
    expect(t).toContain('| Einstieg: Kontext bei der ersten Aenderung | 70 k | < 100 k |');
  });

  it('die Vorlage traegt den Abschnitt zum Sitzungsbeginn', () => {
    const g = guardrailsContent();
    const abschnitt = g.slice(g.indexOf('## Starting a session'), g.indexOf("## Ask the graph"));
    expect(abschnitt).toMatch(/One session = one CR or one group of independent CRs/);
    expect(abschnitt).toMatch(/Enter through the CR file and the context slice of its carriers/);
    expect(abschnitt).toMatch(/never by listing the whole model/);
    expect(abschnitt).toMatch(/load all graph readers in one call/);
    expect(abschnitt).toMatch(/after each milestone or at about 150 k tokens of context/);
  });
});
