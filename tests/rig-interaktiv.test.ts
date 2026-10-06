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
import { fragen, naechsteNachricht, ende, ZIEL, zielText, blattLesen, blattTreffer, frageArt, analyseIn, sitzungswechsel, aufgabeLaden, POLITIK, STILLSTAND, FREIGABE, ZUSTIMMUNG, WEITER, OFFEN, OFFEN_EINZELN, DEINE_ENTSCHEIDUNG, ANALYSEN_NEIN, ANALYSEN_JA, NOCH_NICHT, MACH_WEITER } from '../rig/simulator.mjs';
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

/** lokal-1 (todo-warnungsfrei, 2026-10-05), Ende von Zug 1: eine Entscheidungsfrage am Modell. */
const FRAGE_MODELL = `Bleibt **R-10**: \`FLOW-ausgabe\` hat keinen Producer.

**Frage zu R-10 / \`FLOW-ausgabe\`:**
1. Ist \`FLOW-ausgabe\` redundant (die spezifischen FLOWs decken alles ab) → löschen (inkl. ihrer Kanten)?
2. Oder soll sie die generische „Terminal-Ausgabe" darstellen → welcher Producer (z.B. \`FUNC-list\` als primäre Ausgabefunktion)?

Ich warte auf deine Antwort, bevor ich R-10 behandle.`;

/** frontier-1 (todo-warnungsfrei, 2026-10-05), Ende von Zug 1: welche Analysen? */
const FRAGE_ANALYSEN = `**Offen (AF-01 bis AF-05, je 1× am System Todo-CLI)**
Einsatzkonzept (ConOps), Trade Study, Annahmen-Review, FMEA und Bauplan sind nicht durchgeführt.

**Fragen**
1. Welche der fünf Analysen soll ich durchführen, und welche nehme ich ab?`;

const lage = (extra: object) => ({ vorschlag: null, blattGegeben: true, antwortblatt: korpus.antwortblatt, antworten: korpus.antworten, gebaut: true, ...extra });
const arten = (n: { entscheidungen: { art: string }[] }) => n.entscheidungen.map((e) => e.art);

