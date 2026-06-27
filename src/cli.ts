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
import { scaffold, type CliCommand } from './scaffold.js';

const USAGE = `graphcode — governed graph substrate (MCP-stdio)

Usage:
  graphcode mcp     Start the MCP-stdio server (bind from .mcp.json)
  graphcode host    Start the read-only HOST + SSE bridge (live viewer)
  graphcode init    Scaffold the harness into the current repo
  graphcode update  Refresh installed artifacts (preserves the store)
  graphcode remove  Remove all scaffolded artifacts (restlos)
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
      const bridge = await serveHost({ repoRoot: process.cwd(), port: Number.isFinite(portArg) ? portArg : 0 });
      const shutdown = (): void => {
        void bridge.stop().finally(() => process.exit(0));
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      return; // event loop kept alive by the listening server
    }
    case 'init':
    case 'update':
    case 'remove': {
      const result = await scaffold(command as CliCommand, { repoRoot: process.cwd() });
      // stdout stays reserved for the MCP transport — report on stderr.
      process.stderr.write(`graphcode ${command}: ${JSON.stringify(result, null, 2)}\n`);
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
