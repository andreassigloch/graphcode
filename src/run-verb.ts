/**
 * run-verb.ts — `graphcode run "<intent>"` (CR-GC-279, Weg C Teil 2).
 *
 * Autoriert den Graphen des Repos generativ über den embedded Executor
 * (CR-GC-278) — Seed → Expand → Handoff, gegen LM Studio oder Anthropic-BYOK,
 * ohne Fremd-Harness. Von cli.ts getrennt, weil cli.ts beim Import sein
 * `main()` startet — dieser Modul-Schnitt macht den run-Pfad testbar, und der
 * Test fährt exakt den Produktions-Pfad (kein Parallelweg).
 *
 * @author andreas@siglochconsulting
 */
import { createHarness } from './index.js';
import { bindToolsToHarness } from './mcp-tools.js';
import { deriveMemberName } from './mcp-server.js';
import {
  ExecutorConfigSchema,
  runExecutor,
  type CallModel,
  type ExecutorConfig,
  type ExecutorStats,
} from './executor.js';

/**
 * Env → ExecutorConfig. Explizit, keine stillen Fallbacks: fehlende
 * Pflicht-Variablen sind ein Fehler mit vollständiger Usage-Nennung.
 */
export function parseExecutorEnv(env: NodeJS.ProcessEnv): ExecutorConfig {
  const missing = ['GRAPHCODE_LLM_BASE_URL', 'GRAPHCODE_LLM_MODEL'].filter((k) => !env[k]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `graphcode run: fehlende Env-Variablen: ${missing.join(', ')}. ` +
        'Pflicht: GRAPHCODE_LLM_BASE_URL, GRAPHCODE_LLM_MODEL; ' +
        'optional: GRAPHCODE_LLM_BACKEND=openai|anthropic (default openai), GRAPHCODE_LLM_API_KEY, ' +
        'GRAPHCODE_LLM_MAX_ROUNDS.',
    );
  }
  return ExecutorConfigSchema.parse({
    backend: env.GRAPHCODE_LLM_BACKEND || undefined,
    baseUrl: env.GRAPHCODE_LLM_BASE_URL,
    model: env.GRAPHCODE_LLM_MODEL,
    apiKey: env.GRAPHCODE_LLM_API_KEY || undefined,
    ...(env.GRAPHCODE_LLM_MAX_ROUNDS ? { maxRounds: Number(env.GRAPHCODE_LLM_MAX_ROUNDS) } : {}),
  });
}

export interface RunSummary {
  stats: ExecutorStats;
  /** Workspace-relativer Pfad des committeten Graph-Exports. */
  exportPath?: string;
  readiness: Record<string, unknown>;
}

/**
 * Ein vollständiger `graphcode run`: Harness auf repoRoot (gleiche Election wie
 * `graphcode mcp` — Store belegt ⇒ StoreOwnershipError an den Caller), Executor-
 * Loop, danach graph_export + Readiness. Der Store-Lock wird IMMER freigegeben.
 */
export async function executeRun(opts: {
  repoRoot: string;
  intent?: string;
  config: ExecutorConfig;
  /** Test-Injektion — Produktion lässt runExecutor den HTTP-Backend-Call bauen. */
  callModel?: CallModel;
  trace?: (line: string) => void;
}): Promise<RunSummary> {
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
        // frisches Repo ohne committeten Graphen — Kaltstart aus dem Intent
      }
    }
    if (!opts.intent?.trim() && harness.getGraph().nodes.length === 0) {
      throw new Error(
        'graphcode run: leerer Graph und kein Intent — headless kann niemand rückfragen. ' +
          'Usage: graphcode run "<intent>"',
      );
    }
    const registry = bindToolsToHarness(harness);
    const stats = await runExecutor({
      registry,
      workspaceDir: opts.repoRoot,
      intent: opts.intent,
      config: opts.config,
      callModel: opts.callModel,
      trace: opts.trace,
    });
    const exported = (await registry['graph_export'].handler({})) as {
      graphJson?: { path?: string };
    };
    const readiness = (await registry['graph_readiness'].handler({})) as Record<string, unknown>;
    return { stats, exportPath: exported.graphJson?.path, readiness };
  } finally {
    await harness.close();
  }
}
