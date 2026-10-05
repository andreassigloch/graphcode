/**
 * CR-GC-715/738 — Nutzer-Simulator, Aufgabe, Serie, Referenzlauf und Lauf-Kennzahlen des Rigs (rig/), rein geprüft.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — Rig-Module sind .mjs ohne Typen
import { fragen, naechsteNachricht, ende, analyseIn, sitzungswechsel, aufgabeLaden, FREIGABE, ZUSTIMMUNG, WEITER, OFFEN } from '../rig/simulator.mjs';
// @ts-expect-error — Rig-Module sind .mjs ohne Typen
import { auditDelta } from '../auswertung/kennzahlen.mjs';
// @ts-expect-error — Rig-Module sind .mjs ohne Typen
import { alsClaudeMd, mitModell } from '../rig/arme.mjs';
// @ts-expect-error — Rig-Module sind .mjs ohne Typen
import { fehlendeLaeufe, referenzSetzen, STUFEN, REFERENZ_DATEIEN } from '../rig/treiber.mjs';

const korpus = aufgabeLaden('todo');

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

  it('endet, sobald die Readiness SRR und PDR als bestanden meldet', () => {
    expect(ende(4, 30, 'x', { SRR: true, PDR: true, CDR: false })).toBe('srr+pdr');
    expect(ende(4, 30, 'x', { SRR: true, PDR: false })).toBeNull();
    expect(ende(4, 30, 'x')).toBeNull();
  });

  it('erkennt die Analyse eines Vorschlags (Auftrag oder Satz 2, auch der alte Akkusativ)', () => {
    expect(analyseIn('Führe das Einsatzkonzept (ConOps) durch.')).toBe('Einsatzkonzept');
    expect(analyseIn('Das Einsatzkonzept (ConOps) ist noch nicht abgeschlossen — was fehlt dafür?')).toBe('Einsatzkonzept');
    expect(analyseIn('Der Variantenvergleich (Trade-off) ist noch nicht abgeschlossen — was fehlt dafür?')).toBe('Variantenvergleich');
    expect(analyseIn('Den Variantenvergleich (Trade-off) ist noch nicht abgeschlossen — was fehlt dafür?')).toBe('Variantenvergleich');
    expect(analyseIn('Führe die Fehlerbetrachtung (FMEA) durch.')).toBe('Fehlerbetrachtung');
    expect(analyseIn('Lege die Nutzer (Akteure) an und verbinde sie mit den Abläufen.')).toBeNull();
    expect(analyseIn(null)).toBeNull();
  });

  it('frische Sitzung bei neuem Thema: Analyse aus der Strukturarbeit, andere Analyse, zurück zur Struktur', () => {
    expect(sitzungswechsel(null, 'Führe das Einsatzkonzept (ConOps) durch.')).toBe(true);
    expect(sitzungswechsel('Einsatzkonzept', 'Das Einsatzkonzept (ConOps) ist noch nicht abgeschlossen — was fehlt dafür?')).toBe(false);
    expect(sitzungswechsel('Einsatzkonzept', 'Führe das Annahmen-Review durch.')).toBe(true);
    expect(sitzungswechsel('Einsatzkonzept', 'Ordne die Funktionen Modulen zu.')).toBe(true);
    expect(sitzungswechsel(null, 'Ordne die Funktionen Modulen zu.')).toBe(false);
    expect(sitzungswechsel('Einsatzkonzept', null)).toBe(false);
  });

  it('die Aufgabe legt jede offene Frage als O* fest und gibt dem Start-Prompt die Vorgabe', () => {
    expect(korpus.start).toContain('done mit unbekannter Nummer');
    expect(korpus.punkte.filter((p: { id: string }) => p.id.startsWith('O')).length).toBeGreaterThan(0);
    expect(korpus.sequenz).toEqual(['modellieren']);
    for (const st of korpus.sequenz) expect(STUFEN[st]).toBeTypeOf('function');
    const prosa = aufgabeLaden('sigllm-prosa');
    expect(prosa.start).toContain('SIG Local');
    expect(prosa.antwortblatt.length).toBeGreaterThan(5000);
    expect(prosa.punkte.length).toBe(33);
  });

  it('die Serie fährt je Aufgabe × Arm, was für den heutigen Stand fehlt — mit der nächsten freien Nummer', () => {
    const serie = { aufgaben: ['todo'], arme: [{ arm: 'lokal' }, { arm: 'frontier', kennung: 'frontier', modell: 'claude-opus-5-5' }], n: 2 };
    const st = { code: 'abc1234', vorlage: 'f41ab7e' };
    const alt = { aufgabe: 'todo', arm: 'lokal', nr: 1, ende: 'srr+pdr', stand: { code: 'alt0000', vorlage: 'f41ab7e' } };
    const neu = { aufgabe: 'todo', arm: 'lokal', nr: 2, ende: 'srr+pdr', stand: st };
    const abgebrochen = { aufgabe: 'todo', arm: 'frontier', nr: 1, stand: st };
    expect(fehlendeLaeufe(serie, [alt, neu, abgebrochen], st)).toEqual([
      { arm: 'lokal', kennung: 'lokal', modell: null, aufgabe: 'todo', nr: 3 },
      { arm: 'frontier', kennung: 'frontier', modell: 'claude-opus-5-5', aufgabe: 'todo', nr: 2 },
      { arm: 'frontier', kennung: 'frontier', modell: 'claude-opus-5-5', aufgabe: 'todo', nr: 3 },
    ]);
    expect(fehlendeLaeufe(serie, [neu, { ...neu, nr: 3 }], st).filter((o: { arm: string }) => o.arm === 'lokal')).toEqual([]);
  });

  it('referenz: die vier Artefakte und der Stempel wandern zur Aufgabe, der alte Referenzlauf geht', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rig-referenz-'));
    try {
      const lauf = join(tmp, 'runs', 'todo', 'lokal-2');
      mkdirSync(lauf, { recursive: true });
      for (const f of REFERENZ_DATEIEN) writeFileSync(join(lauf, f), f === 'lauf.json'
        ? JSON.stringify({ aufgabe: 'todo', arm: 'lokal', nr: 2, ende: 'srr+pdr', stempel: 'graph x', stand: { code: 'c', vorlage: 'v' }, modell: 'm' })
        : f);
      const alt = join(tmp, 'aufgaben', 'todo', 'referenz', 'lokal');
      mkdirSync(alt, { recursive: true });
      writeFileSync(join(alt, 'graph.json'), 'alt');
      writeFileSync(join(alt, 'rest.txt'), 'bleibt nicht');
      const ziel = referenzSetzen(lauf, join(tmp, 'aufgaben'));
      expect(ziel).toBe(alt);
      expect(readFileSync(join(ziel, 'graph.json'), 'utf8')).toBe('graph.json');
      expect(existsSync(join(ziel, 'rest.txt'))).toBe(false);
      const st = JSON.parse(readFileSync(join(ziel, 'stempel.json'), 'utf8'));
      expect(st).toMatchObject({ lauf: 'lokal-2', stempel: 'graph x', stand: { code: 'c', vorlage: 'v' }, modell: 'm', ende: 'srr+pdr' });
      rmSync(join(lauf, 'graph.json'));
      expect(() => referenzSetzen(lauf, join(tmp, 'aufgaben'))).toThrow(/graph.json fehlt/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('CR-GC-715: Kennzahlen und Arme', () => {
  it('--modell ersetzt nur das Client-Modell: Kopie des Vorlage-Eintrags mit neuer id, Vorlage unverändert', () => {
    const vorlage = { reasoning: true, temperature: true, options: { reasoningEffort: 'medium' }, limit: { context: 65536, output: 16384 }, id: 'qwen3.8-27b-lms:latest' };
    const cfg = { model: 'ollama/qwen3.8-27b-lms:medium', provider: { ollama: { models: { 'qwen3.8-27b-lms:medium': vorlage } } } };
    mitModell(cfg, 'ollama/qwen3.8:27b-nvfp4');
    expect(cfg.model).toBe('ollama/qwen3.8:27b-nvfp4');
    expect(cfg.provider.ollama.models['qwen3.8:27b-nvfp4' as keyof typeof cfg.provider.ollama.models]).toMatchObject({ ...vorlage, id: 'qwen3.8:27b-nvfp4' });
    expect(cfg.provider.ollama.models['qwen3.8-27b-lms:medium'].id).toBe('qwen3.8-27b-lms:latest');
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
