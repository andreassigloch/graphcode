/**
 * CR-GC-790 — das Urteil eines Trockenlaufs traegt die Kennzahlen danach.
 *
 * Ein Trockenlauf schreibt nichts, `graph_metrics` misst danach also den alten Stand. Die Zeilen,
 * die der Zug aendert, stehen deshalb im Urteil selbst: `metricsAfter`, gerechnet in `zugBericht`
 * aus dem Stand davor und danach, den das Gate herausgibt.
 *
 * Die Gegenprobe ist das Werkzeug, dessen Zeilen der Bericht verspricht: derselbe Zug wird nach dem
 * Trockenlauf echt angewandt, und `graph_metrics` am geschriebenen Modell muss an jeder genannten
 * Kennung dieselbe Zeile tragen und an jeder nicht genannten die Zeile von davor.
 *
 * Messaufbau auf Platte (`openMeasured`), echte Werkzeuge, kein Mock.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openMeasured, type Measured } from '../src/surface/measured.js';
import { MetricsAfter } from '../src/kernel/measure/zug-bericht.js';

type Zeile = Record<string, unknown>;
type Antwort = Record<string, unknown>;

const el = (id: string, type: string, attributes?: Record<string, unknown>) => ({
  id, type, name: id, description: `${id} Beschreibung`, ...(attributes ? { attributes } : {}),
});

/** Zwei Ketten durch eine geteilte Funktion (b), zwei Module, ein Risiko mit einer Gegenmassnahme an b. */
const MODELL = {
  elements: [
    el('SYS-x', 'SYS'), el('UC-x', 'UC'), el('ACTOR-a', 'ACTOR'),
    el('FCHAIN-x', 'FCHAIN'), el('FCHAIN-y', 'FCHAIN'),
    el('FUNC-a', 'FUNC'), el('FUNC-b', 'FUNC'), el('FUNC-c', 'FUNC'),
    el('FLOW-in', 'FLOW'), el('FLOW-ab', 'FLOW'), el('FLOW-out', 'FLOW'), el('FLOW-bc', 'FLOW'), el('FLOW-cout', 'FLOW'),
    el('SCHEMA-s', 'SCHEMA'), el('MOD-m', 'MOD'), el('MOD-n', 'MOD'),
    el('REQ-zweck', 'REQ', { kinds: ['non-functional'] }),
    el('REQ-risk', 'REQ', { role: 'risk', kinds: ['non-functional'] }),
    el('REQ-mit', 'REQ', { role: 'mitigation', kinds: ['functional'] }),
  ],
  traces: [
    ['SYS-x', 'compose', 'UC-x'], ['SYS-x', 'compose', 'MOD-m'], ['SYS-x', 'compose', 'MOD-n'],
    ['UC-x', 'compose', 'FCHAIN-x'], ['UC-x', 'compose', 'FCHAIN-y'],
    ['FCHAIN-x', 'compose', 'FUNC-a'], ['FCHAIN-x', 'compose', 'FUNC-b'],
    ['FCHAIN-y', 'compose', 'FUNC-b'], ['FCHAIN-y', 'compose', 'FUNC-c'],
    ['ACTOR-a', 'io', 'FLOW-in'], ['FLOW-in', 'io', 'FUNC-a'], ['FUNC-a', 'io', 'FLOW-ab'], ['FLOW-ab', 'io', 'FUNC-b'],
    ['FUNC-b', 'io', 'FLOW-out'], ['FLOW-out', 'io', 'ACTOR-a'], ['FUNC-b', 'io', 'FLOW-bc'], ['FLOW-bc', 'io', 'FUNC-c'],
    ['FUNC-c', 'io', 'FLOW-cout'], ['FLOW-cout', 'io', 'ACTOR-a'],
    ...['in', 'ab', 'out', 'bc', 'cout'].map((f) => [`FLOW-${f}`, 'relation', 'SCHEMA-s']),
    ['FUNC-a', 'allocate', 'MOD-m'], ['FUNC-b', 'allocate', 'MOD-m'], ['FUNC-c', 'allocate', 'MOD-n'],
    ['FCHAIN-x', 'satisfy', 'REQ-zweck'],
    ['REQ-risk', 'compose', 'REQ-mit'], ['FUNC-b', 'satisfy', 'REQ-mit'], ['FCHAIN-x', 'satisfy', 'REQ-risk'],
  ].map(([source, type, target]) => ({ source, type, target })),
};

