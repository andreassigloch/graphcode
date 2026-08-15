/**
 * TEST-graphcode-config (CR-GC-329) — die Schwelle steht in der Config und kommt mit
 * der Kennzahl heraus.
 *
 * Der gemessene Mangel: seit CR-SM-233 sind die Urteilsschwellen der Architektur-
 * Metriken Eingabe ohne Default. Ohne Halter im Repo waere jeder konfigurierte Wert ein
 * zweiter Pfad neben dem Code — und ein Konsument, der 71 % anzeigt, muesste sich die
 * 70 % selbst hinschreiben.
 *
 * Geprueft wird deshalb NICHT nur das Laden, sondern die Wirkung: eine Config mit
 * `"instability": null` muss MT-01 im GATE zum Schweigen bringen, waehrend die Zahl in
 * jeder Modulzeile stehen bleibt. Reales Disk-Kuzu im tmp-Verzeichnis, nie `:memory:`.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import type { MutateCommand } from '@sigloch/contracts/harness';
import {
  loadGraphcodeConfig,
  stripJsonComments,
  ConfigError,
  CONFIG_FILENAME,
  DEFAULT_CONFIG,
  DEFAULT_FOCUS_THRESHOLD,
} from '../src/config.js';
import { createHarness } from '../src/index.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { GraphCodeHarness } from '../src/harness.js';

const roots: string[] = [];
const harnesses: GraphCodeHarness[] = [];

function repo(configText?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'graphcode-config-'));
  roots.push(root);
  if (configText !== undefined) writeFileSync(join(root, CONFIG_FILENAME), configText, 'utf8');
  return root;
}

async function harnessOn(root: string): Promise<GraphCodeHarness> {
  const h = await createHarness({ repoRoot: root, scope: { workspaceId: 'cfg-ws', systemId: 'cfg' } });
  harnesses.push(h);
  await h.initialize();
  return h;
}

afterEach(async () => {
  for (const h of harnesses.splice(0)) await h.close();
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

const node = (uid: string, type: string, name: string): MutateCommand => ({
  op: 'add-node',
  node: { uid, type, name, description: `${name}.`, attributes: {} },
});
const edge = (sourceId: string, edgeType: string, targetId: string): MutateCommand => ({
  op: 'add-edge',
  edge: { sourceId, targetId, edgeType, attributes: {} },
});

/** `MOD-loud`: fan_out 5 gegen fan_in 2 → I = 5/7 = 71 %, ueber der 70-%-Schwelle. */
const SEED: MutateCommand[] = [
  node('SYS-c', 'SYS', 'Config system'),
  node('MOD-loud', 'MOD', 'Loud module'),
  node('FUNC-a', 'FUNC', 'Function A'),
  node('FUNC-b', 'FUNC', 'Function B'),
  node('FLOW-1', 'FLOW', 'Flow one'),
  node('FLOW-2', 'FLOW', 'Flow two'),
  node('FLOW-3', 'FLOW', 'Flow three'),
  node('FLOW-4', 'FLOW', 'Flow four'),
  node('FLOW-5', 'FLOW', 'Flow five'),
  edge('FUNC-a', 'allocate', 'MOD-loud'),
  edge('FUNC-b', 'allocate', 'MOD-loud'),
  edge('FUNC-a', 'io', 'FLOW-1'),
  edge('FUNC-a', 'io', 'FLOW-2'),
  edge('FUNC-a', 'io', 'FLOW-3'),
  edge('FUNC-b', 'io', 'FLOW-4'),
  edge('FUNC-b', 'io', 'FLOW-5'),
];

describe('CR-GC-329: Config laden — fehlend, gueltig, kaputt', () => {
  it('fehlende Datei → contracts-Startwert, als solcher ausgewiesen', () => {
    const loaded = loadGraphcodeConfig(repo());

    expect(loaded.source).toBe('default');
    expect(loaded.config).toEqual(DEFAULT_CONFIG);
    expect(loaded.config.metricPolicy).toEqual(DEFAULT_METRIC_POLICY);
    expect(loaded.config.focusThreshold).toBe(DEFAULT_FOCUS_THRESHOLD);
    // Der Pfad steht auch dann drin, wenn die Datei fehlt — er sagt, WO sie hingehoert.
    expect(loaded.path).toContain(CONFIG_FILENAME);
  });

  it('gueltige JSONC mit Kommentaren und abschliessendem Komma wird gelesen', () => {
    const root = repo(`{
      "metricPolicy": {
        // MT-01 unvalidiert (CR-SM-223) — messen, nicht ampeln.
        "instability": null,
        /* Stufen frei waehlbar */
        "lcom4": { "info": 3, "warning": 5 },
        "crossingFlows": { "warning": 3 },
        "riskRpn": 100,
        "apTable": null,
        "moduleSize": { "large": 12, "coupled": 8, "crossings": 2 },
      },
      "focusThreshold": 0.75,
    }`);
    const loaded = loadGraphcodeConfig(root);

    expect(loaded.source).toBe('config');
    expect(loaded.config.metricPolicy).toEqual({
      instability: null, lcom4: { info: 3, warning: 5 },
      // CR-SM-236/229: die Policy ist vollstaendig anzugeben — ein fehlendes Feld ist
      // ein Schemafehler, kein stiller Startwert.
      crossingFlows: { warning: 3 }, riskRpn: 100, apTable: null,
      moduleSize: { large: 12, coupled: 8, crossings: 2 },
    });
    expect(loaded.config.focusThreshold).toBe(0.75);
  });

  it('schemawidrige Datei → Abbruch mit Pfad UND Feld, kein stiller Default', () => {
    const root = repo('{ "metricPolicy": { "instability": 1.5, "lcom4": null, "crossingFlows": { "warning": 3 }, "riskRpn": 100, "apTable": null, "moduleSize": { "large": 12, "coupled": 8, "crossings": 2 } }, "focusThreshold": 0.8 }');

    let err: unknown;
    try { loadGraphcodeConfig(root); } catch (e) { err = e; }

    expect(err).toBeInstanceOf(ConfigError);
    expect((err as ConfigError).message).toContain(CONFIG_FILENAME);
    expect((err as ConfigError).message).toContain('metricPolicy.instability');
  });

  it('fehlendes Pflichtfeld → Abbruch, nicht Ergaenzung aus dem Default', () => {
    const root = repo('{ "metricPolicy": { "instability": 0.7, "lcom4": null, "crossingFlows": { "warning": 3 }, "riskRpn": 100, "apTable": null, "moduleSize": { "large": 12, "coupled": 8, "crossings": 2 } } }');

    expect(() => loadGraphcodeConfig(root)).toThrow(ConfigError);
    expect(() => loadGraphcodeConfig(root)).toThrow(/focusThreshold/);
  });

  it('kaputte Syntax → Abbruch mit Pfad', () => {
    const root = repo('{ "metricPolicy": ');
    expect(() => loadGraphcodeConfig(root)).toThrow(/invalid JSONC/);
  });

  it('stripJsonComments laesst `//` INNERHALB eines Strings stehen', () => {
    const text = '{ "url": "https://example.test/x", // Kommentar\n "n": 1 }';
    const parsed = JSON.parse(stripJsonComments(text));
    expect(parsed).toEqual({ url: 'https://example.test/x', n: 1 });
  });
});

