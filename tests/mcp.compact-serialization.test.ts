/**
 * CR-GC-579 — Werkzeug-Antworten reisen kompakt, Repo-Dateien eingerueckt.
 *
 * `mcp-server.ts` serialisierte JEDE Antwort JEDES Werkzeugs mit Einrueckung 2. Gemessen an
 * `rig/greenfield-systemtest/runs/opus5-5` ueber alle Werkzeug-Ergebnisse im Kontextfenster:
 * 266.188 gegen 217.442 Zeichen — **18,3 % des Gesamtpayloads** fuer Leerzeichen. Am
 * staerksten `graph_readiness` mit 38,2 %, weil `null, 2` jedes Array-Element auf eine eigene
 * Zeile schreibt.
 *
 * Diese Abnahme haelt die zwei Seiten auseinander, die dabei leicht verwechselt werden:
 * ein Werkzeug-Ergebnis liest ein PARSER, eine Repo-Datei liest ein MENSCH samt `git diff`.
 * Die Einrueckung ist dort der Zweck und hier der Abfall.
 *
 * Kein Mock: die Serialisierung ist dieselbe Funktion, die der MCP-Server ruft, und die
 * Export-Seite wird gegen den echten Exporter geprueft.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { serializeToolResult } from '../src/surface/mcp-server.js';
import { exportGraphJson } from '../src/projections/exporter.js';

/** Eine Antwort in der Form, die am teuersten war: viele kleine Zahlenfelder. */
const READINESS_ARTIG = {
  // CR-GC-758: der Compliance-Block (score, totalElements, elementsWithErrors) ist gestrichen.
  marks: [
    { id: 'SRR', reached: true },
    { id: 'PDR', reached: false },
    { id: 'Bau', reached: false },
  ],
  // CR-GC-757: Befunde je Stufe (vorher `dimension_readiness` mit Prozentwert und Fundzahl).
  stages: [
    { name: 'Anwendungsfall', findings: 6 },
    { name: 'Anforderung', findings: 262 },
    { name: 'Funktion', findings: 64 },
  ],
  steer: { worst: 3.75, mean: 1.1164, measured: 42 },
  violations: [],
};

describe('TEST-compact-serialization: ein Werkzeug-Ergebnis liest ein Parser (CR-GC-579)', () => {
  it('traegt keine Einrueckung — sonst kehrt sie bei der naechsten Bequemlichkeit zurueck', () => {
    const text = serializeToolResult(READINESS_ARTIG);
    // Die Signatur von `JSON.stringify(x, null, 2)`: Zeilenumbruch plus zwei Leerzeichen.
    expect(text).not.toContain('\n  ');
    expect(text).not.toContain('\n');
  });

  it('aendert den INHALT nicht — Gleichheit ueber JSON.parse, nicht ueber den Text', () => {
    expect(JSON.parse(serializeToolResult(READINESS_ARTIG))).toEqual(READINESS_ARTIG);
    // Auch die Faelle, an denen eine Serialisierung gern kippt.
    for (const wert of [null, [], {}, 0, '', false, { a: [1, [2, [3]]] }]) {
      expect(JSON.parse(serializeToolResult(wert))).toEqual(wert);
    }
  });

  it('spart an einer readiness-artigen Antwort messbar — die Zusage ist eine Zahl, keine Absicht', () => {
    const kompakt = serializeToolResult(READINESS_ARTIG).length;
    const eingerueckt = JSON.stringify(READINESS_ARTIG, null, 2).length;
    expect(kompakt).toBeLessThan(eingerueckt);
    // Gemessen wurden 38,2 % an der echten graph_readiness-Antwort; die Attrappe hier ist
    // kleiner, also wird die Schranke bewusst niedriger gesetzt als der Messwert.
    expect(1 - kompakt / eingerueckt).toBeGreaterThan(0.25);
  });
});

describe('TEST-compact-serialization: eine Repo-Datei liest ein Mensch (CR-GC-579)', () => {
  it('der Graph-Export bleibt eingerueckt und zeilenweise diffbar', () => {
    const graph = {
      nodes: [
        { uid: 'SYS-x', type: 'SYS', name: 'X', description: 'Ein System', attributes: {} },
        { uid: 'UC-a', type: 'UC', name: 'A', description: 'Als Nutzer will ich A', attributes: {} },
      ],
      edges: [{ sourceId: 'SYS-x', targetId: 'UC-a', edgeType: 'compose', attributes: {} }],
    } as never;
    const json = exportGraphJson(graph);
    expect(json).toContain('\n  ');
    expect(json.endsWith('\n')).toBe(true);
    // Und er bleibt lesbar dasselbe Objekt — die Einrueckung ist Form, nicht Inhalt.
    expect(JSON.parse(json).elements).toHaveLength(2);
  });
});
