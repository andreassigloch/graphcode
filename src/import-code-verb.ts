/**
 * import-code-verb.ts — `graphcode import-code [dir]` (CR-GC-298).
 *
 * Deterministischer Code-Repo-Import: TS-Dateien → graphifys
 * `extractCodeRepoPipeline` (Tree-sitter, kein LLM) → FUNC/MOD/FLOW+SCHEMA
 * durchs Apply-Gate. Semantik ist RESEED, nie Merge: automatisches Backup des
 * bestehenden Graphen, dann EIN mutate()-Batch, nach dem die Graph-Topologie
 * exakt der Extraktion entspricht (Stale-Knoten/-Kanten geloescht, Rest
 * upsertet) — gleicher Repo-Stand ergibt denselben Graphen, Leichen nach
 * Refactorings sind unmoeglich. Bewusst NICHT
 * `harness.reseed()` (dessen Kontrakt ist „Store ← committetes SSOT", am Gate
 * vorbei) — Gate-only-writes gilt auch hier.
 *
 * Harness-Lifecycle (Election/Lock, seedFromJson-Parität, close im finally)
 * exakt wie `executeRun` (run-verb.ts) — kein Parallelweg.
 *
 * @author andreas@siglochconsulting
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import {
  extractCodeRepoPipeline,
  McpConsumerGate,
  type CodeRepoFile,
  type GateViolation,
  type MutateTransportResult,
} from '@sigloch/graphify';
import type { MutateResult } from '@sigloch/contracts/harness';
import { createHarness } from './index.js';
import { bindToolsToHarness } from './mcp-tools.js';
import { deriveMemberName } from './mcp-server.js';
import { exportGraphJson } from './exporter.js';

/** Verzeichnisse, die nie Quell-Code des Repos sind (Dot-Dirs sind separat ausgeschlossen). */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage']);

/**
 * Alle `.ts`/`.tsx` unter `dir`, Pfade relativ zu `dir` (posix). Dot-Dirs
 * (.git, .graphcode, .claude, …), node_modules/dist und `.d.ts` sind raus —
 * Deklarationen tragen keine Implementierung, sie würden nur Phantom-MODs erzeugen.
 */
export function discoverTsFiles(dir: string): CodeRepoFile[] {
  const files: CodeRepoFile[] = [];
  const walk = (abs: string): void => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) {
        walk(child);
      } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.push({
          path: relative(dir, child).split('\\').join('/'),
          content: readFileSync(child, 'utf8'),
        });
      }
    }
  };
  walk(dir);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export interface ImportCodeSummary {
  /** Anzahl gescannter Quelldateien. */
  files: number;
  /** Extrahierte Kandidaten je Element-Typ (vor dem Gate). */
  extracted: Record<string, number>;
  /** Gate-Verdict der Pipeline (graphify ImportResult-Kern). */
  status: 'success' | 'partial' | 'failed';
  applied: { nodes: number; edges: number };
  violations: GateViolation[];
  /** Repo-relativer Pfad des Pre-Import-Backups (fehlt beim Erstlauf auf leerem Graph). */
  backupPath?: string;
  /** Repo-relativer Pfad des committeten Graph-Exports. */
  exportPath?: string;
  /** Export verweigert/fehlgeschlagen — Import-Ergebnis bleibt trotzdem erhalten. */
  exportError?: string;
}

/**
 * Ein vollständiger `graphcode import-code`: Harness auf repoRoot (gleiche
 * Election wie `graphcode mcp` — Store belegt ⇒ StoreOwnershipError an den
 * Caller), Backup → Reseed-Batch durchs Gate → graph_export. Der Store-Lock
 * wird IMMER freigegeben.
 */
