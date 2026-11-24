/**
 * TEST-se-plan-groups (CR-GC-896) — welche offenen CRs eines Meilensteins gleichzeitig laufen.
 *
 * Die Gruppe ist korrekt, wenn kein Paar in ihr eine depends-on-Kante oder eine Datei teilt, und
 * wenn jede Voraussetzung in einer frueheren Gruppe steht. Dazu: die implplan-Ansicht zeigt die
 * Gruppe, und se-plan.md traegt die Anweisung zur Ausfuehrung.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Graph } from '@sigloch/graph-api-core';
import { crGroups } from '../src/loop/se-plan.js';
import { renderImplPlan } from '../src/projections/graphcode.js';

const n = (uid: string, type: string, attributes: Record<string, unknown> = {}) => ({
  uid, type, name: uid, description: '', attributes,
});
const e = (sourceId: string, targetId: string, edgeType: string, label?: string) => ({
  sourceId, targetId, edgeType, attributes: label ? { label } : {},
});
const fn = (uid: string, file: string) => n(uid, 'FUNC', { realRef: { file } });

/**
 * CR-1, CR-2, CR-3 unabhaengig, aber CR-3 teilt mit CR-1 die Datei a.ts (ueber die REQ, deren
 * Traeger FUNC-a3 ist). CR-4 haengt von CR-2 ab. CR-5 hat keine bekannte Datei.
 */
function plan(): Pick<Graph, 'nodes' | 'edges'> {
  return {
    nodes: [
      n('MS-1', 'MS'),
      ...['CR-1', 'CR-2', 'CR-3', 'CR-4', 'CR-5'].map((c) => n(c, 'CR', { status: 'open' })),
      fn('FUNC-a', 'src/a.ts'), fn('FUNC-a3', 'src/a.ts'), fn('FUNC-b', 'src/b.ts'), fn('FUNC-d', 'src/d.ts'),
      n('REQ-3', 'REQ'),
    ],
    edges: [
      ...['CR-1', 'CR-2', 'CR-3', 'CR-4', 'CR-5'].map((c) => e(c, 'MS-1', 'relation')),
      e('CR-1', 'FUNC-a', 'relation'),
      e('CR-2', 'FUNC-b', 'relation'),
      e('CR-3', 'REQ-3', 'relation'),
      e('FUNC-a3', 'REQ-3', 'satisfy'),
      e('CR-4', 'FUNC-d', 'relation'),
      e('CR-4', 'CR-2', 'relation', 'depends-on'),
    ],
  };
}

