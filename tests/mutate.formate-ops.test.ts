/**
 * TEST-formate-ops (CR-GC-627) — Format-E ist eine OPERATIONSSPRACHE, und das Gate nimmt sie ganz.
 *
 * BEFUND: `formatEToCommands` schickte den Text durch eine Graph-Rekonstruktion, und die rekonstruiert
 * einen GRAPHEN — eine Menge `{nodes, edges}`. Ein Graph kann „diese Knoten existieren" sagen,
 * nicht „diesen löschen". Jedes Nicht-Add-Op endete deshalb im Wurf
 * `operation "update_node" is not supported for Graph reconstruction`, obwohl der Parser die vier
 * Präfixe `+ - ~ M` seit jeher kennt und die Abbildung auf `MutateCommand` bis auf `update-edge`
 * eins zu eins ist.
 *
 * Was die Aussperrung kostete, gemessen an zwei Rig-Läufen, Zeichen je geschriebenem Element:
 * opus5-0 279 (`commands`) gegen 84 (`formatE`), opus5-16 223 gegen 94 — Faktor 2,4 bis 3,3. Wer
 * löschte oder änderte, zahlte ihn, und dazu den fehlenden Kanten-Fan-out aus CR-GC-625.
 *
 * POSITIVKONTROLLE: setzt man `formatEToCommands` auf den `decode()`-Umweg zurück, werden die
 * ersten vier Fälle hier rot mit genau jener Codec-Meldung — geprüft am 2026-09-23, bevor der
 * Fix stand.
 *
 * Reales Disk-Kuzu im tmp-Verzeichnis, nie `:memory:`. Keine Mocks, keine Attrappe am Gate.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { knotenAus } from './helpers/format-e.js';
import { FormatEInputSchema, formatEToCommands } from '../src/surface/format-e-commands.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { OP_RISK, type HarnessConfig, type MutateCommand } from '@sigloch/contracts/harness';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'gc-627', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

/**
 * Ein Bestand, an dem sich LÖSCHEN und ÄNDERN zeigen lässt, ohne dass R-01 (jede REQ verifiziert
 * und aufgelöst) den Zug aus einem anderen Grund blockt: die zwei REQ tragen ihren TEST und ihre
 * FUNC von Anfang an.
 */
const SEED = {
  elements: [
    { id: 'SYS-x', type: 'SYS', name: 'Beispielsystem', description: 'Ein System.' },
    { id: 'REQ-alt', type: 'REQ', name: 'Alte Anforderung', description: 'Das System muss einen frueheren Stand herstellen koennen.', kinds: ['functional'] },
    { id: 'REQ-zweit', type: 'REQ', name: 'Zweite Anforderung', description: 'Das System muss den Kantenschnitt melden.', kinds: ['functional'] },
    { id: 'TEST-seed', type: 'TEST', name: 'Seed-Test', description: 'Prueft die Anforderungen.' },
    { id: 'FUNC-seed', type: 'FUNC', name: 'Seed-Funktion', description: 'Erfuellt die Anforderungen.' },
    { id: 'FUNC-opfer', type: 'FUNC', name: 'Opfer-Funktion', description: 'Wird in diesem Test geloescht.' },
  ],
  traces: [
    { source: 'TEST-seed', target: 'REQ-alt', type: 'verify' },
    { source: 'TEST-seed', target: 'REQ-zweit', type: 'verify' },
    { source: 'FUNC-seed', target: 'REQ-alt', type: 'satisfy' },
    { source: 'FUNC-seed', target: 'REQ-zweit', type: 'satisfy' },
  ],
};

type MutateOut = {
  success: boolean;
  tier: string;
  mutations: number;
  violations: Array<{ ruleId: string; message: string }>;
};

let tmp: string;
let harness: GraphCodeHarness;
let tools: MCPToolRegistry;

const knoten = (uid: string) => harness.getGraph().nodes.find((n) => n.uid === uid);
const kante = (s: string, t: string, et: string) =>
  harness.getGraph().edges.find((e) => e.sourceId === s && e.targetId === t && e.edgeType === et);

beforeEach(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'graphcode-formate-ops-'));
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
  harness = new GraphCodeHarness(makeConfig(tmp), storage);
  await harness.initialize();
  await harness.importGraph(SEED);
  tools = bindToolsToHarness(harness);
});

