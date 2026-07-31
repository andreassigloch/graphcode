#!/usr/bin/env node
/**
 * cli.ts — the `graphcode` binary (MOD-cli).
 *
 * Verbs:
 *   - `graphcode mcp`               boots the MCP-stdio server so an agent host
 *                                   (Claude Code, OpenCode, …) launches it from `.mcp.json`.
 *   - `graphcode host`             boots the read-only HOST + SSE bridge (CR-GC-114,
 *                                   MOD-host-bridge) — owns the single Kuzu store and
 *                                   serves /health + /events (SSE) to a live viewer.
 *                                   NO write route (the write path is MCP-stdio).
 *   - `graphcode init|update|remove` self-contained scaffold lifecycle (CR-GC-112,
 *                                   MOD-cli) — installs/refreshes/removes the harness
 *                                   artifacts in the target repo.
 *
 * stdout is reserved for the MCP JSON-RPC transport — all human-facing output
 * here goes to stderr so it never corrupts the protocol stream.
 *
 * @author andreas@siglochconsulting
 */
import { serveStdio } from './mcp-server.js';
import { serveHost } from './viewer/host.js';
import { StoreOwnershipError } from './store-lock.js';
import { scaffold, syncSkills, type CliCommand } from './scaffold.js';
import { executeRun, parseExecutorEnv } from './run-verb.js';

const USAGE = `graphcode — governed graph substrate (MCP-stdio)

Usage:
  graphcode mcp     Start the MCP-stdio server (bind from .mcp.json)
  graphcode host    Start the read-only HOST + SSE bridge (live viewer)
  graphcode run "<intent>"  Author the graph via the embedded executor (no
                    foreign harness). Env: GRAPHCODE_LLM_BASE_URL +
                    GRAPHCODE_LLM_MODEL (required), GRAPHCODE_LLM_BACKEND=
                    openai|anthropic, GRAPHCODE_LLM_API_KEY
  graphcode init        Scaffold the harness into the current repo
  graphcode update      Refresh installed artifacts (preserves the store)
  graphcode remove      Remove all scaffolded artifacts (restlos)
  graphcode skills sync Re-copy shipped se-* skills, overwrite on version mismatch
`;

async function main(): Promise<void> {
  const command = process.argv[2];
  switch (command) {
    case 'mcp':
      await serveStdio({ repoRoot: process.cwd() });
      return;
    case 'host': {
      // Bind the read-only bridge and keep the process alive; the host owns the
      // single Kuzu store until the process is signalled to exit (CR-GC-114).
      const portArg = Number(process.env.GRAPHCODE_HOST_PORT ?? 0);
      try {
        const bridge = await serveHost({ repoRoot: process.cwd(), port: Number.isFinite(portArg) ? portArg : 0 });
        const shutdown = (): void => {
          void bridge.stop().finally(() => process.exit(0));
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        return; // event loop kept alive by the listening server
      } catch (err) {
        if (!(err instanceof StoreOwnershipError)) throw err;
        // Not an error state (CR-GC-237): the elected host serves the bridge
        // itself when GRAPHCODE_HOST_PORT is set (scaffolded into .mcp.json).
        const hint = Number.isFinite(portArg) && portArg > 0
          ? `check http://127.0.0.1:${portArg}/health`
          : 'set GRAPHCODE_HOST_PORT in .mcp.json env (npx @sigloch/graphcode update scaffolds it)';
        process.stderr.write(
          `graphcode host: store already owned by pid ${err.owner.pid} — the elected host serves the read-only bridge itself; ${hint}\n`,
        );
        process.exit(0);
      }
    }
    case 'run': {
      // Embedded executor (CR-GC-279): same store election as `graphcode mcp`;
      // stdout stays reserved for MCP transports — every report goes to stderr.
      const intent = process.argv[3];
      try {
        const summary = await executeRun({
          repoRoot: process.cwd(),
          intent,
          config: parseExecutorEnv(process.env),
          trace: (line) => process.stderr.write(line + '\n'),
        });
        process.stderr.write(
          `graphcode run: ${JSON.stringify({ ...summary.stats, export: summary.exportPath }, null, 2)}\n`,
        );
        process.exit(0);
      } catch (err) {
        if (err instanceof StoreOwnershipError) {
          process.stderr.write(
            `graphcode run: store already owned by pid ${err.owner.pid} — ` +
              'stop the running MCP host (or the other run) first.\n',
          );
          process.exit(1);
        }
        throw err;
      }
    }
    case 'init':
    case 'update':
    case 'remove': {
      const result = await scaffold(command as CliCommand, { repoRoot: process.cwd() });
      // stdout stays reserved for the MCP transport — report on stderr.
      process.stderr.write(`graphcode ${command}: ${JSON.stringify(result, null, 2)}\n`);
      process.exit(0);
    }
    case 'skills': {
      // `graphcode skills sync` — re-copy the shipped se-* skills, overwriting only on a
      // version mismatch (CR-GC-208 anti-drift). The only sub-verb today is `sync`.
      const sub = process.argv[3];
      if (sub !== 'sync') {
        process.stderr.write(`graphcode skills: unknown subcommand "${sub ?? ''}"\n\n${USAGE}`);
        process.exit(1);
      }
      const result = syncSkills(process.cwd());
      // stdout stays reserved for the MCP transport — report on stderr.
      process.stderr.write(`graphcode skills sync: ${JSON.stringify(result, null, 2)}\n`);
      process.exit(0);
    }
    case undefined:
    case '-h':
    case '--help':
      process.stderr.write(USAGE);
      process.exit(0);
    default:
      process.stderr.write(`graphcode: unknown command "${command}"\n\n${USAGE}`);
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`graphcode: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
