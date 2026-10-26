/**
 * CR-GC-860 — wer aus dem Ergebnis von graph_mutate je Befund das Element liest, fordert das Format an,
 * das je Befund ein Element trägt.
 *
 * Befund vom 2026-10-26: `se:import-doc` las `v.elementId` aus `graph_mutate`. Seit CR-GC-570 liefert das
 * Werkzeug per Default das Format `summary`: ein Eintrag je Regel und Meldungsmuster, die Elemente in
 * `elements`, die uid in `message` als `{el}`. Der Bericht trug deshalb `elementId: ""` und unersetzte
 * Platzhalter. Je Element mit `elementId` liefert nur `violations: "full"` — die Form von
 * `MutateResultSchema.violations` in `@sigloch/contracts/harness`.
 *
 * Zwei Zusicherungen:
 *   1. am echten Werkzeug: der Aufruf, wie der Skill ihn schreibt, liefert je Befund ein `elementId` und
 *      keinen Platzhalter; der Default liefert keins (Prämisse, sonst prüfte der Test nichts);
 *   2. jeder Leser im Repo, der `elementId` aus einem graph_mutate-Ergebnis liest, fordert `full` an.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { MutateResultSchema } from '@sigloch/contracts/harness';
import { createHarness, bindToolsToHarness, type GraphCodeHarness } from '../src/index.js';

const REPO = join(__dirname, '..');
const SKILL = join(REPO, '.claude', 'commands', 'se', 'import-doc.md');

/** Der Aufruf von graph_mutate in einem Text, als Objektliteral (`{ formatE, consumerId: …, … }`). */
const AUFRUF = /\['graph_mutate'\]\.handler\((\{[^}]*\})\)/g;

/** Das Objektliteral des Aufrufs auswerten, mit dem Format-E-Text an der Stelle von `formatE`. */
function argumenteAus(literal: string, formatE: string): Record<string, unknown> {
  return new Function('formatE', `return (${literal});`)(formatE) as Record<string, unknown>;
}

/** Die Dateien des Repos, in denen ein Leser von graph_mutate stehen kann. */
function leserDateien(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(md|mjs|mts|ts)$/.test(name)) out.push(p);
    }
  };
  walk(join(REPO, '.claude', 'commands'));
  walk(join(REPO, 'scripts'));
  return out;
}

let repoRoot: string;
let harness: GraphCodeHarness;
let tools: ReturnType<typeof bindToolsToHarness>;

/** Zwei FUNC ohne Bindung und ohne Anforderung: dieselben Regeln melden an beiden, also faltet `summary`. */
const ZUG = [
  '## Nodes',
  '### SYS',
  '+ SYS-s|Das System. [__name:S]',
  '### FUNC',
  '+ FUNC-a|Erste Funktion ohne Anforderung. [__name:A]',
  '+ FUNC-b|Zweite Funktion ohne Anforderung. [__name:B]',
].join('\n');

beforeEach(async () => {
  repoRoot = mkdtempSync(join(tmpdir(), 'gc-mutate-leser-'));
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  harness = await createHarness({ repoRoot, scope: { workspaceId: 'w', systemId: 's' } });
  await harness.initialize();
  tools = bindToolsToHarness(harness);
});
afterEach(async () => {
  await harness.close();
  rmSync(repoRoot, { recursive: true, force: true });
});

describe('CR-GC-860: Leser von graph_mutate lesen das Format mit elementId', () => {
  it('Prämisse: der Default `summary` trägt kein elementId, sondern elements und {el}', async () => {
    const res = (await tools.graph_mutate.handler({ formatE: ZUG, consumerId: 'test', dryRun: true })) as {
      violations: Array<Record<string, unknown>>;
    };
    expect(res.violations.length).toBeGreaterThan(0);
    expect(res.violations.some((v) => 'elementId' in v)).toBe(false);
    expect(res.violations.some((v) => Array.isArray(v.elements) && (v.elements as string[]).length > 1)).toBe(true);
    expect(res.violations.some((v) => String(v.message).includes('{el}'))).toBe(true);
  });

  it('se:import-doc ruft graph_mutate so, dass jeder Befund sein Element trägt und keinen Platzhalter', async () => {
    const skill = readFileSync(SKILL, 'utf8');
    const aufrufe = [...skill.matchAll(AUFRUF)].map((m) => m[1]);
    expect(aufrufe, 'der Skill ruft graph_mutate genau einmal').toHaveLength(1);
    const res = (await tools.graph_mutate.handler({ ...argumenteAus(aufrufe[0], ZUG), dryRun: true } as never)) as {
      violations: unknown;
    };
    const verstoesse = MutateResultSchema.shape.violations.parse(res.violations);
    expect(verstoesse.length).toBeGreaterThan(1);
    for (const v of verstoesse) {
      expect(v.elementId, `${v.ruleId}: ${v.message}`).toMatch(/^(SYS|FUNC)-/);
      expect(v.message).not.toContain('{el}');
    }
    expect(verstoesse.map((v) => v.elementId)).toEqual(expect.arrayContaining(['FUNC-a', 'FUNC-b']));
  });

  it('jeder Leser im Repo, der elementId aus graph_mutate liest, fordert violations: "full" an', () => {
    const leser = leserDateien().filter((p) => {
      const text = readFileSync(p, 'utf8');
      return [...text.matchAll(AUFRUF)].length > 0 && /\.elementId\b/.test(text);
    });
    expect(leser.map((p) => relative(REPO, p)), 'Prämisse: es gibt solche Leser').toContain('.claude/commands/se/import-doc.md');
    const ohneFull = leser.flatMap((p) =>
      [...readFileSync(p, 'utf8').matchAll(AUFRUF)]
        .filter((m) => !/violations:\s*'full'/.test(m[1]))
        .map((m) => `${relative(REPO, p)}: ${m[0]}`),
    );
    expect(ohneFull).toEqual([]);
  });
});