describe('CR-GC-329: die Config wirkt — Gate, Kennzahl und Herkunft in EINER Antwort', () => {
  it('ohne Config: MT-01 feuert, policySource sagt "default"', async () => {
    const harness = await harnessOn(repo());
    expect((await harness.mutate(SEED)).success).toBe(true);
    const tools = bindToolsToHarness(harness);

    const res = await tools.graph_metrics.handler({});
    expect(res.policySource).toBe('default');
    expect(res.policy).toEqual(DEFAULT_METRIC_POLICY);
    expect(harness.evaluateRules().some((v) => v.ruleId === 'MT-01' && v.elementId === 'MOD-loud')).toBe(true);
  });

  it('"instability": null → MT-01 schweigt im GATE, die Zahl bleibt in der Modulzeile', async () => {
    const root = repo('{ "metricPolicy": { "instability": null, "lcom4": { "info": 4, "warning": 6 }, "crossingFlows": { "warning": 3 }, "riskRpn": 100, "apTable": null, "moduleSize": { "large": 12, "coupled": 8, "crossings": 2 } }, "focusThreshold": 0.8 }');
    const harness = await harnessOn(root);
    expect((await harness.mutate(SEED)).success).toBe(true);
    const tools = bindToolsToHarness(harness);

    // Kein Verstoss mehr — und zwar dort, wo geurteilt wird (Apply-Gate), nicht nur
    // in einer Anzeige.
    expect(harness.evaluateRules().some((v) => v.ruleId === 'MT-01')).toBe(false);

    const res = await tools.graph_metrics.handler({});
    const loud = res.modules.find((m) => m.moduleId === 'MOD-loud')!;
    // "null" ist NICHT "Regel aus": die Zahl verschwindet nicht.
    expect(loud.instability).toBeCloseTo(5 / 7, 10);
    expect(res.policy.instability).toBeNull();
    expect(res.policySource).toBe('config');
  });

  it('Wert und Schwelle kommen aus DERSELBEN Antwort — ein Konsument braucht keinen eigenen Zielwert', async () => {
    const root = repo('{ "metricPolicy": { "instability": 0.5, "lcom4": null, "crossingFlows": { "warning": 3 }, "riskRpn": 100, "apTable": null, "moduleSize": { "large": 12, "coupled": 8, "crossings": 2 } }, "focusThreshold": 0.8 }');
    const harness = await harnessOn(root);
    expect((await harness.mutate(SEED)).success).toBe(true);
    const tools = bindToolsToHarness(harness);

    const res = await tools.graph_metrics.handler({});
    const loud = res.modules.find((m) => m.moduleId === 'MOD-loud')!;

    expect(res.policy.instability).toBe(0.5);
    expect(loud.instability! > res.policy.instability!).toBe(true);
    // Dieselbe Schwelle urteilt auch im Gate — nicht eine zum Anzeigen und eine zum Urteilen.
    const mt01 = harness.evaluateRules().find((v) => v.ruleId === 'MT-01' && v.elementId === 'MOD-loud');
    expect(mt01?.message).toContain('>50%');
  });

  it('kaputte Config bricht den Harness-Start ab, statt still auf Defaults zu fallen', async () => {
    const root = repo('{ "metricPolicy": { "instability": 2, "lcom4": null, "crossingFlows": { "warning": 3 }, "riskRpn": 100, "apTable": null, "moduleSize": { "large": 12, "coupled": 8, "crossings": 2 } }, "focusThreshold": 0.8 }');
    await expect(createHarness({ repoRoot: root, scope: { workspaceId: 'cfg-ws', systemId: 'cfg' } }))
      .rejects.toThrow(ConfigError);
  });
});
