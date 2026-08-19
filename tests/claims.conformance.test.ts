/**
 * T-D1 (CR-GC-340) — the published numbers are asserted against the LIVING source.
 *
 * `docs/articles/*.md` and `README.md` state how many element types, connection
 * types, legal connection patterns, engine rules, readiness dimensions and MCP tools
 * graphcode has. Every one of those came out of a contracts version, and every
 * contracts bump can make them silently false — which is exactly what the claim
 * audit of 2026-08-15 found (37/66/22 written, 36/72/25 shipped).
 *
 * Same shape as the tool/skill counts CR-GC-205 already derives from the live
 * registry: no magic constant to bump, the source of truth IS the source.
 *
 * CONTRACT WITH THE PROSE (decided here, used by CR-GC-339's text sweep): each
 * number is written as `<digits> <canonical phrase>`, so the test matches a phrase
 * instead of parsing prose. Whitespace between the number and the phrase may include
 * a line break — the articles are hard-wrapped.
 *
 *   13 element types · 7 connection types · 36 legal connection patterns
 *   72 engine rules  · 8 readiness dimensions · 25 MCP tools
 *
 * "engine rules" rather than plain "rules" on purpose: the audit found the word
 * "rules" doing duty for BOTH the rule catalogue and the legal trace patterns, two
 * paragraphs apart. One word, one meaning.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import {
  ELEMENT_DESCRIPTIONS,
  TraceType,
  TRACE_PATTERNS,
  ALL_RULE_DEFS,
  RULE_TO_DIMENSION,
} from '@sigloch/contracts/se';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const REPO_ROOT = join(__dirname, '..');
const ARTICLES_DIR = join(REPO_ROOT, 'docs', 'articles');

/** Every published document whose numbers this test owns. */
function publishedDocs(): { rel: string; text: string }[] {
  const docs = readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ rel: join('docs/articles', f), text: readFileSync(join(ARTICLES_DIR, f), 'utf8') }));
  docs.push({ rel: 'README.md', text: readFileSync(join(REPO_ROOT, 'README.md'), 'utf8') });
  return docs;
}

/** `<digits><whitespace><phrase>` — the phrase may sit on the next line. */
function claimPattern(phrase: string): RegExp {
  return new RegExp(String.raw`(\d+)\s+${phrase.replace(/ /g, String.raw`\s+`)}`, 'g');
}

/** Line number of a character offset, 1-based — so a failure names a place, not a file. */
function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

interface Claim {
  /** The canonical phrase as it appears in the prose. */
  phrase: string;
  /** The living value, read from contracts or from the tool registry. */
  actual: () => number;
}

describe('T-D1 (CR-GC-340): every published count matches the living source', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let toolCount: number;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-claims-'));
    mkdirSync(join(tmp, '.graphcode'), { recursive: true });
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, '.graphcode/kuzu') });
    const config: HarnessConfig = {
      repoRoot: tmp,
      scope: { workspaceId: 'claims-ws', systemId: 'graphcode' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    };
    harness = new GraphCodeHarness(config, storage);
    await harness.initialize();
    // The tool count IS the live registry — never a hardcoded list (CR-GC-205).
    toolCount = Object.keys(bindToolsToHarness(harness)).length;
  });

  afterAll(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  const claims = (): Claim[] => [
    { phrase: 'element types', actual: () => Object.keys(ELEMENT_DESCRIPTIONS).length },
    { phrase: 'connection types', actual: () => TraceType.options.length },
    { phrase: 'legal connection patterns', actual: () => TRACE_PATTERNS.length },
    { phrase: 'engine rules', actual: () => ALL_RULE_DEFS.length },
    { phrase: 'readiness dimensions', actual: () => new Set(Object.values(RULE_TO_DIMENSION)).size },
    { phrase: 'MCP tools', actual: () => toolCount },
  ];

  it('states each count correctly wherever it appears', () => {
    const docs = publishedDocs();
    const wrong: string[] = [];

    for (const claim of claims()) {
      const expected = claim.actual();
      for (const doc of docs) {
        for (const m of doc.text.matchAll(claimPattern(claim.phrase))) {
          const found = Number(m[1]);
          if (found !== expected) {
            wrong.push(`${doc.rel}:${lineOf(doc.text, m.index)} — "${claim.phrase}": text says ${found}, live source says ${expected}`);
          }
        }
      }
    }

    expect(wrong).toEqual([]);
  });

  it('actually finds every claim — a phrase nobody uses would pass vacuously', () => {
    const docs = publishedDocs();
    const unused = claims()
      .filter((c) => !docs.some((d) => claimPattern(c.phrase).test(d.text)))
      .map((c) => c.phrase);

    // If a text sweep renames a phrase, the count assertion above silently stops
    // checking it. This is the guard against that: every canonical phrase must be
    // in use somewhere in the published set.
    expect(unused).toEqual([]);
  });

  it('the canonical phrases are unambiguous — "rules" alone never carries a count', () => {
    // The audit found "37 rules (constraints)" two paragraphs above "66 rules",
    // meaning two different things. Any bare "<n> rules" is that ambiguity coming
    // back; the catalogue is "engine rules", the grammar is "legal connection
    // patterns".
    const offenders: string[] = [];
    for (const doc of publishedDocs()) {
      for (const m of doc.text.matchAll(/(\d+)\s+rules\b/g)) {
        const preceding = doc.text.slice(Math.max(0, m.index - 20), m.index + m[0].length);
        if (/engine\s+rules\b/.test(preceding)) continue;
        offenders.push(`${doc.rel}:${lineOf(doc.text, m.index)} — bare "${m[0]}" (use "engine rules" or name the other thing)`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the six live values are the ones the audit recorded (canary for a contracts bump)', () => {
    // Not a second source of truth: this fails LOUDLY on a contracts bump so someone
    // re-reads the articles, instead of the prose drifting behind a green suite.
    // Update this list together with the text, never instead of it.
    expect(claims().map((c) => `${c.phrase}=${c.actual()}`)).toEqual([
      'element types=13',
      'connection types=7',
      'legal connection patterns=35',
      'engine rules=74',
      'readiness dimensions=8',
      'MCP tools=25',
    ]);
  });
});
