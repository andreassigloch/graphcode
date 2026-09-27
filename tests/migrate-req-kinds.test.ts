/**
 * TEST-migrate-req-kinds (CR-GC-669) — REQ-kinds auf zwei Werte, risk/mitigation als Rolle.
 *
 * Zwei Ebenen: (1) der Vorschlag je REQ auf einem Vorher-Graphen mit jedem Fall der Migration
 * (pre/post an FUNC, pre/post an FCHAIN, risk ohne Erfueller, mitigation an MOD, functional an
 * FCHAIN mit und ohne passendes Glied, gemischt); (2) die Anwendung ueber den Tool-Layer auf
 * einem Temp-Store — nie das .graphcode des Repos —, danach meldet R-18 keinen kinds-Befund mehr.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness } from '../src/surface/create-harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { countGraph, proposeDecisions, buildCommands, applyDecisions } from '../scripts/migrate-req-kinds.mjs';

type Decision = {
  uid: string;
  case: string[];
  kinds: string[];
  role: string | null;
  dropSatisfy: string[];
  addSatisfy: string[];
  decidedBy: string;
  candidates?: { uid: string }[];
};

const ref = (file: string, symbol: string) => ({ file, symbol, lang: 'ts' });

/** Vorher-Graph im SSOT-Format: jeder Fall der Migration einmal. */
function vorher() {
  const elements = [
    { id: 'SYS-x', type: 'SYS', name: 'x', description: '' },
    { id: 'MOD-store', type: 'MOD', name: 'store', description: '' },
    { id: 'FUNC-export-doc', type: 'FUNC', name: 'exportDoc', description: 'Schreibt das Dokument nach docs/views', realRef: ref('src/a.ts', 'exportDoc') },
    { id: 'FUNC-recall', type: 'FUNC', name: 'recallState', description: 'Holt einen frueheren Graph-Zustand zurueck', realRef: ref('src/b.ts', 'recallState') },
    { id: 'FUNC-plain', type: 'FUNC', name: 'plain', description: 'etwas anderes' },
    { id: 'FCHAIN-run', type: 'FCHAIN', name: 'run', description: '' },
    { id: 'REQ-post-func', type: 'REQ', name: 'Nachbedingung', description: '', kinds: ['postcondition'] },
    { id: 'REQ-pre-chain', type: 'REQ', name: 'Vorbedingung', description: '', kinds: ['precondition'] },
    { id: 'REQ-risk', type: 'REQ', name: 'Risiko', description: '', kinds: ['risk'], severity: 5, occurrence: 5, detection: 5 },
    { id: 'REQ-mitig', type: 'REQ', name: 'Gegenmassnahme', description: '', kinds: ['mitigation'] },
    { id: 'REQ-doc-export', type: 'REQ', name: 'Dokument exportieren', description: 'Das Dokument wird exportiert', kinds: ['functional'] },
    { id: 'REQ-no-extraction', type: 'REQ', name: 'Keine Extraktion', description: 'Querschnitt', kinds: ['functional'] },
    { id: 'REQ-mixed', type: 'REQ', name: 'Gemischt', description: '', kinds: ['functional', 'non-functional'] },
    { id: 'REQ-ok', type: 'REQ', name: 'Unberuehrt', description: '', kinds: ['non-functional'] },
    { id: 'TEST-t', type: 'TEST', name: 't', description: '' },
  ];
  const traces = [
    { source: 'SYS-x', target: 'MOD-store', type: 'compose' },
    { source: 'FCHAIN-run', target: 'FUNC-export-doc', type: 'compose' },
    { source: 'FCHAIN-run', target: 'FUNC-recall', type: 'compose' },
    { source: 'FCHAIN-run', target: 'FUNC-plain', type: 'compose' },
    { source: 'FUNC-plain', target: 'REQ-post-func', type: 'satisfy' },
    { source: 'FCHAIN-run', target: 'REQ-pre-chain', type: 'satisfy' },
    { source: 'MOD-store', target: 'REQ-mitig', type: 'satisfy' },
    { source: 'REQ-risk', target: 'REQ-mitig', type: 'compose' },
    { source: 'FCHAIN-run', target: 'REQ-doc-export', type: 'satisfy' },
    { source: 'FCHAIN-run', target: 'REQ-no-extraction', type: 'satisfy' },
    { source: 'MOD-store', target: 'REQ-ok', type: 'satisfy' },
    { source: 'TEST-t', target: 'REQ-risk', type: 'verify' },
  ];
  return { elements, traces };
}

