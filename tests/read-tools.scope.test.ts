/**
 * CR-GC-613 — die Lesewerkzeuge antworten ueber die SCHEIBE, nicht ueber das ganze Modell.
 *
 * Gemessen am Lauf `gefuehrt-1` des Code-Tests (2026-09-22): `rules_get_violations` 32.630
 * Zeichen, `graph_test_report` 25.602, drei `graph_context {depth:2}` zu je ~9.300 — zusammen
 * ~90.000 der 144.000 Zeichen, die graphcode in dem Lauf lieferte (62 %). Jede Antwort war
 * sachlich richtig und beantwortete eine WEITERE Frage als die gestellte.
 *
 * Gefahren wird hier gegen dasselbe Modell wie der Lauf: das sigllm-Golden v98 (255 Knoten,
 * 506 Kanten), aus dem der Code-Test die Scheduler-Scheibe schneidet. Echter Kuzu-Store auf
 * Platte, echtes Gate, keine Attrappe — sonst misst der Test seine eigene Fixture.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

const GOLDEN = join(__dirname, '..', 'rig', 'sigllm-spezifikation', 'golden', 'sigllm-v98.graph.json');

/** Die Scheibe, an der der Code-Test arbeitet: das Scheduler-Modul und was daran haengt. */
const SCHEIBE = 'MOD-scheduler';
/**
 * Der Anker, an dem der gemessene Lauf `graph_context {depth:2}` rief.
 *
 * BEWUSST einer der GROSSEN: am Golden liest er ungekuerzt 9.036 Zeichen und trifft damit die
 * ~9.300 des Befunds. Ein erster Anlauf nahm `FUNC-scheduler-operation` (2.693 ungekuerzt) und
 * war damit sofort unter jeder Grenze — ein Messtest, der sich seinen Fall aussucht, misst seine
 * Fixture.
 */
const ANKER = 'FUNC-execute-agent-run-persist-state';

let tmp: string;
let harness: GraphCodeHarness;
let tools: ReturnType<typeof bindToolsToHarness>;