export async function executeImportCode(opts: {
  repoRoot: string;
  /** Scan-Wurzel (Default repoRoot). */
  dir?: string;
  /** Test-Injektion — Produktion liest per discoverTsFiles vom Disk. */
  files?: CodeRepoFile[];
  trace?: (line: string) => void;
}): Promise<ImportCodeSummary> {
  const trace = opts.trace ?? (() => {});
  const scanDir = opts.dir ? resolve(opts.repoRoot, opts.dir) : opts.repoRoot;
  const files = opts.files ?? discoverTsFiles(scanDir);
  if (files.length === 0) {
    throw new Error(`graphcode import-code: keine .ts/.tsx-Dateien unter ${scanDir}.`);
  }

  const member = deriveMemberName(opts.repoRoot);
  const harness = await createHarness({
    repoRoot: opts.repoRoot,
    scope: { workspaceId: member, systemId: member },
  });
  await harness.initialize();
  try {
    if (harness.getGraph().nodes.length === 0) {
      try {
        await harness.seedFromJson(); // Parität zu `graphcode mcp`: seed-on-empty
      } catch {
        // frisches Repo ohne committeten Graphen — Erstlauf, nichts zu sichern
      }
    }

    // 1. Backup VOR jeder Änderung — der Reseed trifft auch hand-autorisierte
    //    UC/REQ/ACTOR; das Backup ist der Recovery-Pfad (Entscheidung 2026-08-05).
    const prev = harness.getGraph();
    let backupPath: string | undefined;
    if (prev.nodes.length > 0) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      backupPath = join('.graphcode', 'backup', `graph-${ts}.json`);
      const abs = join(opts.repoRoot, backupPath);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, exportGraphJson(prev));
      trace(`backup: ${backupPath} (${prev.nodes.length} nodes, ${prev.edges.length} edges)`);
    }

    // 2. Reseed-Batch: EIN atomarer Gate-Durchlauf (blockt: nichts passiert, der
    //    alte Graph bleibt stehen). Geloescht wird nur, was der Import NICHT
    //    wieder anlegt: persist() schreibt deletes LAST, delete+add derselben
    //    uid in einem Batch wuerde den Store-Knoten nach dem Upsert wieder
    //    entfernen (Store weicht von Memory ab). Wiederkehrende uids werden
    //    upsertet, die Topologie spiegelt trotzdem exakt die Extraktion;
    //    Gate-Bindings (codeRef) auf unveraenderten Funktionen ueberleben.
    const registry = bindToolsToHarness(harness);
    const edgeKey = (e: { sourceId: string; targetId: string; edgeType: string }): string =>
      `${e.sourceId} ${e.edgeType} ${e.targetId}`;
    const transport = async (commands: unknown[]): Promise<MutateTransportResult> => {
      const cmds = commands as Array<
        | { op: 'add-node'; node: { uid: string } }
        | { op: 'add-edge'; edge: { sourceId: string; targetId: string; edgeType: string } }
      >;
      const incomingNodes = new Set(cmds.filter((c) => c.op === 'add-node').map((c) => c.node.uid));
      const incomingEdges = new Set(cmds.filter((c) => c.op === 'add-edge').map((c) => edgeKey(c.edge)));
      // CR-GC-302: der SYS-Anker ueberlebt den Reseed. graphify extrahiert
      // FUNC/MOD/FLOW/SCHEMA und NIE ein SYS — ohne diese Ausnahme raeumt der
      // Stale-Filter den vorhandenen SYS-Knoten samt Intention und
      // analysisFreshness-Stamps weg, und AF-01..05 fallen zurueck in die
      // Vacuous-Exemption (fehlende Analyse wird unsichtbar statt laut).
      const staleNodes = prev.nodes.filter((n) => n.type !== 'SYS' && !incomingNodes.has(n.uid));
      const staleNodeUids = new Set(staleNodes.map((n) => n.uid));
      // Kanten an geloeschten Knoten raeumt delete-node selbst ab; nur ueberlebende
      // Endpunkte mit weggefallener Kante brauchen ein explizites delete-edge.
      const staleEdges = prev.edges.filter(
        (e) =>
          !incomingEdges.has(edgeKey(e)) && !staleNodeUids.has(e.sourceId) && !staleNodeUids.has(e.targetId),
      );
      // CR-GC-302: fehlt der Anker ganz (frisches Repo, reiner Code-Import), legt ihn
      // der Batch an — durchs Gate, im selben atomaren Durchlauf, auditiert als
      // consumerId `import-code`. Nur wenn WEDER der Bestand NOCH die Extraktion ein
      // SYS traegt: kein Overwrite, und nie delete+add derselben uid in einem Batch
      // (persist schreibt deletes zuletzt — der Store wuerde vom Speicher abweichen).
      const hasSys =
        prev.nodes.some((n) => n.type === 'SYS') ||
        cmds.some((c) => c.op === 'add-node' && c.node.uid.startsWith('SYS-'));
      const ensureSys = hasSys
        ? []
        : [
            {
              op: 'add-node',
              node: {
                uid: `SYS-${member}`,
                type: 'SYS',
                name: member,
                description: '',
                attributes: { status: 'draft' },
              },
            },
          ];
      const batch = [
        ...staleNodes.map((n) => ({ op: 'delete-node', uid: n.uid })),
        ...staleEdges.map((e) => ({
          op: 'delete-edge',
          edge: { sourceId: e.sourceId, targetId: e.targetId, edgeType: e.edgeType },
        })),
        ...ensureSys,
        ...commands,
      ];
      if (batch.length === 0) return { success: true, violations: [] };
      const res = (await registry['graph_mutate'].handler({
        commands: batch,
        consumerId: 'import-code',
      })) as MutateResult;
      return {
        success: res.success,
        tier: res.tier,
        violations: res.violations.map((v) => ({
          ruleId: v.ruleId,
          severity: v.severity,
          elementId: v.elementId ?? '',
          message: v.message,
          ...(v.fixHint !== undefined ? { fixHint: v.fixHint } : {}),
        })),
      };
    };

    const result = await extractCodeRepoPipeline(files, { gate: new McpConsumerGate(transport) });

    const extracted: Record<string, number> = {};
    for (const n of result.typed.nodes) extracted[n.type] = (extracted[n.type] ?? 0) + 1;
    trace(
      `extracted: ${files.length} files → ` +
        Object.entries(extracted)
          .map(([t, c]) => `${c} ${t}`)
          .join(', '),
    );

    // 3. Committen: graph_export ist der kanonische Sync-Pfad (Parität zu executeRun);
    //    ein verweigerter Export (z.B. geblockter Import auf leerem Store) ist ein
    //    berichtetes Ergebnis, kein Crash.
    let exportPath: string | undefined;
    let exportError: string | undefined;
    try {
      const exported = (await registry['graph_export'].handler({})) as {
        graphJson?: { path?: string };
      };
      exportPath = exported.graphJson?.path;
    } catch (err) {
      exportError = err instanceof Error ? err.message : String(err);
    }

    return {
      files: files.length,
      extracted,
      status: result.imported.status,
      applied: { nodes: result.imported.appliedNodesCount, edges: result.imported.appliedEdgesCount },
      violations: result.imported.violations ?? [],
      backupPath,
      exportPath,
      exportError,
    };
  } finally {
    await harness.close();
  }
}
