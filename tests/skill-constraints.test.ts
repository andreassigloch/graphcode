/**
 * CR-GC-852 — der Skill `se:constraints` (vormals `se:target-profile`) fragt je Dimension nach einem
 * Element und einer Eigenschaft und schreibt die Antwort als Constraint: nicht-funktionale REQ an Kette,
 * Modul oder System mit einem TEST, der den Snapshot liest. Nie ein Gewicht.
 *
 * Der Test bindet den Skill-Text an die Verträge, die er nennt (Muster `tests/skill-vorbereitung-felder.test.ts`):
 *   - jede Prüffunktion (`constraints.<name>`) exportiert `@sigloch/graphcode/constraints`;
 *   - jede Regel steht im Katalog von `@sigloch/contracts/se`;
 *   - jedes Feld liefert `graph_metrics` oder steht als Attribut in der Ontologie;
 *   - jeder Adressat der Tabelle darf nach R-18 eine nicht-funktionale REQ erfüllen — geprüft am Gate-Katalog.
 * Die Prüfer laufen auch gegen eine verfälschte Kopie des Skills (Positivkontrolle): ein erfundener Name ist rot.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALL_RULE_DEFS,
  ChainMetrics,
  ConstraintCarriers,
  DEFAULT_METRIC_POLICY,
  ELEMENT_ATTRIBUTES,
  FunctionCriticality,
  ModuleMetrics,
  RequirementScope,
  evaluateRules,
  type OntologyGraph,
} from '@sigloch/contracts/se';
import * as se from '@sigloch/contracts/se';
import * as constraints from '../src/kernel/measure/constraints.js';
import { GraphMetricsAnswerSchema } from '../src/projections/metrics.js';

const REPO = join(__dirname, '..');
const SKILL = join(REPO, '.claude', 'commands', 'se', 'constraints.md');
const ALT = join(REPO, '.claude', 'commands', 'se', 'target-profile.md');
const skill = (): string => readFileSync(SKILL, 'utf8');

const DIMENSIONEN = ['Änderbarkeit', 'Zusammenhalt', 'kurze Wege', 'Fehlertoleranz', 'Größe', 'Engpass', 'Schutz'];
const ADRESSATEN = new Set(['FCHAIN', 'MOD', 'SYS']);

/** Die Zeilen der Tabelle, deren Kopf die Spalte „Prüffunktion" trägt: je Zeile die Zellen. */
function fragenTabelle(text: string): { kopf: string[]; zeilen: string[][] } {
  const zeilen = text.split('\n');
  const start = zeilen.findIndex((z) => z.startsWith('|') && z.includes('Prüffunktion'));
  expect(start, 'die Tabelle der Fragen steht im Skill').toBeGreaterThan(-1);
  const zellen = (z: string) => z.split('|').slice(1, -1).map((c) => c.trim());
  const kopf = zellen(zeilen[start]!);
  const rumpf: string[][] = [];
  for (let i = start + 2; i < zeilen.length && zeilen[i]!.startsWith('|'); i++) rumpf.push(zellen(zeilen[i]!));
  return { kopf, zeilen: rumpf };
}

/** Prüffunktionen, die der Text nennt und `@sigloch/graphcode/constraints` nicht exportiert. */
function fremdePrueffunktionen(text: string): string[] {
  const exportiert = new Set(Object.keys(constraints));
  return [...text.matchAll(/`constraints\.([A-Za-z]\w*)`/g)].map((m) => m[1]!).filter((n) => !exportiert.has(n));
}

/** Regel-IDs, die der Text nennt und der Katalog nicht kennt. */
function fremdeRegeln(text: string): string[] {
  const katalog = new Set(ALL_RULE_DEFS.map((r) => r.id));
  return [...text.matchAll(/`([A-Z]{1,4}-\d+[a-z]?)`/g)].map((m) => m[1]!).filter((id) => !katalog.has(id));
}

/**
 * Namen (camelCase in Backticks), die weder graph_metrics als Feld liefert, noch die Ontologie als Attribut
 * führt, noch `@sigloch/contracts/se` exportiert (der Skill nennt dort Messungen wie `moduleMetrics`).
 */
function fremdeFelder(text: string): string[] {
  const bekannt = new Set<string>([
    ...Object.keys(GraphMetricsAnswerSchema.shape),
    ...Object.keys(ModuleMetrics.shape),
    ...Object.keys((ChainMetrics.shape.chains.element as unknown as { options: Array<{ shape: object }> }).options?.[0]?.shape ??
      (ChainMetrics.shape.chains.element as unknown as { shape: object }).shape),
    ...Object.keys(FunctionCriticality.shape),
    ...Object.keys(ConstraintCarriers.element.shape),
    ...Object.keys(RequirementScope.shape),
    ...Object.values(ELEMENT_ATTRIBUTES).flatMap((attrs) => (attrs as Array<{ key: string }>).map((a) => a.key)),
    ...Object.keys(se),
    // Eingaben von graph_mutate, die der Skill im Vorbild nennt.
    'dryRun',
    'baseVersion',
  ]);
  return [...text.matchAll(/`([a-z]+[A-Z][A-Za-z0-9]*)`/g)].map((m) => m[1]!).filter((f) => !bekannt.has(f));
}

