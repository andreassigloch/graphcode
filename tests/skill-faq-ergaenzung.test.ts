/**
 * CR-GC-942 und CR-GC-944 — Skills tragen die entschiedenen Sätze der FAQ, die ihrem Schritt fehlten, und nennen
 * den abgeschafften Parameter `commands` nicht mehr.
 *
 * Entschieden (FAQ test-wirklich-pruefend, positivkontrolle, typpruefung-tests, entfernen-reihenfolge,
 * referenzen-vor-nach-loeschen, befund-abnehmen, befund-stehen-lassen, diagnose-default-full,
 * testref-binden, format-e-vorbild, kante-aendern). Je Satz prüft ein Test sein Schlüsselwort.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const C = join(__dirname, '..', '.claude', 'commands');
const lies = (...p: string[]) => readFileSync(join(C, ...p), 'utf8');
const test = lies('se-test.md');
const umbau = lies('se-umbau.md');
const generate = lies('se', 'generate.md');
const closeV = lies('se', 'close-violations.md');
const review = lies('se-review.md');
const status = lies('se-status.md');
const authorReq = lies('se', 'author-req.md');
const optimize = lies('se', 'optimize.md');
const vorbereitung = lies('se-vorbereitung.md');
const fmea = lies('se-fmea.md');
const retro = lies('se-retro.md');

describe('TEST-skill-faq-ergaenzung (CR-GC-942)', () => {
  it('Prämisse: graph_mutate nimmt nur formatE, einen Parameter commands gibt es nicht', () => {
    const quelle = readFileSync(join(__dirname, '..', 'src', 'surface', 'write.ts'), 'utf8');
    const schema = quelle.slice(quelle.indexOf('const GraphMutateInputSchema'), quelle.indexOf('const GraphMutateInputSchema') + 700);
    expect(schema).toMatch(/formatE: z/);
    expect(schema).not.toMatch(/\bcommands: z/);
  });

  it('Nr. 2: se-test verlangt zu „nichts gefunden" eine Positivkontrolle', () => {
    expect(test).toMatch(/positive control/i);
  });

  it('Nr. 2: fehlte Red-first, macht der Agent die Funktion probeweise kaputt', () => {
    expect(test).toMatch(/break the function on purpose/i);
  });

  it('Nr. 2: behauptet wird eine Differenz über eine Stellgröße', () => {
    expect(test).toMatch(/control variable/i);
  });

  it('Nr. 2: die Verdrahtung hat einen eigenen Test, der ohne die Aufrufzeile rot wird', () => {
    expect(test).toMatch(/call line/i);
  });

  it('Nr. 2: ein grüner Testlauf belegt keine Typen, tsc --noEmit läuft zusätzlich', () => {
    expect(test).toMatch(/tsc --noEmit/);
  });

  it('Nr. 5: erst steht der Ersatz, dann ziehen die Verbraucher um, zuletzt fällt das Alte', () => {
    expect(umbau).toMatch(/Erst steht der Ersatz/);
    expect(umbau).toMatch(/Leser in anderen Repos/);
  });

  it('Nr. 5: graph_impact kennt nur die Nutzungskanten, die im Modell stehen', () => {
    expect(umbau).toMatch(/nur die Nutzungskanten, die im Modell stehen/);
  });

  it('Tabelle 3 Nr. 4: se:generate nennt weder commands-JSON noch update-edge', () => {
    expect(generate).not.toContain('commands`-JSON');
    expect(generate).not.toContain('update-edge');
    expect(generate).toMatch(/`graph_mutate` nimmt nur `formatE`/);
  });

  it('Tabelle 3 Nr. 4: eine Kante umhängen heißt löschen und anlegen in einem Batch', () => {
    expect(generate).toMatch(/Kante umhängen/);
    expect(generate).toMatch(/`- alt`.*`\+ neu`.*einem Batch/);
  });

  it('Nr. 8: die Marke zählt einen abgenommenen Befund weiter', () => {
    expect(closeV).toMatch(/mark still counts an accepted finding/);
  });

  it('Nr. 8: bleibt ein Befund einer Architekturregel stehen, steht der Grund in der Beschreibung', () => {
    expect(closeV).toMatch(/reason into the `description` of its element/);
  });

  it('Nr. 9: se-review und se-status nennen umfang.ausserhalb zu jeder Zählung', () => {
    expect(review).toMatch(/`umfang\.ausserhalb`/);
    expect(status).toMatch(/`umfang\.ausserhalb`/);
  });

  it('Nr. 17: die Testdatei nennt im Kopfkommentar genau eine TEST-uid', () => {
    expect(authorReq).toMatch(/header comment of the test file/);
    expect(authorReq).toMatch(/exactly one uid of the TEST/);
  });

  it('Nr. 17: eine Datei mit TEST bekommt keinen zweiten', () => {
    expect(authorReq).toMatch(/no second TEST/);
  });

  it('Nr. 6 (CR-GC-944): ein Vorschlag mit add-node geht als ein Batch durchs Gate, der Platzhaltername wird ersetzt', () => {
    expect(optimize).toMatch(/`edit\.node`.*als \*\*ein\*\* Batch.*Platzhalternamen/s);
  });

  it('Nr. 10 (CR-GC-944): ohne Beleg mit Datei und Zeile bleibt der Fluss ohne Merkmal', () => {
    expect(vorbereitung).toMatch(/ohne Beleg lass das Merkmal weg/);
    expect(vorbereitung).toMatch(/Eine Ablage hat keine Sonderbehandlung/);
  });

  it('Nr. 12 (CR-GC-944): zu einem gelassenen Risiko gehört ein ungebundener TEST', () => {
    expect(fmea).toMatch(/unbound `TEST`/);
  });

  it('Nr. 16 (CR-GC-944): die Bindungsquote steht nie allein, die Deckung steht daneben', () => {
    expect(retro).toMatch(/never alone.*coverage of the repo/s);
  });

  it('die Versionen stehen höher', () => {
    const v = (t: string) => Number(t.match(/^version: (\d+)$/m)![1]);
    expect(v(test)).toBeGreaterThanOrEqual(3);
    expect(v(umbau)).toBeGreaterThanOrEqual(4);
    expect(v(generate)).toBeGreaterThanOrEqual(7);
    expect(v(closeV)).toBeGreaterThanOrEqual(6);
    expect(v(review)).toBeGreaterThanOrEqual(4);
    expect(v(status)).toBeGreaterThanOrEqual(4);
    expect(v(authorReq)).toBeGreaterThanOrEqual(5);
    expect(v(optimize)).toBeGreaterThanOrEqual(10);
    expect(v(vorbereitung)).toBeGreaterThanOrEqual(11);
    expect(v(fmea)).toBeGreaterThanOrEqual(14);
    expect(v(retro)).toBeGreaterThanOrEqual(8);
  });
});
