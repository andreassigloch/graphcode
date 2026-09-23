/**
 * CR-GC-621 — der EINE Verbraucher, der die Prosa der Liste wirklich braucht.
 *
 * `graph_elements` antwortet seit diesem CR mit Identität statt Wortlaut. Der Executor-Preflight
 * baut aus derselben Liste den ND-Ähnlichkeitsindex, und `nameDescrSimilarity` wiegt Name und
 * Beschreibung je zur Hälfte: ohne Beschreibung muss der Name die Schwelle 0,55 allein tragen —
 * und zwei Formulierungen derselben Anforderung tun das typischerweise nicht.
 *
 * Das ist die Sorte Regression, die NICHTS rot macht: der Aufruf geht durch, der Batch geht durch,
 * es fehlt nur der Hinweis. Deshalb prüft dieser Test den Fund, nicht den Aufruf.
 *
 * Die Trennschärfe ist gemessen, nicht geraten: die beiden REQ teilen 3 von 4 Namens-Tokens
 * (Beitrag 0,375 — allein UNTER der Schwelle) und tragen denselben Beschreibungstext (Beitrag
 * 0,50). Mit Prosa 0,875 ≥ 0,55, ohne Prosa 0,375. Die Gegenprobe steht als eigener Fall unten.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { bindGateClient } from '../src/loop/executor-gate.js';
import { duplicateHits } from '../src/kernel/measure/nd-similarity.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

/** Der Wortlaut, der die Ähnlichkeit trägt — identisch am vorhandenen und am neuen REQ. */
const WORTLAUT =
  'Ein verpasster Nachtlauf wird beim naechsten Start genau einmal nachgeholt, nie zweimal.';

const fixture = {
  elements: [
    { id: 'SYS-1', type: 'SYS', name: 'Scheduler', description: 'Nachtlaeufe' },
    { id: 'REQ-nachholen', type: 'REQ', name: 'Verpasste Termine nachholen', description: WORTLAUT },
  ],
  traces: [],
};

let tmp: string;
let harness: GraphCodeHarness;
let gate: ReturnType<typeof bindGateClient>;

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'gc-621-'));
  mkdirSync(join(tmp, 'docs', 'graph'), { recursive: true });
  writeFileSync(join(tmp, 'docs', 'graph', 'scheduler.graph.json'), JSON.stringify(fixture));
  const cfg: HarnessConfig = {
    repoRoot: tmp,
    scope: { workspaceId: 'gc-621', systemId: 'scheduler' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
  harness = new GraphCodeHarness(cfg, new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') }), undefined, {
    lockDir: tmp,
  });
  await harness.initialize();
  await harness.seedFromJson();
  const registry = bindToolsToHarness(harness);
  gate = bindGateClient(registry, { preflightFixed: 0, preflightBlocked: 0 }, () => {});
}, 120_000);

afterAll(async () => {
  await harness.close();
  rmSync(tmp, { recursive: true, force: true });
});

/** Der Batch, der dem vorhandenen REQ gleicht — abgewandelter Name, gleicher Wortlaut. */
const batch = {
  commands: [
    {
      op: 'add-node',
      node: { uid: 'REQ-einmal-nachholen', type: 'REQ', name: 'Verpasste Termine einmal nachholen', description: WORTLAUT },
    },
  ],
  consumerId: 'test-621',
};

describe('CR-GC-621: der ND-Index des Executors traegt weiter Beschreibungen', () => {
  it('der Preflight findet das Beinahe-Duplikat ueber den WORTLAUT, nicht ueber den Namen', async () => {
    const res = await gate.runPreflight(batch);
    expect(
      res.duplicates.map((d) => d.matchedUid),
      'ohne Beschreibung im Index bleibt diese Liste leer — der Batch liefe trotzdem durch',
    ).toContain('REQ-nachholen');
    expect(res.duplicates[0].score).toBeGreaterThanOrEqual(0.55);
    expect(res.hints.join(' ')).toContain('REQ-nachholen');
  }, 60_000);

  it('Gegenprobe: derselbe Index OHNE Beschreibungen findet ihn nicht mehr', () => {
    const ohneProsa = [{ uid: 'REQ-nachholen', type: 'REQ', name: 'Verpasste Termine nachholen', description: '…' }];
    expect(duplicateHits(batch, ohneProsa)).toHaveLength(0);
  });
});
