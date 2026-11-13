/**
 * TEST systemmodell-in-bildern.katalog (CR-GC-926) — die Seite `docs/project/systemmodell-in-bildern.html`
 * gegen den Katalog in `@sigloch/contracts/se`.
 *
 * Die Seite nennt Zahlen, Bausteinarten, Verbindungsarten und deren erlaubte Paare. Jede Zahl trägt
 * eine Marke `data-katalog` (Wert im Text oder in `data-wert`). Zieht der Katalog an, ohne dass die
 * Seite mitzieht, wird dieser Test rot. Anlass: Die Seite sagte „80 Regeln“, der Katalog hatte 81.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALL_RULE_DEFS,
  ElementType,
  MARK_STAGE,
  META_MODEL_VERSION,
  ONTOLOGY_VERSION,
  RULES_VERSION,
  STAGE_SETS,
  TRACE_PATTERNS,
  TraceType,
} from '@sigloch/contracts/se';

const HTML = readFileSync(join(__dirname, '..', 'docs', 'project', 'systemmodell-in-bildern.html'), 'utf8');

const strip = (s: string): string => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** Alle Werte einer Marke `data-katalog="<key>"`: `data-wert` oder der Text der Spanne. */
function marks(key: string): string[] {
  const re = new RegExp(`<span data-katalog="${key}"(?: data-wert="([^"]*)")?>([^<]*)</span>`, 'g');
  return [...HTML.matchAll(re)].map((m) => m[1] ?? m[2]);
}

function single(key: string): string {
  const all = marks(key);
  expect(all.length, `Marke ${key} fehlt auf der Seite`).toBeGreaterThan(0);
  expect(new Set(all).size, `Marke ${key} hat verschiedene Werte: ${all.join(', ')}`).toBe(1);
  return all[0];
}

const perStage = new Map<string, number>();
for (const r of ALL_RULE_DEFS) perStage.set(String(r.stage), (perStage.get(String(r.stage)) ?? 0) + 1);
const numbered = [...perStage].filter(([s]) => s !== 'immer').map(([, n]) => n);

/** Die Karten der Bausteine: Name → Code (SYS, UC, …). */
const cards = new Map<string, string>(
  [...HTML.matchAll(/<span class="name">([^<]+)<\/span><span class="code">([A-Z]+)<\/span>/g)].map((m) => [m[1], m[2]]),
);

describe('Systemmodell in Bildern gegen den Katalog (CR-GC-926)', () => {
  it('nennt den Stand des Katalogs, gegen den sie geschrieben ist', () => {
    expect(single('ontology-version')).toBe(ONTOLOGY_VERSION);
    expect(single('meta-model-version')).toBe(META_MODEL_VERSION);
    expect(single('rules-version')).toBe(RULES_VERSION);
  });

  it('jede Zahl über Regeln, Stufen und Marken stimmt mit dem Katalog', () => {
    expect(Number(single('regeln'))).toBe(ALL_RULE_DEFS.length);
    expect(Number(single('stufen'))).toBe(STAGE_SETS.length);
    expect(Number(single('marken'))).toBe(Object.keys(MARK_STAGE).length);
    expect(Number(single('regeln-immer'))).toBe(perStage.get('immer') ?? 0);
    expect(Number(single('regeln-je-stufe-min'))).toBe(Math.min(...numbered));
    expect(Number(single('regeln-je-stufe-max'))).toBe(Math.max(...numbered));
    expect(Number(single('regeln-stufe-1'))).toBe((perStage.get('1') ?? 0) + (perStage.get('immer') ?? 0));
  });

  it('die Stufenleiste hat die Stufen des Katalogs und jede Marke hinter ihrer Stufe', () => {
    const bar = HTML.slice(HTML.indexOf('<div class="stages"'), HTML.indexOf('</div>', HTML.indexOf('<div class="stages"')));
    // Stufe: `<span class="stage">5 Funktion</span>` → 5 · Marke: `<span class="mark">…<small>PDR</small></span>` → 'PDR'
    const seq: Array<number | string> = [...bar.matchAll(/<span class="(stage|mark)">(.*?)<\/span>/g)].map((m) =>
      m[1] === 'stage' ? Number(m[2].split(' ')[0]) : /<small>([^<]+)<\/small>/.exec(m[2])![1],
    );
    const stages = seq.filter((x): x is number => typeof x === 'number');
    expect(stages).toEqual(STAGE_SETS.map((_, i) => i + 1));
    for (const [mark, stage] of Object.entries(MARK_STAGE)) {
      const at = seq.indexOf(mark);
      expect(at, `Marke ${mark} fehlt in der Stufenleiste`).toBeGreaterThan(0);
      expect(seq[at - 1], `Marke ${mark} steht nicht hinter Stufe ${stage}`).toBe(stage);
    }
  });

  it('die Bausteine sind genau die Elementarten des Katalogs', () => {
    expect([...new Set(cards.values())].sort()).toEqual([...ElementType.options].sort());
    expect(Number(single('bausteinarten'))).toBe(ElementType.options.length);
  });

  it('die Verbindungen sind genau die Arten des Katalogs, mit genau seinen erlaubten Paaren', () => {
    expect(Number(single('verbindungsarten'))).toBe(TraceType.options.length);
    const rows = [...HTML.matchAll(/<span class="code">([A-Z]+)<\/span><\/div>\s*<div class="text">[\s\S]*?<p class="pairs">Erlaubt: ([\s\S]*?)<\/p>/g)];
    expect(rows.map((r) => r[1].toLowerCase()).sort()).toEqual([...TraceType.options].sort());

    const code = (name: string): string => {
      const c = cards.get(name.trim());
      if (!c) throw new Error(`Baustein „${name.trim()}“ in den erlaubten Paaren hat keine Karte`);
      return c;
    };
    for (const [, type, raw] of rows) {
      const text = strip(raw).replace(/\([^)]*\)/g, '').replace(/genau ein(e)? /g, '');
      const pairs = new Set<string>();
      for (const segment of text.split(' · ')) {
        const sides = segment.split('→').map((side) => side.split(',').map(code));
        for (let i = 0; i + 1 < sides.length; i++) {
          for (const s of sides[i]) for (const t of sides[i + 1]) pairs.add(`${s}→${t}`);
        }
      }
      const expected = TRACE_PATTERNS.filter((p) => p.type === type.toLowerCase()).map((p) => `${p.source}→${p.target}`);
      expect([...pairs].sort(), `erlaubte Paare von ${type}`).toEqual([...expected].sort());
    }
  });
});