/** R-18 am Gate-Katalog: darf ein Element dieses Typs eine nicht-funktionale REQ erfüllen? */
function r18Erlaubt(typ: string): boolean {
  const g = {
    elements: [
      { id: 'SYS-s', type: 'SYS', name: 's' },
      { id: `${typ}-x`, type: typ, name: 'x' },
      { id: 'REQ-c', type: 'REQ', name: 'c', kinds: ['non-functional'] },
    ],
    traces: [{ source: `${typ}-x`, target: 'REQ-c', type: 'satisfy' }],
  } as unknown as OntologyGraph;
  return !evaluateRules(g, DEFAULT_METRIC_POLICY).some((v) => v.rule_id === 'R-18' && /satisfy/.test(v.message));
}

describe('CR-GC-852: se:constraints an der Stelle von se:target-profile', () => {
  it('es gibt den Skill se:constraints und nicht mehr se:target-profile', () => {
    expect(existsSync(SKILL)).toBe(true);
    expect(existsSync(ALT)).toBe(false);
    expect(skill()).toMatch(/^name: se:constraints$/m);
  });

  it('keine Gewichte, keine Zielwerte: die Antwort ist eine REQ mit TEST', () => {
    const text = skill();
    expect(text).not.toMatch(/\[-1,\s*1\]/);
    expect(text).not.toMatch(/`weights`|`values`|target-profile\.json/);
    expect(text).toContain('se:author-req');
    expect(text).toMatch(/nicht-funktional/);
  });

  it('je Dimension eine Zeile: Frage, Beispiel, Adressat, Prüfung am Snapshot, Prüffunktion', () => {
    const { kopf, zeilen } = fragenTabelle(skill());
    expect(kopf).toEqual(['Dimension', 'Frage', 'Antwort-Beispiel', 'an', 'Prüfung am Snapshot', 'Prüffunktion']);
    expect(zeilen.map((z) => z[0])).toEqual(DIMENSIONEN);
    const an = kopf.indexOf('an');
    const pf = kopf.indexOf('Prüffunktion');
    for (const z of zeilen) {
      const typen = z[an]!.split(/[,\s]+/).filter(Boolean);
      expect(typen.length, z[0]).toBeGreaterThan(0);
      for (const t of typen) expect(ADRESSATEN.has(t), `${z[0]}: ${t} ist kein Adressat eines Constraints`).toBe(true);
      // Entweder eine exportierte Prüffunktion, oder der Weg über se:author-req, auf dem der Test die Prüfung schreibt.
      expect(/`constraints\.\w+`/.test(z[pf]!) || /fehlt/.test(z[pf]!), `${z[0]}: ${z[pf]}`).toBe(true);
    }
    // Heute gibt es genau eine Prüffunktion; Schutz nennt sie.
    expect(zeilen.find((z) => z[0] === 'Schutz')![pf]).toContain('`constraints.eingaengeNurAus`');
  });

  it('jeder Adressat darf nach R-18 eine nicht-funktionale REQ erfüllen, eine FUNC nicht', () => {
    for (const t of ADRESSATEN) expect(r18Erlaubt(t), t).toBe(true);
    expect(r18Erlaubt('FUNC'), 'Prämisse: R-18 lehnt FUNC ab, sonst prüfte der Test nichts').toBe(false);
    expect(skill()).toMatch(/FUNC[^\n]*keine nicht-funktionale/);
  });

  it('der Skill nennt keine Prüffunktion, Regel oder Feld, die es nicht gibt', () => {
    const text = skill();
    expect(fremdePrueffunktionen(text)).toEqual([]);
    expect(fremdeRegeln(text)).toEqual([]);
    expect(fremdeFelder(text)).toEqual([]);
    expect([...text.matchAll(/`constraints\.\w+`/g)].length, 'Prämisse: der Skill nennt Prüffunktionen').toBeGreaterThan(0);
  });

  it('Positivkontrolle: ein erfundener Name ist rot', () => {
    const falsch = `${skill()}\n\`constraints.gibtEsNicht\` \`R-999\` \`erfundenesFeld\`\n`;
    expect(fremdePrueffunktionen(falsch)).toEqual(['gibtEsNicht']);
    expect(fremdeRegeln(falsch)).toEqual(['R-999']);
    expect(fremdeFelder(falsch)).toEqual(['erfundenesFeld']);
  });

  it('das Kriterium „architektur-bestimmend" und die drei Konfliktpaare stehen da', () => {
    const text = skill();
    expect(text).toMatch(/architektur-bestimmend/);
    expect(text).toMatch(/ohne dass sich\s+Code-Verhalten ändert/);
    for (const [a, b] of [
      ['Zusammenhalt', 'kurze Wege'],
      ['Zusammenhalt', 'Engpass'],
      ['Schutz', 'kurze Wege'],
    ]) {
      expect(text, `${a} ↔ ${b}`).toContain(`**${a} ↔ ${b}**`);
    }
  });

  it('das Paket exportiert die Prüffunktionen unter dem Subpath, aus dem der Skill sie nennt', () => {
    const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as { exports: Record<string, { import: string }> };
    expect(pkg.exports['./constraints']!.import).toBe('./dist/kernel/measure/constraints.js');
    expect(skill()).toContain('@sigloch/graphcode/constraints');
  });
});
