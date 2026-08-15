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
import { bindToolsWithContext } from './mcp-tools.js';
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
    ...(env.GRAPHCODE_LLM_TIMEOUT_MS ? { callTimeoutMs: Number(env.GRAPHCODE_LLM_TIMEOUT_MS) } : {}),
    ...(env.GRAPHCODE_LLM_TOOLSET ? { toolset: env.GRAPHCODE_LLM_TOOLSET } : {}),
    // Der 2048-Default ist für die lokale Decode-Rate dimensioniert (16 tok/s).
    // Frontier-Modelle schreiben große Batches: 2048 kappt das Tool-Call-JSON,
    // die API liefert input {} → INPUT-SCHEMA-Dead-End (Opus-Nachtest CR-GC-286:
    // 2048 → 10/10 Rejections, 8192 → 0). Anthropic decoded schnell — 8192.
    ...(env.GRAPHCODE_LLM_MAX_TOKENS
      ? { maxTokens: Number(env.GRAPHCODE_LLM_MAX_TOKENS) }
      : env.GRAPHCODE_LLM_BACKEND === 'anthropic'
        ? { maxTokens: 8192 }
        : {}),
    ...(env.GRAPHCODE_LLM_TEMPERATURE ? { temperature: Number(env.GRAPHCODE_LLM_TEMPERATURE) } : {}),
    // Best-of-N (CR-GC-288): N Kandidaten pro Runde + Judge ('gate' | 'model').
    ...(env.GRAPHCODE_LLM_CANDIDATES ? { candidates: Number(env.GRAPHCODE_LLM_CANDIDATES) } : {}),
    ...(env.GRAPHCODE_LLM_JUDGE ? { judge: env.GRAPHCODE_LLM_JUDGE } : {}),
    // Mess-Schalter (CR-GC-293): buildRoundInjection für einen einzelnen Lauf abschalten.
    ...(env.GRAPHCODE_LLM_INJECTION ? { injection: env.GRAPHCODE_LLM_INJECTION !== 'false' } : {}),
  });
}

export interface RunSummary {
  stats: ExecutorStats;
  /** Workspace-relativer Pfad des committeten Graph-Exports. */
  exportPath?: string;
  /** Export verweigert/fehlgeschlagen (z.B. leerer Graph) — die Stats des Laufs
   * gehen deshalb NICHT verloren; ein Lauf ohne durable Elemente ist ein
   * legitimes (negatives) Ergebnis, kein Crash. */
  exportError?: string;
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
    const { registry, ctx } = bindToolsWithContext(harness);
    // Provenance for the whole run (CR-GC-355). THIS is the path with no client-side
    // transcript: `~/.claude/projects` exists for Claude Code and for nothing else, so a
    // local or third-party model's prompts are recorded here or nowhere.
    //
    // `intent` is the HUMAN prose, constant for the run, not the per-round generated
    // instruction. Two reasons: the round instruction is deterministically derivable from
    // the graph state plus the templates in this repo, while the human's sentence is not
    // recoverable from anything once the process exits; and stamping ~4 KB of rendered
    // template onto every record would cost more than the whole trail (measured: the human
    // prompts average 288 B capped). `sessionId` is what ties a run's records together.
    ctx.setOrigin({ model: opts.config.model, intent: opts.intent });
    const stats = await runExecutor({
      registry,
      workspaceDir: opts.repoRoot,
      intent: opts.intent,
      config: opts.config,
      callModel: opts.callModel,
      trace: opts.trace,
    });
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
    const readiness = (await registry['graph_readiness'].handler({})) as Record<string, unknown>;
    return { stats, exportPath, exportError, readiness };
  } finally {
    await harness.close();
  }
}