describe('CR-GC-715/742: Nutzer-Simulator', () => {
  it('erkennt echte Fragen, nicht die Bitte um Zustimmung zum Vorgehen — eine Zustimmung zu Inhalt bleibt eine Frage', () => {
    expect(fragen(ZUG1)).toHaveLength(2);
    expect(fragen('Im Modell: drei Abläufe.\n\nSoll ich mit Schritt 3 weitermachen?')).toEqual([]);
    expect(fragen('Soll ich „keine Anmeldung, keine Geheimnisse" als Anforderung festschreiben?')).toHaveLength(1);
  });

  it('das Blatt trägt Stichworte für den Abgleich; der Nutzer (und der Gutachter) sieht sie nie', () => {
    expect(korpus.antwortblatt).not.toContain('[');
    expect(korpus.antwortblatt).toContain('- Die Datei heißt todos.json und liegt im Arbeitsverzeichnis.');
    expect(korpus.antworten).toHaveLength(8);
    expect(blattLesen('Kopf\n- [a, B c] Antwort eins\n- ohne Stichwort')).toEqual({ text: 'Kopf\n- Antwort eins\n- ohne Stichwort', eintraege: [{ stichworte: ['a', 'b c'], text: 'Antwort eins' }] });
    expect(blattTreffer('Wie heißt die Datei, todos.json?', korpus.antworten).map((e: { text: string }) => e.text)).toEqual(['Die Datei heißt todos.json und liegt im Arbeitsverzeichnis.']);
    expect(frageArt('Welches Format hat die Ausgabe?', korpus.antworten)).toBe('wissen');
    expect(frageArt('Reicht ein Modul (`MOD-todo`)?', korpus.antworten)).toBe('blatt');
    expect(frageArt('Liegt die Test-Datei im Arbeitsverzeichnis?', korpus.antworten)).toBe('blatt');
    expect(frageArt('Braucht die Test-Datei ein Format?', korpus.antworten)).toBe('wissen');
  });

  it('Zug 1 mit Wissensfragen: das ganze Antwortblatt, dann die Zustimmung zum Plan — nichts erfunden', () => {
    const n = naechsteNachricht(lage({ antwort: ZUG1, blattGegeben: false, gebaut: false }));
    expect(n.nachricht).toBe(`${korpus.antwortblatt}\n\n${OFFEN}\n\n${ZUSTIMMUNG}`);
    expect(n.blattGegeben).toBe(true);
    expect(n.beantwortet).toBe(2);
    expect(arten(n)).toEqual(['blatt-ganz', 'zustimmung']);
  });

  it('fragt der Agent nichts, ist graphcodes Vorschlag die Nachricht', () => {
    const v = 'Lege für die Abläufe add, list, done Anforderungen mit Test an.';
    const n = naechsteNachricht(lage({ antwort: 'Im Modell: …\nSoll ich weitermachen?', vorschlag: v }));
    expect(n.nachricht).toBe(v);
    expect(n.vorschlag).toBe(v);
    expect(arten(n)).toEqual(['vorschlag']);
  });

  it('spätere Wissensfrage: die passende Zeile des Blatts, sonst „offen" — nie das Blatt noch einmal; danach der Vorschlag, wie im Handlauf', () => {
    const v = 'Lege für die Abläufe add, list, done Anforderungen mit Test an.';
    const treffer = naechsteNachricht(lage({ antwort: 'Was passiert bei einer kaputten Datei?', vorschlag: v }));
    // Nie mit einem Strich beginnen: `opencode run` liest das als Option und bricht ab (lokal-9, 2026-10-05).
    expect(treffer.nachricht).toBe(`Kaputte oder ungültige JSON-Datei: Fehlermeldung, Exit-Code 1.\n\n${v}`);
    expect(treffer.nachricht.startsWith('-')).toBe(false);
    expect(treffer.vorschlag).toBe(v);
    expect(arten(treffer)).toEqual(['blatt-zeile', 'vorschlag']);
    const ohne = naechsteNachricht(lage({ antwort: 'Welches Format hat die Ausgabe?' }));
    expect(ohne.nachricht).toBe(`${OFFEN_EINZELN}\n\n${WEITER}`);
    expect(arten(ohne)).toEqual(['offen', 'zustimmung']);
    // Eine Zustimmung zu Inhalt, den das Blatt nicht deckt, wäre eine Vorgabe — er stimmt nicht zu.
    const inhalt = naechsteNachricht(lage({ antwort: 'Soll ich „keine Anmeldung, keine Geheimnisse" als Anforderung festschreiben?', vorschlag: v }));
    expect(inhalt.nachricht).toBe(`${OFFEN_EINZELN}\n\n${v}`);
  });

  it('Entscheidungsfrage am Modell (lokal-1, R-10): eine Antwort — weder Blatt noch graphcodes Vorschlag', () => {
    const n = naechsteNachricht(lage({ antwort: FRAGE_MODELL, blattGegeben: false, vorschlag: 'Vervollständige die Datenflüsse Terminal-Ausgabe: woher sie kommen und wohin sie gehen.' }));
    expect(n.nachricht).toBe(`${DEINE_ENTSCHEIDUNG}\n\n${MACH_WEITER}`);
    expect(n.blattGegeben).toBe(false);
    expect(arten(n)).toEqual(['modell-entscheidung', 'modell-entscheidung', 'vorschlag-zurueckgestellt']);
  });

  it('Analysefrage (frontier-1): die Politik der Aufgabe antwortet', () => {
    const nein = naechsteNachricht(lage({ antwort: FRAGE_ANALYSEN, politik: { analysen: 'ablehnen', freigabe: 'bei-ziel' }, vorschlag: 'Führe das Einsatzkonzept (ConOps) durch.' }));
    expect(nein.nachricht).toBe(`${ANALYSEN_NEIN}\n\n${MACH_WEITER}`);
    expect(arten(nein)).toEqual(['analyse-antwort', 'vorschlag-zurueckgestellt']);
    expect(naechsteNachricht(lage({ antwort: FRAGE_ANALYSEN })).nachricht).toBe(`${ANALYSEN_JA}\n\n${MACH_WEITER}`);
    expect(aufgabeLaden('todo-warnungsfrei').politik).toEqual({ analysen: 'ablehnen', freigabe: 'bei-ziel' });
    expect(korpus.politik).toEqual(POLITIK);
  });

  it('Politik am Vorschlag: Analysen ablehnen, Freigabe erst am Ziel — mit dem Stand, der noch fehlt', () => {
    const politik = { analysen: 'ablehnen', freigabe: 'bei-ziel' };
    const befund = { fehler: 0, warnungen: 3, abgenommen: 5, offen: [{ regel: 'CR-R02', element: 'CR-a' }, { regel: 'CR-R02', element: 'CR-b' }, { regel: 'R-10', element: 'FLOW-x' }] };
    const text = zielText('warnungsfrei', befund);
    expect(text).toBe('Die Regelprüfung meldet noch 3 offene Warnungen: CR-R02 ×2, R-10.');
    expect(zielText('modellieren', befund)).toBeNull();
    const analyse = naechsteNachricht(lage({ antwort: 'Fertig.', vorschlag: 'Führe das Einsatzkonzept (ConOps) durch.', politik, ziel: { erreicht: false, text } }));
    expect(analyse.nachricht).toBe(`${ANALYSEN_NEIN} ${text}`);
    expect(analyse.vorschlag).toBeNull();
    expect(arten(analyse)).toEqual(['analyse-abgelehnt']);
    const zuFrueh = naechsteNachricht(lage({ antwort: 'Fertig.', vorschlag: FREIGABE, politik, ziel: { erreicht: false, text } }));
    expect(zuFrueh.nachricht).toBe(`${NOCH_NICHT} ${text}`);
    expect(arten(zuFrueh)).toEqual(['freigabe-verweigert']);
    expect(naechsteNachricht(lage({ antwort: 'Fertig.', vorschlag: FREIGABE, politik, ziel: { erreicht: true, text: null } })).nachricht).toBe(FREIGABE);
    // Wie im Handlauf (Vorgabe): der Nutzer folgt dem Analyse-Vorschlag und gibt frei, wenn graphcode es vorschlägt.
    expect(naechsteNachricht(lage({ antwort: 'Fertig.', vorschlag: 'Führe das Einsatzkonzept (ConOps) durch.' })).nachricht).toBe('Führe das Einsatzkonzept (ConOps) durch.');
    expect(naechsteNachricht(lage({ antwort: 'Fertig.', vorschlag: FREIGABE })).nachricht).toBe(FREIGABE);
  });

  it('ohne Vorschlag nach dem ersten Bau: weiter, nicht wieder „Schritt 1"', () => {
    expect(naechsteNachricht(lage({ antwort: 'Gelesen.' })).nachricht).toBe(WEITER);
    expect(naechsteNachricht(lage({ antwort: 'Gelesen.', gebaut: false })).nachricht).toBe(ZUSTIMMUNG);
  });

  it('endet nach der abgeschickten Freigabe oder am Zuglimit', () => {
    expect(ende(3, 12, FREIGABE)).toBe('freigabe');
    expect(ende(12, 12, 'x')).toBe('zuglimit');
    expect(ende(3, 12, 'x')).toBeNull();
    // Stillstand: mehrere Züge in Folge ohne angenommene Mutation — der Lauf dreht sich, er endet.
    expect(ende(5, 30, 'x', null, STILLSTAND)).toBe('stillstand');
    expect(ende(5, 30, 'x', null, STILLSTAND - 1)).toBeNull();
  });

  it('endet, sobald die Stufe ihr Ziel meldet: modellieren bei SRR und PDR, warnungsfrei ohne Fehler und Warnung', () => {
    expect(ZIEL.modellieren({ SRR: true, PDR: true, CDR: false })).toBe('srr+pdr');
    expect(ZIEL.modellieren({ SRR: true, PDR: false })).toBeNull();
    expect(ZIEL.modellieren({})).toBeNull();
    expect(ZIEL.warnungsfrei({ SRR: true, PDR: true }, { fehler: 0, warnungen: 0 })).toBe('warnungsfrei');
    expect(ZIEL.warnungsfrei({ SRR: true, PDR: true }, { fehler: 0, warnungen: 3 })).toBeNull();
    expect(ZIEL.warnungsfrei({}, null)).toBeNull();
    expect(ende(4, 30, 'x', 'srr+pdr')).toBe('srr+pdr');
    expect(ende(4, 30, 'x', null)).toBeNull();
    expect(Object.keys(STUFEN).sort()).toEqual(Object.keys(ZIEL).sort());
  });

  it('eine Aufgabe mit Basis startet auf dem Referenzgraphen einer anderen Aufgabe', () => {
    const a = aufgabeLaden('todo-warnungsfrei');
    expect(a.sequenz).toEqual(['warnungsfrei']);
    expect(a.basis).toBe(join(korpus.referenz('lokal'), 'graph.json'));
    expect(existsSync(a.basis)).toBe(true);
    expect(a.antwortblatt).toBe(korpus.antwortblatt);
    expect(korpus.basis).toBeNull();
    expect(korpus.stufenPrompt('warnungsfrei')).toBeNull();
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

describe('Aufgaben mit dem Skill als Auftrag (CR-GC-747)', () => {
  // Gemessen wird der Skilltext selbst. Eine Kopie, die vom Skill abweicht, misst etwas anderes als das,
  // was der Nutzer mit `se:close-violations` bekommt — deshalb wörtlich, und hier festgehalten.
  const skill = readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), '.claude', 'commands', 'se', 'close-violations.md'), 'utf8')
    .replace(/^---[\s\S]*?---\n\n/, '');
  // Der Name der zweiten Aufgabe ist kurz gehalten: der Pfad des Host-Sockets im Lauf-Repo darf 103 Zeichen nicht
  // überschreiten, sonst startet der Host nicht (ITEM-2026-761).
  for (const [name, vergleich] of [['todo-skill-warnungsfrei', 'todo-warnungsfrei'], ['todo-hand-skill-wf', 'todo-hand-warnungsfrei']]) {
    it(`${name}: start.md trägt den Skill wörtlich, Stufe und Politik wie die Vergleichsaufgabe`, () => {
      const a = aufgabeLaden(name);
      const v = aufgabeLaden(vergleich);
      expect(a.start).toContain(skill.trim());
      expect(a.politik).toEqual(v.politik);
      expect(a.basis).toBe(v.basis);
      expect(a.antworten).toEqual(v.antworten);
    });
  }
  it('eine Frage nach dem Entfernen eines benannten Elements ist eine Entscheidung am Modell (Lauf frontier-1, Zug 2)', () => {
    // Opus nennt Elemente beim Namen statt bei der uid; „entfernen" stand nicht in der Wortliste. Der Simulator
    // antwortete „als offen führen", der Agent führte den Befund offen, der Lauf endete im Stillstand.
    const blatt = aufgabeLaden('todo-skill-warnungsfrei').antworten;
    expect(frageArt('Soll ich **Terminal-Ausgabe** entfernen?', blatt)).toBe('modell');
    expect(frageArt('Soll der Fluss bleiben, also behalten, und der Befund angenommen werden?', blatt)).not.toBe('wissen');
  });
  it('der Skill nennt die drei Auswege und kein concept', () => {
    expect(skill).toMatch(/Fix it in the model/);
    expect(skill).toMatch(/Accept it with a reason/);
    expect(skill).toMatch(/Ask the user/);
    expect(skill).not.toMatch(/concept\s*:\s*true|@concept/);
  });
});
