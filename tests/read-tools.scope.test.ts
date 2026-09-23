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
import { KUERZUNGS_LEGENDE } from '../src/surface/read.js';
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

  it('CR-GC-624: Ring 2 steht als Rand da — vollstaendig, aber nicht geoeffnet', async () => {
    const tief = await tools.graph_context.handler({ id: ANKER, depth: 2 });
    const flach = await tools.graph_context.handler({ id: ANKER, depth: 1 });
    // Der Rand existiert genau dort, wo es einen zweiten Ring gibt.
    expect(tief.formatE).toContain('## Rand (Ring 2');
    expect(flach.formatE, 'bei depth 1 gibt es keinen Ring 2 — und damit keinen Rand').not.toContain('## Rand');
    // KEIN Knoten faellt weg: die Zahl gilt weiter fuer die ganze Scheibe, und jeder Ring-2-Knoten
    // steht mit uid im Randblock.
    const randBlock = tief.formatE.slice(tief.formatE.indexOf('## Rand'));
    const imInnenring = new Set(
      [...tief.formatE.slice(0, tief.formatE.indexOf('## Rand')).matchAll(/^\+ ([A-Z]+-[\w-]+)\|/gm)].map((m) => m[1]),
    );
    const imRand = new Set([...randBlock.matchAll(/([A-Z]+-[\w-]+)/g)].map((m) => m[1]));
    expect(imInnenring.size + [...imRand].filter((u) => !imInnenring.has(u)).length).toBe(tief.nodeCount);
    // Der Rand traegt Richtung und Kantentyp, nicht nur eine Namensliste.
    expect(randBlock).toMatch(/[A-Z]+-[\w-]+ [a-z]+> [A-Z]/);
    // Deterministisch — zwei Laeufe, gleiche Bytes.
    expect((await tools.graph_context.handler({ id: ANKER, depth: 2 })).formatE).toBe(tief.formatE);
  }, 120_000);

  it('die Akzeptanzzahlen — und die eine, die NICHT erreichbar ist', () => {
    const summe = gemessen.violations + gemessen.testReport + gemessen.context;
    // Die Zahlen stehen im Fehlertext, damit eine Regression SAGT, wie weit sie daneben liegt.
    expect(summe, `drei Aufrufe: ${summe} Zeichen (Grenze 15.000, gemessen vorher ~90.000)`).toBeLessThan(15_000);

    /*
     * Die 4.080 Zeichen "Strukturboden", die hier bis CR-GC-624 als UNTERGRENZE standen, waren
     * keine: sie waren die Folge einer Darstellung. Zerlegt ueber alle 125 FUNC-Anker des
     * graphcode-Modells bei `depth: 2` — Kantenzeilen 2.801, Attributzeilen 2.593,
     * Identitaetszeilen des Aussenrings 1.730, Prosa 2.670 — sitzt die Masse nicht in der Prosa,
     * sondern in der KNOTENZAHL: 12 im Innenring, 42 im Ring 2, aufgefaechert ueber Hub-FLOWs.
     *
     * Ring 2 steht seit CR-GC-624 als Rand da (Identitaet + Kante, gruppiert), nicht als
     * geoeffneter Knoten. Weggelassen wird nichts: `nodeCount` zaehlt weiter die ganze Scheibe.
     *
     * Das Ziel des Befunds war "unter 4.000". Gemessen sind es 4.153 — und die Differenz ist
     * bezahlt, nicht vergessen: nach dem Innenknoten gruppiert waere der Rand 3.513 Zeichen gross
     * gewesen und haette sechs von dreissig Knoten verschluckt (die, die nur an Ring-2-Knoten
     * haengen). Eine Scheibe, die Knoten verliert, um eine runde Zahl zu treffen, waere genau das
     * Falsch-Gruen, gegen das dieser Messtest steht.
     */
    expect(gemessen.context, `depth 2: ${gemessen.context} Zeichen (vorher 9.036, nach CR-GC-613 6.615)`).toBeLessThan(4_400);
    expect(gemessen.contextFlach, `depth 1: ${gemessen.contextFlach} Zeichen`).toBeLessThan(3_200);
  });
});

