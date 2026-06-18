#!/usr/bin/env node
/**
 * cli.ts — the `graphcode` binary (MOD-cli).
 *
 * CR-GC-111 ships one verb: `graphcode mcp` boots the MCP-stdio server so an
 * agent host (Claude Code, OpenCode, …) can launch it from `.mcp.json`.
 * `graphcode init|update|remove` (new-member scaffold) land in CR-GC-112.
 *
 * stdout is reserved for the MCP JSON-RPC transport — all human-facing output
 * here goes to stderr so it never corrupts the protocol stream.
 *
 * @author andreas@siglochconsulting
 */
import { serveStdio } from './mcp-server.js';

const USAGE = `graphcode — governed graph substrate (MCP-stdio)

Usage:
  graphcode mcp     Start the MCP-stdio server (bind from .mcp.json)
`;

async function main(): Promise<void> {
  const command = process.argv[2];
  switch (command) {
    case 'mcp':
      await serveStdio({ repoRoot: process.cwd() });
      return;
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
