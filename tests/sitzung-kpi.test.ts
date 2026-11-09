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
import { zuege, einstieg, einzelaufrufe, modellBefragt, renderSitzung } from '../scripts/retro-kpi.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    const abschnitt = g.slice(g.indexOf('## Sessions and turns'), g.indexOf("## Ask the graph"));
    expect(abschnitt).toMatch(/One session = one CR or one group of independent CRs/);
    expect(abschnitt).toMatch(/Enter through the CR file and the context slice of its carriers/);
    expect(abschnitt).toMatch(/never by listing the whole model/);
    expect(abschnitt).toMatch(/load all graph readers in one call/);
    expect(abschnitt).toMatch(/after each milestone or at about 150 k tokens of context/);
  });
});

describe('TEST-sitzung-kpi: Einzelaufrufe (CR-GC-898)', () => {
  const protokoll = [
    ...antwort('m1', 10, [['Bash', { command: 'python3 a.py' }]]),
    ...antwort('m2', 20, [['Bash', { command: 'python3 b.py | tail -5' }]]),
    ...antwort('m3', 30, [['Bash', { command: 'python3 c.py' }]]),
    ...antwort('m4', 40, [['Bash', { command: 'grep x y' }]]),
    ...antwort('m5', 50, [['Read'], ['Read']]),
    ...antwort('m6', 60, [['Read']]),
    ...antwort('m7', 70),
  ];

  it('zaehlt Zuege mit genau einem Aufruf und Folgen aus 3+ gleichen', () => {
    expect(einzelaufrufe(protokoll)).toEqual({
      zuegeMitWerkzeug: 6,
      einzeln: 5,
      anteilEinzeln: 83,
      kontextEinzeln: (10 + 20 + 30 + 40 + 60) * 1000,
      folgen: 1,
      folgenZuege: 3,
      folgenKontext: (10 + 20 + 30) * 1000,
    });
  });

  it('ein Zug mit mehreren Aufrufen bricht die Folge', () => {
    const p = [
      ...antwort('a', 1, [['Read']]), ...antwort('b', 1, [['Read']]),
      ...antwort('c', 1, [['Read'], ['Grep']]), ...antwort('d', 1, [['Read']]),
    ];
    expect(einzelaufrufe(p).folgen).toBe(0);
  });

  it('die Tabelle nennt beide Zeilen', () => {
    const t = renderSitzung(protokoll);
    expect(t).toContain('| Einzelaufrufe: Zuege mit genau einem Aufruf (von 6) | 5 (83 %), 160 k | ↓ |');
    expect(t).toContain('| Einzelaufrufe: Folgen aus 3+ gleichen | 1 Folgen, 3 Zuege, 60 k | 0 |');
  });

  it('die Vorlage traegt die Hausregel zu Zuegen', () => {
    const g = guardrailsContent();
    expect(g).toMatch(/Put independent reads in one turn; run a repeated check as one script with short output/);
    expect(g).toMatch(/Dry-run a deploy script locally before you run it on the target environment/);
  });
});

describe('TEST-sitzung-kpi: Modell befragt (CR-GC-899)', () => {
  const protokoll = [
    ...antwort('m1', 1, [['mcp__graphcode__graph_context'], ['mcp__graphcode__graph_mutate']]),
    ...antwort('m2', 1, [['mcp__graphcode__graph_tests']]),
    ...antwort('m3', 1, [['Bash', { command: 'npx vitest run tests/a.test.ts | tail -5' }]]),
    ...antwort('m4', 1, [['Bash', { command: 'npm test' }]]),
    ...antwort('m5', 1, [['Bash', { command: 'npm run verify:code' }], ['mcp__graphcode__graph_mutate']]),
    ...antwort('m6', 1, [['Bash', { command: "cat > x.sh <<'EOF'\nnpm test\nEOF" }]]),
  ];

  it('zaehlt Fragen, Schreibzuege und Testlaeufe mit Auswahl', () => {
    expect(modellBefragt(protokoll)).toEqual({
      fragen: 2,
      schreibzuege: 2,
      testlaeufe: 3,
      testlaeufeMitAuswahl: 2,
      anteilMitAuswahl: 67,
    });
  });

  it('die Tabelle nennt beide Zeilen', () => {
    const t = renderSitzung(protokoll);
    expect(t).toContain('| Modell befragt: Fragen zu Schreibzuegen | 2:2 | ↑ |');
    expect(t).toContain('| Modell befragt: Testlaeufe mit Auswahl aus dem Graphen | 2 von 3 (67 %) | 100 % |');
  });

  it('Vorlage und se-plan nennen die Regel vor jedem Testlauf', () => {
    expect(guardrailsContent()).toMatch(/Before every test run, ask the graph for the selected set/);
    const plan = readFileSync(join(__dirname, '..', '.claude', 'commands', 'se-plan.md'), 'utf8');
    expect(plan).toMatch(/before every test run `graph_tests\(\{changeSet\}\)`, run the tests it names, the full suite only before the CR closes/);
  });
});
