/**
 * CR-GC-715 — der Nutzer-Simulator und die Lauf-Kennzahlen des interaktiven Rigs (rig/interaktiv), rein geprüft.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — Rig-Module sind .mjs ohne Typen
import { fragen, naechsteNachricht, ende, FREIGABE, ZUSTIMMUNG, WEITER, OFFEN } from '../rig/interaktiv/simulator.mjs';
// @ts-expect-error — Rig-Module sind .mjs ohne Typen
import { kennzahlen, auditDelta } from '../rig/interaktiv/auswertung.mjs';
// @ts-expect-error — Rig-Module sind .mjs ohne Typen
import { alsClaudeMd } from '../rig/interaktiv/arme.mjs';

const korpus = JSON.parse(readFileSync(fileURLToPath(new URL('../rig/interaktiv/korpus/todo.json', import.meta.url)), 'utf8'));

/** Zug 1 des Handlaufs todo-local (2026-10-03, 17:48), gekürzt auf die Form. */
const ZUG1 = `**Fragen**

1. \`list\` zeigen auch erledigte Todos (z. B. mit Haken/Marke) oder nur offene?
2. \`add\` mit leerem bzw. nur-Whitespace-Text — abgelehnt (Fehlermeldung, Exit 1)?

**Vorschlag für die Schritte**

1. System, Akteur, Abläufe

Soll ich mit Schritt 1 beginnen oder noch die offenen Fragen vorher klären?`;

describe('CR-GC-715: Nutzer-Simulator', () => {
  it('erkennt echte Fragen, nicht die Bitte um Zustimmung', () => {
    expect(fragen(ZUG1)).toHaveLength(2);
    expect(fragen('Im Modell: drei Abläufe.\n\nSoll ich mit Schritt 3 weitermachen?')).toEqual([]);
  });

  it('Zug 1 mit Fragen: das ganze Antwortblatt, dann die Zustimmung zum Plan — nichts erfunden', () => {
    const n = naechsteNachricht({ antwort: ZUG1, vorschlag: null, blattGegeben: false, antwortblatt: korpus.antwortblatt, gebaut: false });
    expect(n.nachricht).toBe(`${korpus.antwortblatt}\n\n${OFFEN}\n\n${ZUSTIMMUNG}`);
    expect(n.blattGegeben).toBe(true);
    expect(n.beantwortet).toBe(2);
  });

  it('später: der Vorschlag des Zugs ist die Nachricht; eine neue Frage bekommt den Verweis, nicht das Blatt noch einmal', () => {
    const v = 'Lege für die Abläufe add, list, done Anforderungen mit Test an.';
    expect(naechsteNachricht({ antwort: 'Im Modell: …\nSoll ich weitermachen?', vorschlag: v, blattGegeben: true, antwortblatt: korpus.antwortblatt, gebaut: true }).nachricht).toBe(v);
    const n = naechsteNachricht({ antwort: 'Welches Format hat die Ausgabe?', vorschlag: v, blattGegeben: true, antwortblatt: korpus.antwortblatt, gebaut: true });
    expect(n.nachricht.endsWith(v)).toBe(true);
    expect(n.nachricht).not.toContain(korpus.antwortblatt);
    expect(n.nachricht).toContain(OFFEN);
  });

  it('ohne Vorschlag nach dem ersten Bau: weiter, nicht wieder „Schritt 1"', () => {
    expect(naechsteNachricht({ antwort: 'Gelesen.', vorschlag: null, blattGegeben: true, antwortblatt: '', gebaut: true }).nachricht).toBe(WEITER);
  });

  it('endet nach der abgeschickten Freigabe oder am Zuglimit', () => {
    expect(ende(3, 12, FREIGABE)).toBe('freigabe');
    expect(ende(12, 12, 'x')).toBe('zuglimit');
    expect(ende(3, 12, 'x')).toBeNull();
  });

  it('der Korpus legt jede offene Frage als O* fest und gibt dem Start-Prompt die Vorgabe', () => {
    expect(korpus.start).toContain('done mit unbekannter Nummer');
    expect(korpus.punkte.filter((p: { id: string }) => p.id.startsWith('O')).length).toBeGreaterThan(0);
  });
});

describe('CR-GC-715: Kennzahlen und Arme', () => {
  it('Kennzahlen je Lauf: Median/Max der Dauer, Fragen in Zug 1, Gate-Ergebnis', () => {
    const z = (dauerMs: number, text: string, werkzeuge: string[], angenommen: number, abgelehnt: number) => ({ dauerMs, text, werkzeuge, audit: { angenommen, abgelehnt } });
    const k = kennzahlen({ ende: 'zuglimit', zuege: [z(120_000, ZUG1, ['a'], 0, 0), z(60_000, 'ok', ['a', 'b', 'c'], 1, 1), z(180_000, 'ok', ['a', 'b'], 1, 0)] });
    expect(k).toMatchObject({ zuege: 3, dauerMedian: 120_000, dauerMax: 180_000, fragenZug1: 2, schritteMedian: 2, schritteMax: 3, angenommen: 2, abgelehnt: 1 });
  });

  it('auditDelta zählt nur Mutationen', () => {
    const l = (operation: string, result: string) => JSON.stringify({ operation, result });
    expect(auditDelta([l('mutate', 'applied'), l('mutate', 'rejected'), l('validate', 'applied')])).toEqual({ angenommen: 1, abgelehnt: 1 });
  });

  it('Frontier bekommt denselben Prompt — nur die Werkzeugnamen umgeschrieben, Gedächtnis importiert', () => {
    const p = [
      'Du liest `graphcode_graph_authoring_guide` und antwortest, ohne zu schreiben.',
      '- `graphcode_rules_evaluate` — Regelhinweise zum ganzen Modell.',
      'andere Repos mit `read`, `glob`, `grep` (absolute Pfade), das Internet mit `webfetch`.',
      'Schreib mit `graphcode_graph_mutate`.',
    ].join('\n');
    const c = alsClaudeMd(p);
    expect(c).not.toMatch(/`graphcode_/);
    expect(c).toContain('mcp__graphcode__graph_mutate');
    expect(c.replace(/mcp__graphcode__/g, 'graphcode_').replace('`Read`, `Glob`, `Grep`', '`read`, `glob`, `grep`').replace('`WebFetch`', '`webfetch`')).toBe(p + '\n@graph_memory.md\n');
  });
});