describe('TEST-se-plan-groups (CR-GC-896)', () => {
  it('trennt gemeinsame Datei und Abhaengigkeit, buendelt den Rest', () => {
    const { groups, cyclic } = crGroups({ graph: plan(), crIds: ['CR-1', 'CR-2', 'CR-3', 'CR-4', 'CR-5'] });
    expect(groups).toEqual([['CR-1', 'CR-2', 'CR-5'], ['CR-3', 'CR-4']]);
    expect(cyclic).toEqual([]);
  });

  it('kein Paar einer Gruppe teilt Kante oder Datei; jede Voraussetzung steht frueher', () => {
    const g = plan();
    const { groups } = crGroups({ graph: g, crIds: ['CR-1', 'CR-2', 'CR-3', 'CR-4', 'CR-5'] });
    const index = new Map(groups.flatMap((grp, i) => grp.map((c) => [c, i] as const)));
    for (const d of g.edges.filter((x) => x.attributes.label === 'depends-on')) {
      expect(index.get(d.targetId)!).toBeLessThan(index.get(d.sourceId)!);
    }
    expect(index.get('CR-1')).not.toBe(index.get('CR-3'));
  });

  it('ein Zyklus wird gemeldet, nicht eingeordnet', () => {
    const g = plan();
    g.edges.push(e('CR-2', 'CR-4', 'relation', 'depends-on'));
    const { groups, cyclic } = crGroups({ graph: g, crIds: ['CR-1', 'CR-2', 'CR-3', 'CR-4', 'CR-5'] });
    expect(cyclic).toEqual(['CR-2', 'CR-4']);
    expect(groups.flat()).not.toContain('CR-2');
  });

  it('implplan zeigt die Gruppe je CR', () => {
    const text = renderImplPlan(plan() as Graph, 'x');
    expect(text).toContain('| CR | status | Gruppe | name |');
    expect(text).toContain('| `CR-3` | open | 2 |');
    expect(text).toContain('| `CR-5` | open | 1 |');
  });

  it('se-plan.md traegt Gruppen in der Ausgabe', () => {
    const skill = readFileSync(join(__dirname, '..', '.claude', 'commands', 'se-plan.md'), 'utf8');
    expect(skill).toMatch(/\*\*the groups per milestone\*\* \(`crGroups`/);
  });
});

describe('TEST-se-plan-groups (CR-GC-923): se-plan macht nur Reihenfolge und Schnitt', () => {
  const dir = join(__dirname, '..', '.claude', 'commands');
  const skill = readFileSync(join(dir, 'se-plan.md'), 'utf8');
  const conops = readFileSync(join(dir, 'se-conops.md'), 'utf8');

  it('stellt keine Frage und schreibt weder REQ noch TEST', () => {
    expect(skill).not.toMatch(/AskUserQuestion/);
    expect(skill).not.toMatch(/write it/i);
    expect(skill).not.toMatch(/write the missing REQ/i);
    expect(skill).not.toMatch(/write each answer as REQ/i);
  });

  it('Vorbedingung: ungebundenes SCHEMA (R-26, RC-08) an einer Blattfunktion stoppt vor dem Schnitt, Verweis se-cdr', () => {
    const pre = skill.slice(skill.indexOf('## 0.'), skill.indexOf('## 1.'));
    expect(pre).toMatch(/se-cdr/);
    expect(pre).toMatch(/R-26/);
    expect(pre).toMatch(/RC-08/);
    expect(pre).toMatch(/stop/i);
  });

  it('fehlender Test in testconcept stoppt und verweist auf se:author-req', () => {
    const tc = skill.slice(skill.indexOf('## 3.'), skill.indexOf('## 4.'));
    expect(tc).toMatch(/testconcept/);
    expect(tc).toMatch(/stop/i);
    expect(tc).toMatch(/se:author-req/);
    expect(tc).not.toMatch(/\|\s*write it\s*\|/);
  });

  it('keine Baustufe Contracts; der Plan beginnt bei den Blattfunktionen', () => {
    expect(skill).not.toMatch(/\*\*Contracts\*\*/);
    expect(skill).toMatch(/1\. \*\*Leaf functions\*\*/);
  });

  it('Luecke der Spezifikation: Stopp, zurueck zu se-cdr', () => {
    const gap = skill.slice(skill.indexOf('## 7.'), skill.indexOf('## 8.'));
    expect(gap).toMatch(/spec gap/);
    expect(gap).toMatch(/stop/i);
    expect(gap).toMatch(/se-cdr/);
  });

  it('Agenten starten, zusammenfuehren, ausrollen steht nur noch in se-bau', () => {
    expect(skill).not.toMatch(/one agent per CR, each in its own worktree/);
    expect(skill).not.toMatch(/The main session only coordinates/);
    expect(skill).toMatch(/se-bau/);
  });

  it('se-conops fragt Altbestand, Zielumgebung und Ort der geteilten Vertraege und schreibt ueber se:author-req', () => {
    const q = conops.slice(conops.indexOf('Legacy system'));
    expect(conops).toMatch(/AskUserQuestion/);
    expect(q).toMatch(/Legacy system/);
    expect(q).toMatch(/Target environment/);
    expect(q).toMatch(/Shared contracts/);
    expect(q).toMatch(/se:author-req/);
  });
});