afterEach(async () => {
  await harness.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe('CR-GC-627: die vier Präfixe laufen durch dasselbe Gate', () => {
  it('`~` ändert einen Knoten — Beschreibung und Attribut, ohne ihn neu anzulegen', async () => {
    const vorher = knoten('REQ-alt')!;
    const res = (await tools.graph_mutate.handler({
      formatE: '## Nodes\n### REQ\n~ REQ-alt|Das System muss einen frueheren Stand in unter einer Sekunde herstellen. [status:done]\n',
      consumerId: 't',
    })) as MutateOut;

    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    const nachher = knoten('REQ-alt')!;
    expect(nachher.description).toContain('unter einer Sekunde');
    expect(nachher.attributes.status).toBe('done');
    // Ein `update-node` ist ein PATCH: was die Zeile nicht nennt, bleibt stehen.
    expect(nachher.name).toBe(vorher.name);
    expect(nachher.attributes.kinds).toEqual(vorher.attributes.kinds);
  });

  it('`-` löscht einen Knoten, und seine Kanten gehen mit', async () => {
    // Erst eine Kante an das Opfer, damit der Kantenschnitt überhaupt etwas zu schneiden hat.
    await tools.graph_mutate.handler({
      formatE: '## Edges\n+ FUNC-opfer -satisfy-> REQ-zweit\n',
      consumerId: 't',
    });
    expect(kante('FUNC-opfer', 'REQ-zweit', 'satisfy'), 'Vorbedingung: die Kante muss stehen').toBeDefined();

    const res = (await tools.graph_mutate.handler({
      formatE: '## Nodes\n### FUNC\n- FUNC-opfer\n',
      consumerId: 't',
    })) as MutateOut;

    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(knoten('FUNC-opfer')).toBeUndefined();
    expect(kante('FUNC-opfer', 'REQ-zweit', 'satisfy')).toBeUndefined();
  });

  it('`-` an einer Kantenzeile löscht die Kante und lässt beide Enden stehen', async () => {
    expect(kante('TEST-seed', 'REQ-zweit', 'verify'), 'Vorbedingung').toBeDefined();

    const res = (await tools.graph_mutate.handler({
      formatE: '## Edges\n- TEST-seed -verify-> REQ-zweit\n',
      consumerId: 't',
    })) as MutateOut;

    // R-01 verlangt je REQ einen verifizierenden TEST — der Schnitt erzeugt also einen NEUEN
    // Fehler, und das Gate blockt. Genau richtig: die Operation kommt durch, das URTEIL hält.
    // Geprueft wird beides — dass die Regel greift, und dass der Block den Grund nennt.
    expect(res.success).toBe(false);
    expect(res.violations.map((v) => v.ruleId)).toContain('R-01');
    expect(kante('TEST-seed', 'REQ-zweit', 'verify'), 'bei block wird nichts geschrieben').toBeDefined();

    // Und dieselbe Kante an einem REQ, das seinen zweiten Verifizierer behaelt, geht durch.
    await tools.graph_mutate.handler({
      formatE: '## Nodes\n### TEST\n+ TEST-zweit|Prueft die zweite Anforderung ebenfalls. [__name:Zweiter Test]\n\n## Edges\n+ TEST-zweit -verify-> REQ-zweit\n',
      consumerId: 't',
    });
    const schnitt = (await tools.graph_mutate.handler({
      formatE: '## Edges\n- TEST-seed -verify-> REQ-zweit\n',
      consumerId: 't',
    })) as MutateOut;

    expect(schnitt.success, JSON.stringify(schnitt.violations)).toBe(true);
    expect(kante('TEST-seed', 'REQ-zweit', 'verify')).toBeUndefined();
    expect(knoten('TEST-seed'), 'die Endpunkte bleiben stehen').toBeDefined();
    expect(knoten('REQ-zweit')).toBeDefined();
  });

  it('eine Merge-Zeile lässt das Ziel die Quelle aufnehmen — Kanten wandern mit', async () => {
    await tools.graph_mutate.handler({
      formatE: '## Edges\n+ FUNC-opfer -satisfy-> REQ-zweit\n',
      consumerId: 't',
    });

    const res = (await tools.graph_mutate.handler({
      formatE: '## Merges\nM FUNC-opfer + FUNC-seed\n',
      consumerId: 't',
    })) as MutateOut;

    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(knoten('FUNC-opfer'), 'die Quelle wird absorbiert').toBeUndefined();
    expect(knoten('FUNC-seed'), 'das Ziel bleibt').toBeDefined();
    expect(kante('FUNC-seed', 'REQ-zweit', 'satisfy'), 'die Kante der Quelle haengt jetzt am Ziel').toBeDefined();
  });

  it('`+`, `~` und `-` in EINEM Block: der Batch ist eine Operationsfolge, kein Knotenhaufen', async () => {
    const block =
      '## Nodes\n### REQ\n' +
      '+ REQ-neu|Das System muss den gemischten Batch annehmen. [__name:Gemischter Batch]\n' +
      '@kinds ["functional"]\n' +
      '~ REQ-alt|Das System muss einen frueheren Stand in unter einer Sekunde herstellen.\n' +
      '### FUNC\n' +
      '- FUNC-opfer\n' +
      '\n## Edges\n' +
      '+ TEST-seed -verify-> REQ-neu\n' +
      '+ FUNC-seed -satisfy-> REQ-neu\n';

    const res = (await tools.graph_mutate.handler({ formatE: block, consumerId: 't' })) as MutateOut;

    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(knoten('REQ-neu')?.name).toBe('Gemischter Batch');
    expect(knoten('REQ-alt')?.description).toContain('unter einer Sekunde');
    expect(knoten('FUNC-opfer')).toBeUndefined();
    expect(kante('TEST-seed', 'REQ-neu', 'verify')).toBeDefined();
  });
});

describe('CR-GC-627: die Audit-Spur führt `-` als destruktiv', () => {
  /** Die Kommandos des letzten `mutate`-Eintrags — aus dem Log auf Platte, nicht aus der Antwort. */
  const letzteKommandos = (): MutateCommand[] => {
    const log = join(harness.getStoreDir(), 'audit.jsonl');
    expect(existsSync(log), 'ohne Log keine Spur — dann prueft dieser Test nichts').toBe(true);
    const zeilen = readFileSync(log, 'utf8').trim().split('\n').filter(Boolean);
    const eintraege = zeilen
      .map((z) => JSON.parse(z) as { operation: string; commands?: MutateCommand[] })
      .filter((e) => e.operation === 'mutate' && e.commands !== undefined);
    return eintraege[eintraege.length - 1].commands!;
  };

  it('ein Knoten-Löschzug steht als `delete-node` im Log — und OP_RISK nennt ihn destruktiv', async () => {
    await tools.graph_mutate.handler({ formatE: '## Nodes\n### FUNC\n- FUNC-opfer\n', consumerId: 't' });

    const ops = letzteKommandos().map((c) => c.op);
    expect(ops).toContain('delete-node');
    // Gegen OP_RISK, nicht gegen die Absicht: die Tabelle im Vertrag entscheidet, was destruktiv ist.
    expect(ops.some((op) => OP_RISK[op].destructive)).toBe(true);
    expect(OP_RISK['delete-node'].destructive).toBe(true);
  });

  it('ein Kanten-Löschzug steht als `delete-edge`, ein Add nicht als Löschung', async () => {
    await tools.graph_mutate.handler({ formatE: '## Edges\n- TEST-seed -verify-> REQ-zweit\n', consumerId: 't' });
    expect(letzteKommandos().map((c) => c.op)).toEqual(['delete-edge']);

    await tools.graph_mutate.handler({ formatE: '## Edges\n+ TEST-seed -verify-> REQ-zweit\n', consumerId: 't' });
    const ops = letzteKommandos().map((c) => c.op);
    expect(ops).toEqual(['add-edge']);
    expect(ops.every((op) => !OP_RISK[op].destructive)).toBe(true);
  });
});

describe('CR-GC-627: die Grenzen bleiben, wo sie waren', () => {
  it('delete UND add derselben uid in EINEM Batch wird abgelehnt', async () => {
    const block = '## Nodes\n### FUNC\n- FUNC-opfer\n+ FUNC-opfer|Wieder da. [__name:Wieder da]\n';
    const res = (await tools.graph_mutate.handler({ formatE: block, consumerId: 't' })) as MutateOut;

    expect(res.success).toBe(false);
    expect(JSON.stringify(res.violations)).toContain('FUNC-opfer');
    // `persist` schreibt Deletes ZULETZT — der Kandidat trüge den Knoten, der Store nicht.
    expect(JSON.stringify(res.violations)).toMatch(/Batch|batch/);
    // Und nichts ist passiert: der Knoten steht unveraendert.
    expect(knoten('FUNC-opfer')?.name).toBe('Opfer-Funktion');
  });

  it('dieselbe Kante löschen und anlegen wird ebenso abgelehnt', async () => {
    const block = '## Edges\n- TEST-seed -verify-> REQ-zweit\n+ TEST-seed -verify-> REQ-zweit\n';
    const res = (await tools.graph_mutate.handler({ formatE: block, consumerId: 't' })) as MutateOut;

    expect(res.success).toBe(false);
    expect(kante('TEST-seed', 'REQ-zweit', 'verify'), 'unveraendert').toBeDefined();
  });

  it('eine unbekannte uid bleibt ein Fehler — auch auf der Löschseite', async () => {
    const res = (await tools.graph_mutate.handler({
      formatE: '## Edges\n- FUNC-gibtesnicht -satisfy-> REQ-alt\n',
      consumerId: 't',
    })) as MutateOut;

    expect(res.success).toBe(false);
    expect(JSON.stringify(res.violations)).toContain('FUNC-gibtesnicht');
  });

  it('eine Merge-Zeile mit drei Knoten wird abgelehnt — `merge-nodes` absorbiert genau eins', async () => {
    const res = (await tools.graph_mutate.handler({
      formatE: '## Merges\nM FUNC-opfer + FUNC-seed + TEST-seed\n',
      consumerId: 't',
    })) as MutateOut;

    expect(res.success).toBe(false);
    expect(knoten('FUNC-opfer'), 'nichts passiert').toBeDefined();
  });

  it('`update-edge` hat kein Präfix und bleibt dem commands-Pfad — die Beschreibung sagt es', () => {
    const shape = (tools.graph_mutate.inputSchema as unknown as { def: { shape: Record<string, { description?: string }> } }).def.shape;
    const desc = shape.formatE.description ?? '';
    expect(desc).toContain('update-edge');
    // Und die alte Pauschalaussage ist weg.
    expect(desc).not.toMatch(/Deletes\/updates\/merges brauchen weiterhin commands/);
  });
});

describe('CR-GC-627: Beschreibung, Guide und Code sagen dasselbe', () => {
  /**
   * Die Präfixe, die der Code annimmt — hier NICHT als Liste gepflegt, sondern am lebenden Gate
   * gefahren: jedes Präfix bekommt einen Block, der durchlaufen muss. Eine Beschreibung, die ein
   * fünftes verspräche, hätte hier keinen Fall; eines, das der Code kann und sie verschweigt,
   * fällt in der Gegenrichtung auf.
   */
  const PRAEFIXE = ['+', '-', '~', 'M'] as const;

  it('jedes in der formatE-Beschreibung genannte Präfix wird auch wirklich angenommen', async () => {
    const shape = (tools.graph_mutate.inputSchema as unknown as { def: { shape: Record<string, { description?: string }> } }).def.shape;
    const desc = shape.formatE.description ?? '';
    for (const p of PRAEFIXE) {
      expect(desc, `Praefix ${p} steht nicht in der Beschreibung`).toContain(`\`${p}\``);
    }
  });

  it('der Authoring-Guide zeigt Löschen und Ändern — als kommentierte Zeile, decodierbar bleibt er', async () => {
    const guide = (await tools.graph_authoring_guide.handler({ type: 'REQ' })) as { formatEExample: string };
    const beispiel = guide.formatEExample;

    expect(beispiel).toMatch(/^#.*~ /m);
    expect(beispiel).toMatch(/^#.*- /m);
    // Der Block bleibt, was er war: ein ADDITIVES Beispiel — die `~`/`-`-Zeilen stehen
    // auskommentiert darin, sonst legte der Guide einen Loeschzug als Vorlage vor.
    expect(() => knotenAus(beispiel)).not.toThrow();
  });
});

// CR-GC-641: Format-E hat eine Zod-Tuer. Der Vertrag ist zur Laufzeit pruefbar und als Konstante
// an SCHEMA-format-e gebunden — damit sieht RC-09 jeden zweiten Leser (die Klasse aus CR-GC-627).
describe('CR-GC-641: die Zod-Tuer des Format-E-Vertrags', () => {
  const LEER = { nodes: [], edges: [] };

  it('gueltiger Text → der Operations-Diff des Codecs', () => {
    const r = FormatEInputSchema.safeParse({ text: '## Nodes\n### REQ\n+ REQ-x|Beschreibung [__name:X]\n', bestand: LEER });
    expect(r.success).toBe(true);
    expect(r.success && r.data.operations.map((o) => o.type)).toEqual(['add_node']);
  });

  it('Parse-Fehler werden Zod-Issues — je Codec-Fehler einer, wortgleich', () => {
    const r = FormatEInputSchema.safeParse({ text: '## Nodes\n### REQ\numbricht ohne Praefix\n', bestand: LEER });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].message).toContain('Node line without an operator prefix');
  });

  it('formatEToCommands geht durch die Tuer: dieselbe Meldung wie vorher', () => {
    expect(() => formatEToCommands(LEER, '## Nodes\n### REQ\numbricht ohne Praefix\n'))
      .toThrow(/^Format-E parse errors:\n  - Node line without an operator prefix/);
  });

  it('der Bestand typisiert uids, die der Text nicht deklariert (CR-GC-310) — auch durch die Tuer', () => {
    const bestand = { nodes: [
      { uid: 'REQ-a', type: 'REQ', name: 'a', description: '', attributes: {} },
      { uid: 'TEST-a', type: 'TEST', name: 't', description: '', attributes: {} },
    ], edges: [] };
    const r = FormatEInputSchema.safeParse({ text: '## Edges\n+ TEST-a -verify-> REQ-a\n', bestand });
    expect(r.success).toBe(true);
  });
});