/** Die Funktion b wandert von Modul m nach n: die Grenze in Kette x entsteht, die in y faellt. */
const ZUG_ALLOKATION = ['## Edges', '- FUNC-b -allocate-> MOD-m', '+ FUNC-b -allocate-> MOD-n'].join('\n');
/** Die Funktion c erfuellt die Gegenmassnahme mit: ein Traeger mehr am Risiko. */
const ZUG_TRAEGER = ['## Edges', '+ FUNC-c -satisfy-> REQ-mit'].join('\n');
/** Der Fluss von b nach c wird getrennt: die Kette y zerfaellt. */
const ZUG_TRENNEN = ['## Edges', '- FLOW-bc -io-> FUNC-c'].join('\n');
/** Eine Anforderung bekommt einen neuen Text: keine Kennzahl liest ihn. */
const ZUG_OHNE_WIRKUNG = ['## Nodes', '### REQ', '~ REQ-zweck|Der Zweck, neu gefasst'].join('\n');
/** Eine Kante, die die Grammatik nicht kennt: das Gate lehnt ab. */
const ZUG_ILLEGAL = ['## Edges', '+ REQ-zweck -allocate-> MOD-m'].join('\n');

/** Die fuenf Listen des Berichts, je mit ihrem Schluessel und dem Weg zur selben Liste in `graph_metrics`. */
const LISTEN: { name: string; kennung: string; bericht: (m: MetricsAfter) => Zeile[]; entfallen: (m: MetricsAfter) => string[]; werkzeug: (a: Antwort) => Zeile[] }[] = [
  { name: 'chains', kennung: 'chainId', bericht: (m) => m.chains, entfallen: (m) => m.removed.chains, werkzeug: (a) => a.chains as Zeile[] },
  { name: 'modules', kennung: 'moduleId', bericht: (m) => m.modules, entfallen: (m) => m.removed.modules, werkzeug: (a) => a.modules as Zeile[] },
  { name: 'functions', kennung: 'funcId', bericht: (m) => m.functions, entfallen: (m) => m.removed.functions, werkzeug: (a) => a.functions as Zeile[] },
  { name: 'risks', kennung: 'riskId', bericht: (m) => m.riskCarriers.risks, entfallen: (m) => m.removed.risks, werkzeug: (a) => (a.riskCarriers as { risks: Zeile[] }).risks },
  { name: 'surface', kennung: 'funcId', bericht: (m) => m.riskCarriers.surface, entfallen: (m) => m.removed.surface, werkzeug: (a) => (a.riskCarriers as { surface: Zeile[] }).surface },
];

const LEER: MetricsAfter = {
  chains: [], modules: [], functions: [], riskCarriers: { risks: [], surface: [] },
  removed: { chains: [], modules: [], functions: [], risks: [], surface: [] },
};

let dir: string;
let m: Measured;
const ruf = (name: string, input: unknown) => (m.tools[name].handler as (i: unknown) => Promise<Antwort>)(input);

/** Ein Zug, dreifach gemessen: `graph_metrics` davor, der Trockenlauf, das echte Anwenden, `graph_metrics` danach. */
async function probenUndAnwenden(zug: string): Promise<{ davor: Antwort; probe: Antwort; zwischen: Antwort; angewandt: Antwort; danach: Antwort }> {
  const davor = await ruf('graph_metrics', {});
  const probe = await ruf('graph_mutate', { formatE: zug, dryRun: true });
  const zwischen = await ruf('graph_metrics', {});
  const angewandt = await ruf('graph_mutate', { formatE: zug });
  const danach = await ruf('graph_metrics', {});
  return { davor, probe, zwischen, angewandt, danach };
}

