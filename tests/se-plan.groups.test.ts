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
    const { groups, cyclic } = crGroups(plan(), ['CR-1', 'CR-2', 'CR-3', 'CR-4', 'CR-5']);
    expect(groups).toEqual([['CR-1', 'CR-2', 'CR-5'], ['CR-3', 'CR-4']]);
    expect(cyclic).toEqual([]);
  });

  it('kein Paar einer Gruppe teilt Kante oder Datei; jede Voraussetzung steht frueher', () => {
    const g = plan();
    const { groups } = crGroups(g, ['CR-1', 'CR-2', 'CR-3', 'CR-4', 'CR-5']);
    const index = new Map(groups.flatMap((grp, i) => grp.map((c) => [c, i] as const)));
    for (const d of g.edges.filter((x) => x.attributes.label === 'depends-on')) {
      expect(index.get(d.targetId)!).toBeLessThan(index.get(d.sourceId)!);
    }
    expect(index.get('CR-1')).not.toBe(index.get('CR-3'));
  });

  it('ein Zyklus wird gemeldet, nicht eingeordnet', () => {
    const g = plan();
    g.edges.push(e('CR-2', 'CR-4', 'relation', 'depends-on'));
    const { groups, cyclic } = crGroups(g, ['CR-1', 'CR-2', 'CR-3', 'CR-4', 'CR-5']);
    expect(cyclic).toEqual(['CR-2', 'CR-4']);
    expect(groups.flat()).not.toContain('CR-2');
  });

  it('implplan zeigt die Gruppe je CR', () => {
    const text = renderImplPlan(plan() as Graph, 'x');
    expect(text).toContain('| CR | status | Gruppe | name |');
    expect(text).toContain('| `CR-3` | open | 2 |');
    expect(text).toContain('| `CR-5` | open | 1 |');
  });

  it('se-plan.md traegt Gruppen in der Ausgabe und die Anweisung zur Ausfuehrung', () => {
    const skill = readFileSync(join(__dirname, '..', '.claude', 'commands', 'se-plan.md'), 'utf8');
    expect(skill).toMatch(/\*\*the groups per milestone\*\* \(`crGroups`/);
    const run = skill.slice(skill.indexOf('## 10.'));
    expect(run).toMatch(/\*\*The main session only coordinates\.\*\*/);
    expect(run).toMatch(/one agent per CR, each in its own worktree/);
    expect(run).toMatch(/writes the graph alone/);
    expect(run).toMatch(/\*\*Agents never write the graph and never roll out\.\*\*/);
  });
});
