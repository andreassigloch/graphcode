/**
 * CR-GC-392 — der Export darf beim Shutdown nicht im Entprell-Fenster hängenbleiben.
 *
 * Kontext: der Store IST die Quelle (`REQ-graph-is-ssot`); die committete
 * `docs/graph/*.graph.json` ist sein Export-Artefakt. Seit CR-GC-323 folgt der Export
 * jeder Mutation — aber entprellt (`AUTO_EXPORT_DEBOUNCE_MS` = 250 ms). Endet die Session
 * INNERHALB dieses Fensters, fällt das Artefakt einen Batch hinter den Store zurück.
 *
 * Das war folgenlos, solange ein Boot-Abgleich die Abweichung wenigstens meldete. Der ist
 * mit diesem CR entfallen (er lud nichts und entschied nichts, legte aber nahe, die Datei
 * könne mitreden). Damit ist Vollständigkeit des Exports die einzige verbleibende Zusicherung
 * — und die hängt an genau einem `flush()`, dessen Rückgabewert `bootHost` vorher wegwarf.
 *
 * Der zweite Fall unten ist der Rot-Nachweis, dauerhaft in der Suite: er hält fest, dass ein
 * Shutdown OHNE flush das Artefakt nachweislich unvollständig lässt. Fällt er weg, prüft der
 * erste Fall nur noch, dass Exportieren überhaupt funktioniert.
 *
 * Reale Disk-Kuzu, echtes Gate, kein Mock, kein Fake-Timer.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import { registerAutoExport, AUTO_EXPORT_DEBOUNCE_MS, type AutoExportHandle } from '../src/auto-export.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const SNAPSHOT = 'docs/graph/graphcode.graph.json';
const UID = 'FUNC-flush-probe';

let repoRoot: string;
let harness: GraphCodeHarness;
let autoExport: AutoExportHandle;

beforeEach(async () => {
  repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-flush-'));
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'demo-ws', systemId: 'graphcode' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  harness = new GraphCodeHarness(config, storage);
  await harness.initialize();
  const registry = bindToolsToHarness(harness);
  autoExport = registerAutoExport(harness, registry.graph_export);
});

afterEach(async () => {
  autoExport?.cancel();
  await harness?.close?.();
  rmSync(repoRoot, { recursive: true, force: true });
});

/** Eine echte Mutation durchs Gate — der post-apply-Hook plant daraufhin den Export. */
async function mutateThrough(): Promise<void> {
  const res = await harness.mutate([
    {
      op: 'add-node',
      node: { uid: UID, type: 'FUNC', name: 'Flush-Sonde', description: 'Prueft den Shutdown-Export.' },
    },
  ]);
  expect(res.success, 'die Mutation selbst muss durchs Gate gehen').toBe(true);
}

function snapshotHas(uid: string): boolean {
  const file = join(repoRoot, SNAPSHOT);
  if (!existsSync(file)) return false;
  const json = JSON.parse(readFileSync(file, 'utf8')) as { elements?: { id: string }[] };
  return (json.elements ?? []).some((e) => e.id === uid);
}

describe('CR-GC-392: Shutdown im Entprell-Fenster laesst kein unvollstaendiges Artefakt zurueck', () => {
  it('MIT flush: der Batch steht im Artefakt, obwohl sofort heruntergefahren wurde', async () => {
    await mutateThrough();
    // Kein Warten: genau der Fall, den das Entprellen sonst verschluckt.
    await autoExport.flush();
    expect(snapshotHas(UID), 'flush() muss den anstehenden Export vor dem Shutdown schreiben').toBe(true);
  });

  it('OHNE flush: das Artefakt bleibt hinter dem Store zurueck — der Grund, warum es ihn braucht', async () => {
    await mutateThrough();
    autoExport.cancel(); // Shutdown reisst den Timer ab, ohne zu exportieren
    expect(snapshotHas(UID), 'ohne flush darf der Batch NICHT im Artefakt stehen').toBe(false);
    // Der Store hat ihn trotzdem — die Quelle war nie falsch, nur das Artefakt.
    expect(harness.getGraph().nodes.some((n) => n.uid === UID)).toBe(true);
  });

  it('das Entprell-Fenster ist der Grund, und es ist nicht null', () => {
    expect(AUTO_EXPORT_DEBOUNCE_MS).toBeGreaterThan(0);
  });

  it('der Host verdrahtet den flush in den Shutdown — nicht nur die Funktion existiert', () => {
    // Verhaltenstests oben koennen nicht sehen, ob bootHost den Handle noch wegwirft
    // (genau der Fehler, den dieser CR behebt). Diese Zeile ist die Verdrahtung.
    const src = readFileSync(join(__dirname, '..', 'src', 'mcp-server.ts'), 'utf8');
    expect(src).toMatch(/lifecycle\.add\(\{\s*name:\s*'auto-export flush',\s*close:\s*\(\)\s*=>\s*autoExport\.flush\(\)/);
  });

  it('der Boot gleicht NICHT mehr gegen die committete JSON ab', () => {
    // Der Store ist die Quelle; ein Abgleich beim Start suggeriert, die Datei koenne mitreden.
    const src = readFileSync(join(__dirname, '..', 'src', 'mcp-server.ts'), 'utf8');
    expect(src).not.toMatch(/Kuzu store differs from/);
  });
});
