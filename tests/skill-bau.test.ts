/**
 * TEST-skill-bau (CR-GC-924): der Skill se-bau gibt dem Bau zwei Rollen, Koordinator (Hauptsitzung)
 * und Umsetzer (Agent). Der Test liest den Skilltext und prüft: beide Rollen, die acht Punkte des
 * Umsetzers, die Pflichten des Koordinators. Jede genannte Regel-ID steht in ALL_RULE_DEFS, jeder
 * genannte Skill liegt als Datei in .claude/commands. se-cdr entsteht parallel (CR-GC-922): seine
 * Datei wird nur geprüft, wenn sie existiert.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_RULE_DEFS } from '@sigloch/contracts/se';

const COMMANDS = join(__dirname, '..', '.claude', 'commands');
const DATEI = join(COMMANDS, 'se-bau.md');
const text = existsSync(DATEI) ? readFileSync(DATEI, 'utf8') : '';
const KATALOG = new Set(ALL_RULE_DEFS.map((r) => r.id));
const PRAEFIXE = [...new Set(ALL_RULE_DEFS.map((r) => r.id.slice(0, r.id.lastIndexOf('-'))))].sort((a, b) => b.length - a.length);
const ID_MUSTER = new RegExp(`\\b(${PRAEFIXE.join('|')})-\\d{2}\\b`, 'g');
const genannteIds = (t: string) => [...new Set([...t.matchAll(ID_MUSTER)].map((m) => m[0]))];

/** Text eines Abschnitts `## <titel>` bis zur nächsten `## `-Zeile. */
function abschnitt(titel: RegExp): string {
  const teile = text.split(/^## /m).slice(1);
  return teile.find((t) => titel.test(t.split('\n')[0])) ?? '';
}
const koordinator = () => abschnitt(/Koordinator/);
const umsetzer = () => abschnitt(/Umsetzer/);

describe('TEST-skill-bau (CR-GC-924)', () => {
  it('die Datei se-bau.md existiert, Name und Version stehen im Kopf', () => {
    expect(existsSync(DATEI)).toBe(true);
    expect(text).toMatch(/^name: se-bau$/m);
    expect(text).toMatch(/^version: 7$/m);
    expect(text).toMatch(/^description: .{40,}$/m);
  });

  it('beide Rollen haben einen eigenen Abschnitt', () => {
    expect(koordinator().length).toBeGreaterThan(200);
    expect(umsetzer().length).toBeGreaterThan(200);
  });

  describe('die acht Punkte des Umsetzers', () => {
    const punkte: [string, RegExp[]][] = [
      ['1 Auftrag ist der Ausschnitt graph_context', [/graph_context/, /Träger/]],
      ['2 Wert je Werteklasse an den Ort', [/Laufzeit-Parameter/, /Einstellungsspeicher/, /Verlauf/, /Start-Konfiguration/, /Pflichtfeld ohne Vorgabewert/, /Invariante/, /Konstante/, /Aufrufwert/]],
      ['3 Felder nur aus dem Vertragspaket, SCHEMA zuerst', [/Vertragspaket/, /feste[nr]? Version/, /SCHEMA/, /zuerst/]],
      ['4 vor neuer Regel oder Datei: hat die Datenart eine Quelle', [/Datenart/, /Quelle/]],
      ['5 fehlt etwas: stoppen und melden', [/stopp/i, /meld/i, /Wert/, /Feld/, /Rolle/, /Quelle/, /nichts an/i]],
      ['6 Test zuerst rot, Löschen nach se-umbau', [/se-test/, /rot/, /se-umbau/]],
      ['7 kein Schreiben am Modell, kein Ausrollen', [/Modell/, /ausroll/i]],
      ['8 Abschlussbericht nennt jede Annahme, auch keine', [/Abschlussbericht/, /Annahme/, /keine/]],
    ];
    for (const [name, muster] of punkte) {
      it(name, () => {
        const nr = name.split(' ')[0];
        const zeile = umsetzer().split('\n').find((z) => z.startsWith(`${nr}. `)) ?? '';
        expect(zeile, `Punkt ${nr} fehlt als nummerierte Zeile`).not.toBe('');
        // Punkt-Text: die Zeile plus ihre Folgezeilen bis zur nächsten Nummer oder Überschrift
        const rest = umsetzer().split('\n');
        const start = rest.indexOf(zeile);
        let ende = start + 1;
        while (ende < rest.length && !/^\d+\. |^#/.test(rest[ende])) ende++;
        const block = rest.slice(start, ende).join('\n');
        for (const m of muster) expect(block, String(m)).toMatch(m);
      });
    }
    it('genau acht nummerierte Punkte', () => {
      expect(umsetzer().split('\n').filter((z) => /^[1-9]\. /.test(z)).length).toBe(8);
    });
  });

  describe('Pflichten des Koordinators', () => {
    it('weicht der Modellstand vom CR ab: aise dispatch prepare neu, vor dem Start', () => {
      expect(koordinator()).toMatch(/Modellstand/);
      expect(koordinator()).toMatch(/aise dispatch prepare/);
    });
    it('ein Agent je CR der Gruppe, im eigenen Arbeitsordner', () => {
      expect(koordinator()).toMatch(/ein Agent je CR/i);
      expect(koordinator()).toMatch(/eigene[mn] Arbeitsordner/);
    });
    it('schreibt das Modell allein, rollt aus, schließt erst nach dem Testlauf auf der Zielumgebung', () => {
      expect(koordinator()).toMatch(/allein/);
      expect(koordinator()).toMatch(/testRefs/);
      expect(koordinator()).toMatch(/roll(?:t|st)[^.\n]*aus/i);
      expect(koordinator()).toMatch(/Testlauf[^.\n]*Zielumgebung/);
      expect(koordinator()).toMatch(/aise cr close/);
    });
    it('eine Rückfrage des Umsetzers geht an se-cdr, nicht an den Auftraggeber', () => {
      expect(koordinator()).toMatch(/Rückfrage[^.\n]*se-cdr/);
      expect(koordinator()).toMatch(/nicht[^.\n]*Auftraggeber/);
    });
    it('erzeugt je neuem oder geaendertem SCHEMA den Vertragstest mit dem Verb und bindet ihn (CR-GC-963)', () => {
      const k = koordinator();
      expect(k).toMatch(/graphcode vertragstest/);
      expect(k).toMatch(/neu[^.\n]*geänder|geänder[^.\n]*neu/);
      expect(k).toMatch(/tests\/vertrag\//);
      expect(k).toMatch(/verify/);
      expect(k).toMatch(/nicht von Hand/);
      expect(k).toMatch(/Exit 1/);
    });
    it('ein Vertrag hat kein z.custom, refine, superRefine; die Bedingung wird zu Varianten; bricht das Verb ab, ändert der Umsetzer den Vertrag (CR-GC-993)', () => {
      const k = koordinator();
      expect(k).toMatch(/kein `z\.custom`, kein `refine`, kein `superRefine`/);
      expect(k).toMatch(/Bedingung über mehrere\s+Felder wird zu Varianten/);
      expect(k).toMatch(/z\.discriminatedUnion/);
      expect(k).toMatch(/z\.function\(\)/);
      expect(k).toMatch(/Rückgabe einer\s+Funktion prüft ein gewöhnlicher Test/);
      expect(k).toMatch(/ändert der Umsetzer den Vertrag/);
      expect(k).toMatch(/Vertragstest von Hand für ein SCHEMA\s+mit Zod-Symbol gibt es nicht/);
      expect(k).not.toMatch(/beauftragst du einen Umsetzer mit dem Vertragstest von Hand/);
    });
    it('schreibt für ein SCHEMA mit Vertragsdatei den Test von Hand und bindet ihn mit tool manuell (CR-GC-965)', () => {
      const k = koordinator();
      expect(k).toMatch(/Vertragsdatei/);
      expect(k).toMatch(/\.vertrag\.md/);
      expect(k).toMatch(/tool: "manuell"/);
      expect(k).toMatch(/Kriterium/);
    });
    it('graph_mutate trägt skill: "se-bau"', () => {
      expect(text).toContain('skill: "se-bau"');
    });
  });

  describe('Verweise', () => {
    it('die Tabelle der Werteklassen steht im Skill', () => {
      expect(text).toMatch(/\|\s*Klasse\s*\|/);
      for (const k of ['Laufzeit-Parameter', 'Start-Konfiguration', 'Invariante', 'Aufrufwert', 'Berechneter Wert']) {
        expect(text.split('\n').some((z) => z.startsWith('| ') && z.includes(k)), k).toBe(true);
      }
    });
    it('jede genannte Regel-ID steht im Katalog, und der Skill nennt RC-04 und RC-09', () => {
      const ids = genannteIds(text);
      expect(ids).toEqual(expect.arrayContaining(['RC-04', 'RC-09']));
      expect(ids.filter((i) => !KATALOG.has(i))).toEqual([]);
    });
    it('Positivkontrolle: eine erfundene Regel-ID fällt auf', () => {
      const erfunden = genannteIds('siehe R-99 und RC-04');
      expect(erfunden.filter((i) => !KATALOG.has(i))).toEqual(['R-99']);
    });
    it('jeder genannte Skill liegt als Datei in .claude/commands (se-cdr nur, wenn die Datei schon besteht)', () => {
      const namen = [...new Set([...text.matchAll(/\bse(?:-[a-z]+)+\b/g)].map((m) => m[0]))].filter((n) => n !== 'se-bau');
      expect(namen.length).toBeGreaterThan(2);
      const fehlt = namen.filter((n) => n !== 'se-cdr' && !existsSync(join(COMMANDS, `${n}.md`)));
      expect(fehlt).toEqual([]);
      expect(namen).toContain('se-cdr');
      if (existsSync(join(COMMANDS, 'se-cdr.md'))) {
        expect(readFileSync(join(COMMANDS, 'se-cdr.md'), 'utf8')).toMatch(/^name: se-cdr$/m);
      }
    });
  });
});

describe('Headless im Koordinator (CR-GC-924, Entscheidung 2026-11-18, FAQ headless-keine-rueckfrage)', () => {
  const text = readFileSync(join(import.meta.dirname, '..', '.claude', 'commands', 'se-bau.md'), 'utf8');
  it('ohne Mensch wird die Frage eine Annahme ueber se:author-req, der Bericht nennt sie', () => {
    expect(text).toMatch(/Im Lauf ohne Mensch \(headless\) beantwortet niemand die Frage/);
    expect(text).toMatch(/se:author-req schreibt sie als Annahme/);
  });
});
