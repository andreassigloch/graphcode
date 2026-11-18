/**
 * TEST-skill-cdr (CR-GC-922) — der Skill se-cdr prüft die Spezifikation vor dem Bauplan.
 *
 * Zwei Schichten: (1) Lint im Gate über rules_get_violations, ein Befund stoppt; (2) je Blattfunktion
 * ein Agent ohne Vorwissen, der nur graph_context und die Zod-Schemas an den Flüssen liest.
 * Der Skill schreibt nichts ins Modell; Antworten schreibt se:author-req.
 * Quelle der Marke CDR: Stufe 8 (MARK_STAGE in @sigloch/contracts/se, readiness).
 * Skills führen keine eigene Regelliste (FAQ skill-keine-eigene-rechnung): Der Test prüft nur,
 * dass jede genannte ID im Katalog steht.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_RULE_DEFS, MARK_STAGE } from '@sigloch/contracts/se';

const DATEI = join(__dirname, '..', '.claude', 'commands', 'se-cdr.md');
const text = existsSync(DATEI) ? readFileSync(DATEI, 'utf8') : '';
const KATALOG = new Set(ALL_RULE_DEFS.map((r) => r.id));

describe('TEST-skill-cdr: Review vor dem Bauplan (CR-GC-922)', () => {
  it('Prämisse: die Marke CDR liegt auf Stufe 8, R-26 liegt auf Stufe 8', () => {
    expect(MARK_STAGE.CDR).toBe(8);
    expect(ALL_RULE_DEFS.find((r) => r.id === 'R-26')?.stage).toBe(8);
  });

  it('der Skill existiert mit Kopf name und version (Version steht im Block der Probe)', () => {
    expect(text).toMatch(/^---\nname: se-cdr\nversion: \d+\ndescription: .+\n---/);
  });

  it('Schicht 1: Lint über rules_get_violations, ein Befund stoppt das Review', () => {
    expect(text).toMatch(/rules_get_violations\(\{ detail: "summary" \}\)/);
    expect(text).toMatch(/Stufe 8|stage 8/);
    expect(text).toMatch(/A finding stops the review/);
  });

  it('Schicht 2: je Blattfunktion ein Agent ohne Vorwissen, nur graph_context und Zod-Schemas', () => {
    expect(text).toMatch(/one agent per leaf function/i);
    expect(text).toMatch(/no prior knowledge/i);
    expect(text).toMatch(/`graph_context`/);
    expect(text).toMatch(/Zod schemas? at (its|the) flows?/);
  });

  it('die fünf Fragearten stehen im Text', () => {
    expect(text).toMatch(/date the requirement names is missing as a field of the SCHEMA/i);
    expect(text).toMatch(/value, role or source is missing/i);
    expect(text).toMatch(/contradicts an invariant (at|on) (the )?SYS or MOD/i);
    expect(text).toMatch(/carrier does not read the data/i);
    expect(text).toMatch(/operating question is open \(user, rights, place of the data\)/i);
  });

  it('der Skill schreibt nichts ins Modell, Antworten schreibt se:author-req', () => {
    expect(text).toMatch(/writes nothing into the model/i);
    expect(text).toMatch(/se:author-req/);
    expect(text).not.toMatch(/graph_mutate/); // sonst verlangt skill-nennt-parameter skill: "se-cdr"
  });

  it('eine Frage, die nur eine Messung klärt, wird ein Versuch vor dem Plan', () => {
    expect(text).toMatch(/only a measurement answers[^.]*experiment before the plan/i);
  });

  it('Ergebnis: Liste der Fragen je Funktion, leer heißt baureif', () => {
    expect(text).toMatch(/list of questions per function/i);
    expect(text).toMatch(/empty list means ready to build|an empty list: ready to build/i);
  });

  it('Bedingung baureif: jedes SCHEMA an den Flüssen trägt realRef auf ein Zod-Schema (R-26, RC-08)', () => {
    expect(text).toMatch(/`realRef`/);
    expect(text).toMatch(/R-26/);
    expect(text).toMatch(/RC-08/);
  });

  it('jede genannte Regel-ID steht im Katalog (Positivkontrolle: R-99 nicht)', () => {
    expect(KATALOG.has('R-99')).toBe(false);
    const ids = [...text.matchAll(/\b(?:R|RC|FC|SC|ND|AF)-\d{2}\b/g)].map((m) => m[0]);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((i) => !KATALOG.has(i))).toEqual([]);
  });

  it('Grenze: der Umsetzer entscheidet nichts, was das Verhalten ändert; Vorgänger und Nachfolger', () => {
    expect(text).toMatch(/implementer decides nothing that changes behaviour/i);
    expect(text).toMatch(/se-plan/);
  });
});

describe('Entscheidungen des Autors 2026-11-18 (CR-GC-922)', () => {
  const text = readFileSync(join(import.meta.dirname, '..', '.claude', 'commands', 'se-cdr.md'), 'utf8');

  it('der Stopp zaehlt nur Befunde an den Blattfunktionen im Review, ihren Fluessen und SCHEMA', () => {
    expect(text).toMatch(/Count only the findings of stage 8 or lower at the leaf functions under review, at their flows and at the SCHEMA of those flows/);
    expect(text).toMatch(/A finding elsewhere in the model does not stop this review/);
  });

  it('headless: offene Fragen werden Annahmen ueber se:author-req (FAQ headless-keine-rueckfrage)', () => {
    expect(text).toMatch(/Headless run: no one can answer\. Hand each open question to `se:author-req` as an assumption/);
    expect(text).not.toMatch(/list the questions as open/);
  });
});

describe('Abgleich ueber die Funktionen und Rangfolge (CR-GC-922, Probe 2026-11-18)', () => {
  // Probe an immo-infra Stand 196: je Funktion ein Agent fand die Luecken zwischen zwei Funktionen
  // nicht (zwei Traeger fuer den Maklerwechsel, zwei Quellen fuer das Protokoll der Laeufe) und
  // lieferte rund 170 Fragen fuer drei Funktionen.
  const text = readFileSync(join(import.meta.dirname, '..', '.claude', 'commands', 'se-cdr.md'), 'utf8');
  const abgleich = text.slice(text.indexOf('## 3. Across the functions'), text.indexOf('## 4.'));

  it('Version 2', () => {
    expect(text).toMatch(/^version: 2$/m);
  });

  it('ein weiterer Agent ohne Vorwissen liest alle Blattfunktionen auf einmal', () => {
    expect(abgleich.length).toBeGreaterThan(0);
    expect(abgleich).toMatch(/one more agent without prior knowledge/);
    expect(abgleich).toMatch(/reads every leaf function under review at once/);
  });

  it('er sucht genau zwei Faelle: zwei Traeger und zwei Quellen', () => {
    expect(abgleich).toMatch(/\*\*Two carriers\.\*\*/);
    expect(abgleich).toMatch(/\*\*Two sources\.\*\*/);
  });

  it('jede Frage traegt einen Rang, die Verhaltensfragen gehen zuerst an den Autor', () => {
    expect(text).toMatch(/\*\*Rank every question\.\*\* Mark it `behaviour`/);
    expect(text).toMatch(/The author gets the `behaviour` questions first/);
    expect(text).toMatch(/rank \(`behaviour` or `detail`\)/);
  });
});