/**
 * Die Gegenprobe gegen `graph_metrics`: jede Zeile des Berichts ist die Zeile des Werkzeugs nach dem
 * Anwenden; jede Zeile des Werkzeugs, die der Bericht nicht nennt, ist die von davor; was entfallen
 * ist, gibt es danach nicht mehr. Zusammen heisst das: der Bericht ist vollstaendig und nennt nichts
 * Unveraendertes.
 */
function gegenpruefen(bericht: MetricsAfter, davor: Antwort, danach: Antwort): void {
  for (const liste of LISTEN) {
    const alt = new Map(liste.werkzeug(davor).map((z) => [z[liste.kennung], z]));
    const neu = new Map(liste.werkzeug(danach).map((z) => [z[liste.kennung], z]));
    const genannt = new Set<unknown>();
    for (const zeile of liste.bericht(bericht)) {
      const id = zeile[liste.kennung];
      genannt.add(id);
      expect(zeile, `${liste.name} ${String(id)}: die Zeile von graph_metrics danach`).toEqual(neu.get(id));
      expect(zeile, `${liste.name} ${String(id)}: genannt, also geaendert`).not.toEqual(alt.get(id));
    }
    for (const [id, zeile] of neu) {
      if (!genannt.has(id)) expect(zeile, `${liste.name} ${String(id)}: nicht genannt, also wie davor`).toEqual(alt.get(id));
    }
    expect(liste.entfallen(bericht).sort(), `${liste.name}: entfallen`).toEqual([...alt.keys()].filter((id) => !neu.has(id)).sort());
  }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'zug-kennzahlen-'));
  const pfad = join(dir, 'probemodell.json');
  writeFileSync(pfad, JSON.stringify(MODELL));
  m = await openMeasured({ graph: pfad, systemId: 'x' });
}, 60_000);

