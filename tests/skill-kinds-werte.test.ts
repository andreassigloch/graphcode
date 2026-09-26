/**
 * CR-GC-668 — Smeagol-Check Stufe (b): Wertebereiche. Jeder in einem Skill, Rundenprompt,
 * Executor-Vorbild oder Hilfetext genannte `kinds`-Wert liegt in `ReqKind`, und jedes dort
 * gezeigte `-satisfy-> REQ`-Paar mit deklarierten kinds ist nach `isValidTrace` legal.
 *
 * Stufe (a) (tests/skill-rule-ids.test.ts) prueft nur, ob eine genannte Regel-ID existiert. Ein
 * Skill, der einen gestrichenen oder erfundenen kinds-Wert lehrt, blieb dort gruen — beim ersten
 * Lauf fand dieser Test `"negative"` in `se-view:fmea`, einen Wert, den es nie gab.
 *
 * Bewusst KEINE gepflegte Liste: die Werte kommen aus `ReqKind`, die Legalitaet aus
 * `isValidTrace` (R-18). Nach dem kinds-Umbau (CR-GC-668..674) wird dieser Test rot an genau den
 * Ratgebern, die noch alte Werte lehren — er ist die Arbeitsliste der Kette.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ReqKind, RULE_HELP, isValidTrace, type ElementType } from '@sigloch/contracts/se';
import { RULE_CLAUSE, GENERATION_TEMPLATE } from '../src/loop/generate.js';
import { SYSTEM, IDLE_NUDGE } from '../src/loop/executor-prompt.js';

const WERTE = new Set<string>(ReqKind.options);

/**
 * Eine Werteliste hinter `kinds`: `kinds ["a"]`, `kinds: ["a","b"]`, `"kinds": ["a"]`,
 * `` `kinds` ∋ `a` ``, `` `kinds`: `a` / `b` ``, `kinds` contains `"a"`, or `"b"`, `@kinds a,b`.
 * Ein Wert muss gequotet, in Backticks oder in eckigen Klammern stehen — sonst ist „kinds of data"
 * Prosa, keine Nennung. Einzige Ausnahme: das Format-E-Attribut `@kinds a,b`.
 */
const WERT = String.raw`[\`"']+[a-z][a-z-]*[\`"']*`;
const TRENNER = String.raw`\s*(?:,\s*(?:or\s+)?|/|\bor\b|\|)\s*`;
// Eine Klammerliste endet an ihrem `]` — sonst liest der Scan in `"kinds": ["risk"], "severity": 9`
// bis zum naechsten Attributnamen weiter.
const NENNUNG = new RegExp(
  String.raw`kinds[\`"]?\s*(?::|=|∋|\binclude\b|\bcontains\b|\bin\b)?\s*(?:[\`"]*\[([^\]]*)\]|(${WERT}(?:${TRENNER}${WERT})*))`,
  'g',
);
const FORMAT_E = /@kinds\s+([a-z][a-z-]*(?:,[a-z][a-z-]*)*)/g;

/** Jeder genannte kinds-Wert in `text`, ohne Dubletten. */
export function genannteKinds(text: string): string[] {
  const werte = [
    ...[...text.matchAll(NENNUNG)].flatMap((m) => (m[1] ?? m[2]).match(/[a-z][a-z-]*/g) ?? []),
    ...[...text.matchAll(FORMAT_E)].flatMap((m) => m[1].split(',')),
  ];
  // `or` steht zwischen den Werten, nie in Quotes — aber die Wertklasse faengt es in `"a" or "b"`.
  return [...new Set(werte.filter((w) => w !== 'or'))];
}

/**
 * Jedes gezeigte Paar `X -satisfy-> REQ-y`, dessen REQ im selben Text kinds deklariert — als
 * Format-E-Kante oder als JSON-`add-edge` mit `edgeType: "satisfy"`. Der Typ der Quelle kommt aus
 * dem uid-Praefix (Konvention `TYPE-name`).
 */