/**
 * CR-GC-621 — die beiden Werkzeuge, die nach CR-GC-613 oben standen.
 *
 * Gemessen am Lauf `gefuehrt-0`: `graph_elements` 7.143 Zeichen je Aufruf, `graph_expand` 4.224 —
 * beide mit voller Prosa je Knoten, obwohl keines von beiden eine Prosa-Frage beantwortet.
 */
describe('CR-GC-621: die Liste antwortet mit Identitaet, der Zweig kuerzt wie der Kontext', () => {
  it('graph_elements kuerzt die Beschreibungen und nennt die Kuerzung EINMAL', async () => {
    const kurz = await tools.graph_elements.handler({ type: 'REQ', limit: 100, format: 'json', prosa: false });
    const voll = await tools.graph_elements.handler({ type: 'REQ', limit: 100, format: 'json', prosa: true });
    // Die Scheibe ist dieselbe — gekuerzt wird der Text, nicht die Menge.
    expect(kurz.nodes.map((n) => n.uid)).toEqual(voll.nodes.map((n) => n.uid));
    expect(kurz.total).toBe(voll.total);
    expect(kurz.nodes.length).toBeGreaterThan(20); // sonst misst der Test seine Fixture
    const g1 = groesse(kurz), g0 = groesse(voll);
    expect(g1, `REQ-Liste: ${g1} statt ${g0} Zeichen`).toBeLessThan(g0 * 0.6);
    // EINE Legende in der Antwort, nicht ein Hinweis je Knoten.
    expect(kurz.legende).toBe(KUERZUNGS_LEGENDE);
    expect(kurz.nodes.every((n) => n.description === '…')).toBe(true);
  }, 120_000);

  it('prosa:true liefert weiter den vollen Wortlaut — der benannte Ausweg', async () => {
    const voll = await tools.graph_elements.handler({ type: 'REQ', limit: 100, format: 'json', prosa: true });
    expect(voll.legende).toBeUndefined();
    expect(voll.nodes.some((n) => (n.description ?? '').length > 40)).toBe(true);
  }, 120_000);

  it('auch der Format-E-Weg ist gekuerzt — sonst waere er der stille Umweg', async () => {
    const fe = await tools.graph_elements.handler({ type: 'REQ', limit: 100, format: 'formatE', prosa: false });
    const feVoll = await tools.graph_elements.handler({ type: 'REQ', limit: 100, format: 'formatE', prosa: true });
    expect(fe.formatE.length).toBeLessThan(feVoll.formatE.length * 0.6);
    expect(fe.formatE.split('\n').filter((l) => l.includes('= Beschreibung gekuerzt'))).toHaveLength(1);
  }, 120_000);

  it('graph_expand antwortet mit Identitaet — gleiche Marke, gleiche Legende', async () => {
    const e = await tools.graph_expand.handler({ handle: ANKER, branch: 'all', depth: 2 });
    // Die Struktur bleibt vollstaendig: die Zahlen zaehlen die GANZE Nachbarschaft.
    expect(e.nodeCount).toBeGreaterThan(5);
    expect(e.edgeCount).toBeGreaterThan(5);
    expect(e.formatE.split('\n').filter((l) => l.includes('= Beschreibung gekuerzt'))).toHaveLength(1);
    // Der Anker traegt seinen Wortlaut, alles andere steht als Knoten da — auch REQ und SCHEMA,
    // anders als bei `graph_context`: wer vertieft, sucht die Struktur und oeffnet danach gezielt.
    expect(e.formatE).toContain('Agentenlauf ausführen');
    expect(e.formatE).toMatch(/\+ (MOD|FCHAIN|TEST|UC)-[a-z-]+\|…/);
    expect(e.formatE, 'sonst waere es die Kontext-Regel, und die spart hier 12 % statt 50 %').toMatch(
      /\+ REQ-[a-z-]+\|…/,
    );
    expect(e.formatE.length, `expand am Golden-Anker: ${e.formatE.length} statt 5.735 Zeichen`).toBeLessThan(3_200);
  }, 120_000);
});
