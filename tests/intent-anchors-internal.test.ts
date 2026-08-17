/**
 * TEST-intent-anchors-internal (CR-GC-307) — anchors are steering internals.
 *
 * CR-GC-295 introduced intent anchors AND asked the human to confirm them in round 1.
 * The concept is ours, not the customer's: "Intentions-Anker" is a device for setting
 * the app targets. Observed in a frontier-LLM run, the model silently corrected the
 * proposed anchors later anyway — so the question bought neither information nor
 * control, it only put jargon into first contact. On a weak/local model the same step
 * is an extra failure source.
 *
 * The anchors stay (readiness measures coverage against them). What changes is WHO
 * sees them: nobody. When the intent is measurably too thin to derive them, the loop
 * asks DOMAIN questions in the customer's language instead — and the config is
 * written in the background.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  extractIntentAnchors,
  isIntentTooThin,
  persistIntentAnchors,
  loadTargetProfile,
  TARGET_PROFILE_REL,
} from '../src/target-profile.js';

/** Every string the human ever reads must be free of the steering vocabulary. */
const STEERING_JARGON = [/intentions?-?anker/i, /intent\s*anchor/i, /intentAnchors/];

describe('CR-GC-307: the anchor vocabulary never reaches a human-facing string', () => {
  it('the generate prompts carry no steering vocabulary', async () => {
    // Source-level grep: a review comment would let the term creep back on the next
    // edit. This is the enforcement.
    const src = readFileSync(new URL('../src/generate.ts', import.meta.url), 'utf8');
    // Kommentare ZUERST entfernen (CR-GC-358): der Literal-Match unten ist ein naiver
    // Quote-Scanner, und ein einzelnes Apostroph in deutscher Kommentar-Prosa ("don't",
    // "das Modell's") verschiebt seine Paarbildung um eins — danach ist jedes gemeldete
    // "Literal" ein Phantom-Ausschnitt quer über echten Code. Kommentare sind ohnehin
    // nicht das Schutzziel: geprüft wird, was ein MENSCH aus dem Prompt liest.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // Only the STRING LITERALS matter — code identifiers (profile.intentAnchors) are
    // internal and must keep their name.
    const literals = [...code.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
    for (const lit of literals) {
      for (const pattern of STEERING_JARGON) {
        // `intentAnchors` as a bare field reference inside a code string is fine;
        // what must not appear is prose ABOUT anchors aimed at a reader.
        if (pattern.test(lit) && /\s/.test(lit)) {
          throw new Error(`generate.ts prompt literal leaks steering vocabulary: ${lit}`);
        }
      }
    }
  });

  it('the readiness read-out keeps its machine-facing name (it is not customer text)', () => {
    // The contrast case: `intentCoverage` in graph_readiness is a machine read-out
    // consumed by tooling, NOT prose shown to a person. It must NOT be renamed —
    // otherwise this CR would break the CR-GC-295 contract it builds on.
    const src = readFileSync(new URL('../src/tools/report.ts', import.meta.url), 'utf8');
    expect(src).toContain('intentCoverage');
  });
});

describe('CR-GC-307: isIntentTooThin — a measured state, not a model hunch', () => {
  it('accepts an intent with three or more distinctive content words', () => {
    expect(isIntentTooThin('Ein Shop fuer Ersatzteile mit Bestellungen und Rechnungen')).toBe(false);
  });

  it('rejects an intent that yields fewer than three anchors', () => {
    // The schema demands 3..7 anchors, so there would be no valid config at all.
    expect(isIntentTooThin('Ein Shop')).toBe(true);
  });

  it('rejects an intent made only of generic tokens', () => {
    // "A system for managing data" parses fine and anchors nothing — every one of
    // those words matches almost any element, so coverage would read 100% while
    // saying nothing.
    expect(isIntentTooThin('Ein System zum Verwalten von Daten')).toBe(true);
    expect(isIntentTooThin('An app tool for managing data')).toBe(true);
  });

  it('an empty intent is too thin', () => {
    expect(isIntentTooThin('')).toBe(true);
    expect(isIntentTooThin('   ')).toBe(true);
  });

  it('generic tokens do not survive extraction either', () => {
    // isIntentTooThin must agree with what extractIntentAnchors actually produces —
    // two different notions of "generic" would drift apart silently.
    expect(extractIntentAnchors('Ein System zum Verwalten von Daten')).toEqual([]);
  });

  it('keeps domain words that merely LOOK generic in context', () => {
    // Guard against over-filtering: `bestellung` is the domain here even though the
    // sentence also carries generic scaffolding.
    const anchors = extractIntentAnchors('Ein System fuer Bestellungen von Ersatzteilen durch Kunden');
    expect(anchors).toContain('bestellungen');
    expect(anchors).toContain('ersatzteilen');
    expect(anchors).not.toContain('system');
  });
});

describe('CR-GC-307: persistIntentAnchors writes in the background without data loss', () => {
  let repo: string;
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'graphcode-anchors-'));
    mkdirSync(join(repo, '.graphcode'), { recursive: true });
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it('creates the config when none exists', () => {
    const written = persistIntentAnchors(repo, ['bestellung', 'ersatzteile', 'kunden']);
    expect(written).toBe(true);
    expect(loadTargetProfile(repo)?.profile.intentAnchors).toEqual(['bestellung', 'ersatzteile', 'kunden']);
  });

  it('MERGES — a hand-tuned weights block survives the background write', () => {
    // The regression that matters: silently overwriting the file would throw away a
    // target profile the human deliberately set.
    writeFileSync(
      join(repo, TARGET_PROFILE_REL),
      JSON.stringify({ weights: { coherence: 0.5, scalability: 1 } }, null, 2),
    );
    persistIntentAnchors(repo, ['bestellung', 'ersatzteile', 'kunden']);
    const loaded = loadTargetProfile(repo);
    expect(loaded?.profile.weights).toEqual({ coherence: 0.5, scalability: 1 });
    expect(loaded?.profile.intentAnchors).toEqual(['bestellung', 'ersatzteile', 'kunden']);
  });

  it('never overwrites anchors the human already confirmed', () => {
    writeFileSync(
      join(repo, TARGET_PROFILE_REL),
      JSON.stringify({ intentAnchors: ['handverlesen', 'zweitens', 'drittens'] }, null, 2),
    );
    const written = persistIntentAnchors(repo, ['abgeleitet', 'automatisch', 'egal']);
    expect(written).toBe(false);
    expect(loadTargetProfile(repo)?.profile.intentAnchors).toEqual(['handverlesen', 'zweitens', 'drittens']);
  });

  it('refuses to write an invalid anchor count instead of producing a broken config', () => {
    // The schema is 3..7. Writing 2 would make every later load throw — a background
    // step must not be able to poison the config.
    expect(persistIntentAnchors(repo, ['nur', 'zwei'])).toBe(false);
    expect(loadTargetProfile(repo)).toBeNull();
  });
});