afterAll(async () => {
  await m?.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('CR-GC-790: das Urteil eines Trockenlaufs traegt die geaenderten Zeilen der Kennzahlen danach', () => {
  it('eine Zuordnung wandert: der Trockenlauf nennt die Zeilen der Ketten und Module, wie graph_metrics sie nach dem Anwenden misst', async () => {
    const { davor, probe, zwischen, angewandt, danach } = await probenUndAnwenden(ZUG_ALLOKATION);
    expect(probe.success).toBe(true);
    const bericht = MetricsAfter.parse(probe.metricsAfter);
    expect(bericht).toEqual(probe.metricsAfter);

    // Der Trockenlauf hat nichts geschrieben: das Werkzeug misst dazwischen den alten Stand.
    expect(zwischen.graphVersion).toBe(davor.graphVersion);
    expect(zwischen.chains).toEqual(davor.chains);
    expect(zwischen.modules).toEqual(davor.modules);

    // Was der Zug bewegt: in x entsteht eine Modulgrenze, in y faellt sie; beide Module aendern sich.
    const kette = (id: string) => bericht.chains.find((c) => c.chainId === id) as Zeile;
    const ketteDavor = (id: string) => (davor.chains as Zeile[]).find((c) => c.chainId === id)!;
    expect(ketteDavor('FCHAIN-x').moduleBoundaries).toBe(0);
    expect(kette('FCHAIN-x').moduleBoundaries).toBe(1);
    expect(ketteDavor('FCHAIN-y').moduleBoundaries).toBe(1);
    expect(kette('FCHAIN-y').moduleBoundaries).toBe(0);
    expect(bericht.modules.map((z) => z.moduleId).sort()).toEqual(['MOD-m', 'MOD-n']);
    expect(bericht.modules.find((z) => z.moduleId === 'MOD-n')!.allocatedFuncs).toBe(2);
    // Was der Zug nicht bewegt, steht nicht da: keine Funktion wechselt die Kette, kein Traeger das Risiko.
    expect(bericht.functions).toEqual([]);
    expect(bericht.riskCarriers).toEqual({ risks: [], surface: [] });
    expect(bericht.removed).toEqual(LEER.removed);

    gegenpruefen(bericht, davor, danach);
    // Nach dem Schreiben misst graph_metrics den Stand danach; die Schreibantwort traegt die Zeilen nicht doppelt.
    expect(angewandt.success).toBe(true);
    expect(angewandt).not.toHaveProperty('metricsAfter');
  });

  it('ein Traeger kommt dazu: die Zeile des Risikos und die Flaeche stehen im Bericht', async () => {
    const { davor, probe, angewandt, danach } = await probenUndAnwenden(ZUG_TRAEGER);
    expect(probe.success).toBe(true);
    const bericht = MetricsAfter.parse(probe.metricsAfter);
    const risiko = bericht.riskCarriers.risks.find((r) => r.riskId === 'REQ-risk')!;
    expect(risiko.carriers.sort()).toEqual(['FUNC-b', 'FUNC-c']);
    expect(bericht.riskCarriers.surface.map((s) => s.funcId)).toEqual(['FUNC-c']);
    expect(bericht.chains).toEqual([]);
    expect(bericht.modules).toEqual([]);
    gegenpruefen(bericht, davor, danach);
    expect(angewandt.success).toBe(true);
  });

  it('ein Fluss wird getrennt: die Kette steht als nicht bewertbar im Bericht, mit ihren Gruenden', async () => {
    const { davor, probe, angewandt, danach } = await probenUndAnwenden(ZUG_TRENNEN);
    expect(probe.success).toBe(true);
    const bericht = MetricsAfter.parse(probe.metricsAfter);
    const y = bericht.chains.find((c) => c.chainId === 'FCHAIN-y')!;
    expect((davor.chains as Zeile[]).find((c) => c.chainId === 'FCHAIN-y')!.measurable).toBe(true);
    expect(y.measurable).toBe(false);
    expect((y as { reasons: string[] }).reasons.length).toBeGreaterThan(0);
    gegenpruefen(bericht, davor, danach);
    expect(angewandt.success).toBe(true);
  });

  it('ein Zug ohne Wirkung auf eine Kennzahl: der Bericht steht da, mit leeren Listen', async () => {
    const { davor, probe, angewandt, danach } = await probenUndAnwenden(ZUG_OHNE_WIRKUNG);
    expect(probe.success).toBe(true);
    expect(probe, 'nichts geaendert ist eine Aussage, kein fehlendes Feld').toHaveProperty('metricsAfter');
    expect(probe.metricsAfter).toEqual(LEER);
    expect(angewandt.success).toBe(true);
    gegenpruefen(LEER, davor, danach);
  });

  it('ein abgelehnter Zug hat kein Paar und traegt keinen Bericht', async () => {
    const probe = await ruf('graph_mutate', { formatE: ZUG_ILLEGAL, dryRun: true });
    expect(probe.success).toBe(false);
    expect(probe).not.toHaveProperty('metricsAfter');
    expect(probe).not.toHaveProperty('berichtFehlt');
  });

  it('eine Kette entfaellt: ihre Kennung steht unter removed', async () => {
    const zug = ['## Nodes', '### FCHAIN', '- FCHAIN-y'].join('\n');
    const { davor, probe, danach } = await probenUndAnwenden(zug);
    expect(probe.success).toBe(true);
    const bericht = MetricsAfter.parse(probe.metricsAfter);
    expect(bericht.removed.chains).toEqual(['FCHAIN-y']);
    expect(bericht.chains.map((c) => c.chainId)).not.toContain('FCHAIN-y');
    gegenpruefen(bericht, davor, danach);
  });
});
