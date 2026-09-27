/**
 * CR-GC-689 — der Umfang-Ausweis wiederholte die ganze Arbeitsmenge.
 *
 * Gemessen am Prosa-Lauf `opus5-17` (runde18): `rules_get_violations {severity:'warning',
 * detail:'grouped'}` antwortete mit 12.509 und 12.039 Zeichen; davon waren 8.418 und 9.557 allein
 * `umfang.uids` — 299 und 339 uids, bei `ausserhalb: 0`. Ein Spezifikationslauf schreibt ueberall,
 * die Arbeitsmenge IST das Modell, der Schnitt nimmt nichts weg — und der Ausweis darueber wurde
 * zum groessten Teil der Antwort. `opus5-16` (vor CR-GC-613, ohne `umfang`): 1.846.
 *
 * Nachgefahren wird hier genau diese Lage: EIN Schreibzug, der jeden Knoten des sigllm-Golden v98
 * anfasst. Echter Kuzu-Store auf Platte, echtes Gate, keine Attrappe.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { alsFormatE } from './helpers/format-e.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

const GOLDEN = join(__dirname, '..', 'rig', 'sigllm-spezifikation', 'golden', 'sigllm-v98.graph.json');

let tmp: string;
let harness: GraphCodeHarness;
let tools: ReturnType<typeof bindToolsToHarness>;
let angefasst: string[];

const groesse = (x: unknown) => JSON.stringify(x).length;

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'gc-689-'));
  mkdirSync(join(tmp, 'docs', 'graph'), { recursive: true });
  copyFileSync(GOLDEN, join(tmp, 'docs', 'graph', 'sigllm.graph.json'));
  const cfg: HarnessConfig = {
    repoRoot: tmp,
    scope: { workspaceId: 'gc-689', systemId: 'sigllm' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
  harness = new GraphCodeHarness(cfg, new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') }), undefined, { lockDir: tmp });
  await harness.initialize();
  await harness.seedFromJson();
  tools = bindToolsToHarness(harness);

  // Der Spezifikationslauf: die Sitzung hat JEDEN Knoten angefasst.
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as { elements: { id: string }[] };
  angefasst = golden.elements.map((e) => e.id);
  const zug: MutateCommand[] = angefasst.map((uid) => ({
    op: 'update-node',
    node: { uid, attributes: { spezLauf: '689' } },
  }));
  const res = await tools.graph_mutate.handler({ formatE: alsFormatE(zug, harness), consumerId: 'test-689' });
  if (!res.success) throw new Error(`Fixture schreibt nicht: ${JSON.stringify(res.violations).slice(0, 500)}`);
}, 180_000);

afterAll(async () => {
  await harness.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe('CR-GC-689: der Umfang-Ausweis waechst nicht mit der Arbeitsmenge', () => {
  it('rules_get_violations: die Arbeitsmenge ist das Modell, der Ausweis bleibt eine Zahl', async () => {
    const v = await tools.rules_get_violations.handler({ severity: 'warning', detail: 'grouped' });
    // Sonst misst der Test seine Fixture: die Scheibe muss wirklich das ganze Modell sein.
    expect(angefasst.length).toBeGreaterThan(200);
    expect(v.umfang.art).toBe('arbeitsmenge');
    expect(v.umfang.ausserhalb).toBe(0);
    expect(v.umfang.elemente).toBe(angefasst.length);
    // Der Ausweis ist konstant klein — vorher 8.418 bis 9.557 Zeichen (opus5-17).
    expect(groesse(v.umfang), `umfang: ${groesse(v.umfang)} Zeichen`).toBeLessThan(100);
    const ohneUmfang = groesse({ ...v, umfang: undefined });
    expect(groesse(v) - ohneUmfang, 'der Ausweis darf die Antwort nicht dominieren').toBeLessThan(100);
  }, 120_000);

  it('graph_test_report und graph_readiness tragen denselben kleinen Ausweis', async () => {
    const t = await tools.graph_test_report.handler({});
    expect(t.umfang.art).toBe('arbeitsmenge');
    expect(groesse(t.umfang), `test_report umfang: ${groesse(t.umfang)} Zeichen`).toBeLessThan(100);
    const r = await tools.graph_readiness.handler({});
    expect(r.umfang.art).toBe('arbeitsmenge');
    expect(r.umfang.elemente).toBe(angefasst.length);
    expect(groesse(r.umfang), `readiness umfang: ${groesse(r.umfang)} Zeichen`).toBeLessThan(100);
  }, 120_000);
});