describe('TEST-migrate-req-kinds: Vorschlag je REQ (CR-GC-669)', () => {
  const g = vorher();
  const decisions = proposeDecisions(g) as Decision[];
  const d = (uid: string) => decisions.find((x) => x.uid === uid)!;

  it('zaehlt den Bestand in den Spalten der CR-SM-366-Tabelle', () => {
    expect(countGraph(g)).toEqual({
      req: 8, prePost: 2, risk: 1, mitigation: 1, functionalAndNonFunctional: 1, roleWithCoreKind: 0,
      noCoreKindAfterMove: 4, noKinds: 0, satisfyToPrePost: 2, satisfyToRole: 1, fchainToFunctional: 2,
    });
  });

  it('pre/post an FUNC -> functional, mechanisch', () => {
    expect(d('REQ-post-func')).toMatchObject({ kinds: ['functional'], decidedBy: 'mechanical', dropSatisfy: [] });
  });

  it('pre/post an FCHAIN -> non-functional, zur Entscheidung', () => {
    expect(d('REQ-pre-chain')).toMatchObject({ case: ['prepost-on-fchain'], kinds: ['non-functional'], decidedBy: 'heuristic' });
  });

  it('risk/mitigation -> role; Kern-kind aus dem Erfueller, ohne Erfueller keins', () => {
    expect(d('REQ-risk')).toMatchObject({ role: 'risk', kinds: [] });
    expect(d('REQ-mitig')).toMatchObject({ role: 'mitigation', kinds: ['non-functional'] });
  });

  it('functional an FCHAIN: an das passende Glied mit realRef haengen, sonst non-functional', () => {
    expect(d('REQ-doc-export')).toMatchObject({ kinds: ['functional'], dropSatisfy: ['FCHAIN-run'], addSatisfy: ['FUNC-export-doc'] });
    expect(d('REQ-doc-export').candidates?.map((c) => c.uid)).not.toContain('FUNC-plain'); // ohne realRef kein Kandidat
    expect(d('REQ-no-extraction')).toMatchObject({ kinds: ['non-functional'], dropSatisfy: [], addSatisfy: [] });
  });

  it('gemischt functional+non-functional bleibt offen, unberuehrte REQ taucht nicht auf', () => {
    expect(d('REQ-mixed').decidedBy).toBe('open');
    expect(decisions.map((x) => x.uid)).not.toContain('REQ-ok');
  });
});

describe('TEST-migrate-req-kinds: Anwendung ueber den Tool-Layer (CR-GC-669)', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let registry: ReturnType<typeof bindToolsToHarness>;
  const kindsBefunde = async () =>
    ((await registry['rules_evaluate'].handler({ detail: 'full' })) as { violations: { ruleId: string; message: string }[] })
      .violations.filter((v) => v.ruleId === 'R-18' && /admits only kinds/.test(v.message));

  beforeAll(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'gc-669-'));
    mkdirSync(join(repoRoot, 'docs', 'graph'), { recursive: true });
    const g = vorher();
    // der gemischte Fall ist eine Entscheidung des Menschen, nicht dieses Laufs
    g.elements = g.elements.filter((e) => e.id !== 'REQ-mixed');
    writeFileSync(join(repoRoot, 'docs', 'graph', 'vorher.json'), JSON.stringify(g));
    harness = await createHarness({ repoRoot, scope: { workspaceId: 'gc669', systemId: 'gc669' } });
    await harness.initialize();
    await harness.seedFromJson(join('docs', 'graph', 'vorher.json'));
    registry = bindToolsToHarness(harness);
  });

  afterAll(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('verweigert unbestaetigte Heuristik und veraltete Entscheidungen, ohne etwas anzuwenden', () => {
    const decisions = proposeDecisions(vorher()).filter((x: Decision) => x.uid !== 'REQ-mixed');
    expect(() => buildCommands(decisions, harness.getGraph())).toThrow(/heuristischer Vorschlag nicht bestaetigt/);
    const stale = decisions.map((x: Decision & { before: { kinds: string[] } }) => ({ ...x, before: { kinds: ['functional'] } }));
    expect(() => buildCommands(stale, harness.getGraph(), { acceptHeuristic: true })).toThrow(/veraltet/);
  });

  it('ein Batch durchs Gate: danach 0 kinds-Befunde, Rolle gesetzt, umgehaengt', async () => {
    expect((await kindsBefunde()).length).toBe(5); // pre-chain, post-func, mitig, doc-export, no-extraction
    const decisions = proposeDecisions(vorher()).filter((x: Decision) => x.uid !== 'REQ-mixed');
    const res = await applyDecisions(registry, harness, decisions, { acceptHeuristic: true });
    expect(res.result.success).toBe(true);
    expect(await kindsBefunde()).toEqual([]);

    const graph = harness.getGraph();
    const node = (uid: string) => graph.nodes.find((n) => n.uid === uid)!;
    expect(node('REQ-risk').attributes).toMatchObject({ role: 'risk', kinds: [] });
    expect(node('REQ-mitig').attributes).toMatchObject({ role: 'mitigation', kinds: ['non-functional'] });
    const satisfy = graph.edges.filter((e) => e.edgeType === 'satisfy' && e.targetId === 'REQ-doc-export').map((e) => e.sourceId);
    expect(satisfy).toEqual(['FUNC-export-doc']);
    // kein Altwert mehr irgendwo
    const alt = graph.nodes.filter((n) => n.type === 'REQ' && JSON.stringify(n.attributes.kinds ?? []).match(/condition|risk|mitigation/));
    expect(alt).toEqual([]);
  });
});
