/**
 * CR-GC-571 — Smeagol-Check Stufe (a): jede in einem Skill oder Rundenprompt genannte
 * Regel-ID steht im Katalog.
 *
 * Befund: `se:author-uc` behauptete *"a UC with no `compose` raises R-14"*. **R-14 gibt es
 * nicht** — die Regel wurde mit CR-SM-294/295 gestrichen, der Satz blieb stehen. Der Skill
 * wird in JEDE `uc`- und `seed:uc`-Runde injiziert; das Modell las die Falschaussage in
 * jeder UC-Runde. Gefunden wurde sie nicht von einem Test, sondern von Hand.
 *
 * Derselbe Scan fand beim ersten Lauf zwei weitere: `FC-01` in `se-fmea` und `R-03` in
 * `se-view:fmea`, beide ebenfalls gestrichene Regeln. Drei von 20 genannten IDs waren
 * erfunden — genau die Klasse, die keine Bindung und kein Gate erreicht, weil sie in Prosa
 * steht.
 *
 * Bewusst KEINE gepflegte Liste: Praefixe und IDs kommen aus `ALL_RULE_DEFS`. Eine neue
 * Regelfamilie ist damit automatisch abgedeckt, eine gestrichene Regel faellt automatisch
 * auf — eine zweite Liste waere derselbe Fehler noch einmal.
 *
 * Was dieser Test NICHT prueft: ob die Aussage ÜBER die Regel stimmt (Stufe c der CR).
 * Er prueft die Existenz, nicht die Wahrheit.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_RULE_DEFS } from '@sigloch/contracts/se';
import { RULE_CLAUSE, GENERATION_TEMPLATE } from '../src/loop/generate.js';
import { SYSTEM, IDLE_NUDGE } from '../src/loop/executor-prompt.js';

const KATALOG = new Set(ALL_RULE_DEFS.map((r) => r.id));

/**
 * Was wie eine Regel-ID aussieht: ein Praefix aus dem Katalog plus zwei Ziffern.
 * Zwei Ziffern, weil der Katalog durchgehend nullgepolstert ist (`R-01`, `UC-03`) — uids
 * wie `MS-1-specification` haben nur eine und fallen damit nicht faelschlich hinein.
 */
const ID_MUSTER = new RegExp(
  '\\b(' +
    [...new Set(ALL_RULE_DEFS.map((r) => r.id.slice(0, r.id.lastIndexOf('-'))))]
      .sort((a, b) => b.length - a.length)
      .join('|') +
    ')-\\d{2}\\b',
  'g',
);

function markdownDateien(dir: string): string[] {
  const out: string[] = [];
  for (const eintrag of readdirSync(dir)) {
    const p = join(dir, eintrag);
    if (statSync(p).isDirectory()) out.push(...markdownDateien(p));
    else if (p.endsWith('.md')) out.push(p);
  }
  return out;
}

/** Jede ID-foermige Nennung in `text`, ohne Dubletten. */
function genannteIds(text: string): string[] {
  return [...new Set([...text.matchAll(ID_MUSTER)].map((m) => m[0]))];
}

describe('TEST-skill-rule-ids: keine erfundenen Regeln in Skills und Prompts (CR-GC-571)', () => {
  const skills = markdownDateien(new URL('../.claude/commands', import.meta.url).pathname);

  it('der Scan greift ueberhaupt — die Skills nennen Regeln, und der Katalog ist nicht leer', () => {
    // Ohne diese Kontrolle wuerde ein kaputtes Muster als "alles sauber" durchgehen.
    expect(KATALOG.size).toBeGreaterThan(50);
    expect(skills.length).toBeGreaterThan(10);
    const alle = skills.flatMap((f) => genannteIds(readFileSync(f, 'utf8')));
    expect(alle.length).toBeGreaterThan(10);
    // Und das Muster erkennt eine erfundene ID wirklich als solche.
    expect(genannteIds('a UC with no compose raises R-14.')).toEqual(['R-14']);
    expect(KATALOG.has('R-14')).toBe(false);
  });

  it('jede in einem Skill genannte Regel-ID steht im Katalog', () => {
    const erfunden: string[] = [];
    for (const datei of skills) {
      for (const id of genannteIds(readFileSync(datei, 'utf8'))) {
        if (!KATALOG.has(id)) erfunden.push(`${datei.split('/.claude/')[1] ?? datei}: ${id}`);
      }
    }
    expect(erfunden).toEqual([]);
  });

  it('jede im Rundenprompt genannte Regel-ID steht im Katalog', () => {
    // Der Weg, der das Modell WIRKLICH erreicht: Klausel-Schluessel, Klauseltexte,
    // Dimensions-Vorlagen und die beiden Konstanten des Executors.
    const texte = [
      ...Object.keys(RULE_CLAUSE),
      ...Object.entries(RULE_CLAUSE).map(([, k]) => k.text(['UID-1'])),
      ...Object.values(GENERATION_TEMPLATE),
      SYSTEM,
      IDLE_NUDGE,
    ];
    const erfunden = texte.flatMap(genannteIds).filter((id) => !KATALOG.has(id));
    expect([...new Set(erfunden)]).toEqual([]);
  });

  it('die Schluessel von RULE_CLAUSE sind Regeln, keine freien Namen', () => {
    // Eine Klausel unter einem Schluessel, den keine Regel stellt, wird NIE gerendert —
    // ein toter Kanal, den nur ein Lauf entlarvt haette.
    for (const schluessel of Object.keys(RULE_CLAUSE)) expect(KATALOG.has(schluessel)).toBe(true);
  });
});