const groesse = (x: unknown) => JSON.stringify(x).length;

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'gc-613-'));
  mkdirSync(join(tmp, 'docs', 'graph'), { recursive: true });
  copyFileSync(GOLDEN, join(tmp, 'docs', 'graph', 'sigllm.graph.json'));
  const cfg: HarnessConfig = {
    repoRoot: tmp,
    scope: { workspaceId: 'gc-613', systemId: 'sigllm' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
  harness = new GraphCodeHarness(cfg, new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') }), undefined, { lockDir: tmp });
  await harness.initialize();
  await harness.seedFromJson();
  tools = bindToolsToHarness(harness);
}, 120_000);

afterAll(async () => {
  await harness.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe('CR-GC-613: ohne Schreibzug antwortet alles wie bisher', () => {
  it('der erste Aufruf einer Sitzung liefert das GANZE Modell — unveraendertes Verhalten', async () => {
    const v = await tools.rules_get_violations.handler({ severity: 'warning' });
    expect(v.umfang.art).toBe('ganzes-modell');
    expect(v.umfang.ausserhalb).toBe(0);
    const t = await tools.graph_test_report.handler({});
    expect(t.umfang.art).toBe('ganzes-modell');
    // Das Modell traegt echte Befunde — sonst waere die Gegenprobe unten wertlos.
    expect(v.total).toBeGreaterThan(20);
    expect(t.summary.requirements).toBeGreaterThan(50);
  }, 120_000);
});

describe('CR-GC-613: nach einem Schreibzug schneiden die Werkzeuge', () => {
  /** Die drei Antwortgroessen des gemessenen Laufs, hier am selben Modell nachgefahren. */
  const gemessen: Record<string, number> = {};

  it('ein Schreibzug am Scheduler-Modul setzt die Arbeitsmenge', async () => {
    const zug: MutateCommand[] = [
      { op: 'update-node', node: { uid: SCHEIBE, attributes: { path: 'src/scheduler' } } },
    ];
    const res = await tools.graph_mutate.handler({ commands: zug, consumerId: 'test-613' });
    expect(res.success, 'das Fixture muss schreiben, sonst prueft der Test nichts').toBe(true);
  }, 60_000);

  it('rules_get_violations antwortet ueber die Scheibe und nennt den Rest als ZAHL', async () => {
    const v = await tools.rules_get_violations.handler({ severity: 'warning' });
    expect(v.umfang.art).toBe('arbeitsmenge');
    expect(v.umfang.uids).toContain(SCHEIBE);
    // Der Rest faellt nicht weg — er wird zur Zahl.
    expect(v.umfang.ausserhalb).toBeGreaterThan(0);
    // `total` zaehlt die GELIEFERTEN, nie doppelt mit `ausserhalb`.
    expect(v.violations.length).toBeLessThanOrEqual(v.total);
    gemessen.violations = groesse(v);
  }, 120_000);

  it('graph_test_report antwortet ueber die Scheibe, und die Kopfzahlen gelten ueber die Zeilen', async () => {
    const t = await tools.graph_test_report.handler({});
    expect(t.umfang.art).toBe('arbeitsmenge');
    expect(t.umfang.ausserhalb).toBeGreaterThan(0);
    // Zwei Wahrheiten in einer Antwort waeren: 81 im Kopf, 10 in den Zeilen.
    expect(t.summary.requirements).toBe(t.requirements.length);
    gemessen.testReport = groesse(t);
  }, 120_000);

  it('graph_readiness weist den Umfang aus — die SCORES bleiben global', async () => {
    const r = await tools.graph_readiness.handler({});
    expect(r.umfang.art).toBe('arbeitsmenge');
    expect(r.umfang.ausserhalb).toBeGreaterThan(0);
    // Die Zusage dieses Werkzeugs ist eine Aussage ueber das PROJEKT. Eine geschnittene
    // Compliance-Zahl waere genau das falsche Gruen, vor dem der CR selbst warnt.
    const compliance = (r as unknown as { compliance: { score?: number } | number }).compliance;
    const wert = typeof compliance === 'number' ? compliance : compliance.score;
    expect(typeof wert).toBe('number');
    expect(wert!).toBeGreaterThanOrEqual(0);
    expect(wert!).toBeLessThanOrEqual(1);
  }, 120_000);

  it('graph_context traegt die Prosa des Ankers, seiner REQ und seiner SCHEMA — sonst Kanten', async () => {
    const tief = await tools.graph_context.handler({ id: ANKER, depth: 2 });
    const flach = await tools.graph_context.handler({ id: ANKER, depth: 1 });
    // Die STRUKTUR bleibt vollstaendig: der tiefere Schnitt hat mehr Knoten.
    expect(tief.nodeCount).toBeGreaterThan(flach.nodeCount);
    // Gekuerzt wird mit EINEM Zeichen plus EINER Legende, nicht mit einem Satz je Knoten.
    expect(tief.formatE.split('\n').filter((l) => l.includes('= Beschreibung gekuerzt'))).toHaveLength(1);
    // Was gebraucht wird, steht voll da: der Anker selbst und der Wortlaut seiner REQ.
    expect(tief.formatE).toContain('Agentenlauf ausführen');
    expect(tief.formatE).toMatch(/\+ REQ-[a-z-]+\|[A-Za-zÄÖÜ]/);
    // Was Beiwerk ist, steht als Knoten da — ohne Prosa.
    expect(tief.formatE).toMatch(/\+ FCHAIN-[a-z-]+\|…/);
    expect(tief.formatE).toMatch(/\+ MOD-[a-z-]+\|…/);
    gemessen.context = tief.formatE.length;
    gemessen.contextFlach = flach.formatE.length;
  }, 120_000);

  it('die Akzeptanzzahlen — und die eine, die NICHT erreichbar ist', () => {
    const summe = gemessen.violations + gemessen.testReport + gemessen.context;
    // Die Zahlen stehen im Fehlertext, damit eine Regression SAGT, wie weit sie daneben liegt.
    expect(summe, `drei Aufrufe: ${summe} Zeichen (Grenze 15.000, gemessen vorher ~90.000)`).toBeLessThan(15_000);

    /*
     * Die CR-Zusage lautete "graph_context unter 3.000 statt 9.300". Sie gilt bei `depth: 1`,
     * NICHT bei `depth: 2` — und das ist keine Nachlaessigkeit, sondern eine gemessene
     * UNTERGRENZE: die 30-Knoten-Scheibe kostet allein an Format-E-STRUKTUR (uids, Namen, Typen,
     * 35 Kanten) 4.080 Zeichen, bevor ein einziges Wort Prosa dazukommt. Darunter kaeme man nur,
     * indem man Knoten weglaesst — und genau die TESTs und das MOD sind die Definition-of-Done,
     * die dieses Werkzeug zusagt.
     *
     * Der ehrliche Hebel steht deshalb im Skill, nicht im Werkzeug: bei `depth: 1` bleiben, wo
     * `depth: 1` die Frage beantwortet. Die Grenzen hier halten den GEMESSENEN Stand fest.
     */
    expect(gemessen.context, `depth 2: ${gemessen.context} Zeichen (vorher 9.036, Strukturboden 4.080)`).toBeLessThan(7_000);
    expect(gemessen.contextFlach, `depth 1: ${gemessen.contextFlach} Zeichen`).toBeLessThan(3_200);
  });
});
