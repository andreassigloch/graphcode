/**
 * create-harness.ts — die Composition Root: Kuzu-Adapter, Hook-System und die
 * Live-Update-Emitter der Oberflaeche zu EINEM Harness verdrahtet (FUNC-create-harness).
 *
 * Bis CR-GC-475 lag diese Funktion im Paket-Barrel (`index.ts`) und wurde von sechs
 * Dateien von innen dort importiert. Sie komponiert Kern MIT Oberflaeche
 * (`registerEmitters` aus `./emit`) — also ist sie Oberflaeche, nicht Wurzel. Das
 * Barrel re-exportiert sie weiter; die Paket-Oberflaeche bleibt unveraendert.
 *
 * @author andreas@siglochconsulting
 */
import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { z } from 'zod/v4';
import { KuzuAdapter } from '@sigloch/graph-api-core/kuzu';
import { createSeDescriptor } from '@sigloch/graph-api-core';
import { HarnessConfigSchema } from '@sigloch/contracts/harness';
import { GraphCodeHarness } from '../kernel/harness.js';
import { loadGraphcodeConfig } from '../kernel/config.js';
import { HookSystem } from '../kernel/hooks.js';
import { KUZU_DIR } from '../kernel/workspace.js';
import { registerEmitters } from './emit.js';

/**
 * Wire a harness over a disk-backed Kuzu store at `<repoRoot>/.graphcode/kuzu`.
 * Caller must `await harness.initialize()` before mutating. NEVER `:memory:` —
 * persistence is on disk (REQ-disk-persistence).
 *
 * The live-update emitter is registered by default (REQ-mutation-emits-event):
 * every mutation emits exactly one live-update event. A host passes `onUpdateEvent`
 * to wire its SSE broadcast; the harness core stays headless (no HTTP). The learning
 * feed (`<repoRoot>/.graphcode/trajectory.jsonl`) is materialized in the tool layer
 * as a projection of the operations log (CR-252), not by a harness hook. It lands
 * BESIDE that log, i.e. in the store dir (CR-GC-449) — for this factory the two are
 * the same directory; for a harness on a foreign store they are not, and the repo's
 * feed stays untouched.
 */
export async function createHarness(
  config: z.input<typeof HarnessConfigSchema>,
  opts?: {
    onUpdateEvent?: (event: import('./emit.js').LiveUpdateEvent) => void;
    /** Store-Lock entzogen (CR-GC-372) — der Aufrufer beendet seine Session. */
    onLockLost?: () => void;
  },
): Promise<GraphCodeHarness> {
  const cfg = HarnessConfigSchema.parse(config);
  const kuzuPath = join(cfg.repoRoot, KUZU_DIR);
  // CR-GC-329: die Betriebs-Config des Repos — sie hält die Urteilsschwellen der
  // Architektur-Metriken. Fehlt die Datei, gilt der benannte contracts-Startwert
  // (`source: 'default'`); ist sie da und schemawidrig, bricht der Start hier ab,
  // statt still auf Defaults zu fallen.
  const graphcodeConfig = loadGraphcodeConfig(cfg.repoRoot);
  // graphcode owns the per-repo `.graphcode/` workspace (SPEC §4). Kuzu opens the
  // store at `kuzuPath` but needs its parent to exist — create it on first run.
  mkdirSync(dirname(kuzuPath), { recursive: true });
  const storage = new KuzuAdapter({
    // Dieselbe Descriptor-Herkunft wie im Gate (harness.ts) — die Policy ändert nur
    // die MT-Urteile, das DDL bleibt davon unberührt.
    ontology: createSeDescriptor(graphcodeConfig.config.metricPolicy),
    path: kuzuPath,
  });
  const hooks = new HookSystem({ preCommitTimeout: cfg.preCommitTimeout });
  registerEmitters(hooks, {
    onEvent: opts?.onUpdateEvent,
  });
  // O2 lock guards the store this factory just wired: <repoRoot>/.graphcode (CR-GC-218).
  // storePath enables the CR-GC-249 schema-drift guard (auto-reseed on meta-model change).
  return new GraphCodeHarness(cfg, storage, hooks, {
    lockDir: dirname(kuzuPath),
    storePath: kuzuPath,
    graphcodeConfig,
    onLockLost: opts?.onLockLost,
  });
}