export function illegalePaare(text: string): string[] {
  const kindsVon = new Map<string, string[]>();
  for (const m of text.matchAll(/(REQ-[\w-]+)[^\n]*?kinds"?\s*:?\s*\[([^\]]*)\]/g)) {
    kindsVon.set(m[1], m[2].match(/[a-z][a-z-]*/g) ?? []);
  }
  const paare = [
    ...[...text.matchAll(/\b([A-Z]+)-[\w-]+\s+-satisfy->\s+(REQ-[\w-]+)/g)].map((m) => [m[1], m[2]]),
    ...[...text.matchAll(/"sourceId"\s*:\s*"([A-Z]+)-[^"]*"\s*,\s*"targetId"\s*:\s*"(REQ-[^"]+)"\s*,\s*"edgeType"\s*:\s*"satisfy"/g)]
      .map((m) => [m[1], m[2]]),
  ];
  return paare
    .filter(([, req]) => kindsVon.has(req))
    .filter(([source, req]) => !isValidTrace({
      source: source as ElementType, target: 'REQ', type: 'satisfy',
      targetKinds: kindsVon.get(req) as ReqKind[],
    }))
    .map(([source, req]) => `${source} -satisfy-> ${req} (kinds ${kindsVon.get(req)!.join(',')})`);
}

function markdownDateien(dir: string): string[] {
  const out: string[] = [];
  for (const eintrag of readdirSync(dir)) {
    const p = join(dir, eintrag);
    if (statSync(p).isDirectory()) out.push(...markdownDateien(p));
    else if (p.endsWith('.md')) out.push(p);
  }
  return out;
}

/** Alle Ratgeber-Texte: Skills, Rundenprompt, Executor-Vorbild, Regel-Hilfe (beide Adressaten). */
function ratgeber(): Array<[string, string]> {
  const skills = markdownDateien(new URL('../.claude/commands', import.meta.url).pathname)
    .map((f): [string, string] => [f.split('/.claude/')[1] ?? f, readFileSync(f, 'utf8')]);
  const hilfe = Object.entries(RULE_HELP)
    .map(([id, h]): [string, string] => [`RULE_HELP ${id}`, JSON.stringify(h)]);
  return [
    ...skills,
    ['generate RULE_CLAUSE', JSON.stringify(RULE_CLAUSE)],
    ['generate GENERATION_TEMPLATE', JSON.stringify(GENERATION_TEMPLATE)],
    ['executor SYSTEM', SYSTEM],
    ['executor IDLE_NUDGE', IDLE_NUDGE],
    ...hilfe,
  ];
}

describe('TEST-skill-kinds-werte: genannte kinds-Werte und satisfy-Paare sind legal (CR-GC-668)', () => {
  it('Positivkontrolle — der Scan erkennt Werte, erfundene Werte und illegale Paare', () => {
    expect(genannteKinds('`kinds` ∋ `non-functional`')).toEqual(['non-functional']);
    expect(genannteKinds('kinds: "functional"/"precondition"/"postcondition" erfuellt')).toEqual(
      ['functional', 'precondition', 'postcondition']);
    expect(genannteKinds('`kinds` contains `"risk"`, `"mitigation"`, or `"negative"`, OR x')).toEqual(
      ['risk', 'mitigation', 'negative']);
    expect(genannteKinds('+ REQ-x @kinds functional,non-functional')).toEqual(['functional', 'non-functional']);
    expect(genannteKinds('many kinds of data at its edge')).toEqual([]);
    expect(genannteKinds('"kinds": ["risk"], "severity": 9')).toEqual(['risk']);
    expect(genannteKinds('`kinds: ["precondition"]` or `kinds: ["postcondition"]`')).toEqual(['precondition', 'postcondition']);
    expect(genannteKinds('`kinds` = `["non-functional"]`')).toEqual(['non-functional']);
    expect(illegalePaare('+ REQ-lat "Latenz" kinds ["non-functional"]\nFUNC-a -satisfy-> REQ-lat')).toEqual(
      ['FUNC -satisfy-> REQ-lat (kinds non-functional)']);
    expect(illegalePaare('+ REQ-f "F" kinds ["functional"]\nFUNC-a -satisfy-> REQ-f')).toEqual([]);
  });

  it('der Scan greift ueberhaupt — die Ratgeber nennen kinds-Werte', () => {
    const alle = ratgeber().flatMap(([, t]) => genannteKinds(t));
    expect(alle.length).toBeGreaterThan(10);
  });

  it('jeder genannte kinds-Wert liegt in ReqKind', () => {
    const fremd = ratgeber().flatMap(([quelle, text]) =>
      genannteKinds(text).filter((w) => !WERTE.has(w)).map((w) => `${quelle}: ${w}`));
    expect(fremd, `nicht in ReqKind {${[...WERTE].join(',')}}`).toEqual([]);
  });

  it('jedes gezeigte satisfy-Paar mit deklarierten kinds ist nach isValidTrace legal', () => {
    const illegal = ratgeber().flatMap(([quelle, text]) => illegalePaare(text).map((p) => `${quelle}: ${p}`));
    expect(illegal).toEqual([]);
  });
});
