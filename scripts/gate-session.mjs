#!/usr/bin/env node
/**
 * gate-session.mjs — one-shot gated graph operation for a session WITHOUT a live
 * MCP server: boots the harness on THIS repo's store (O2 lock, stale-reclaim),
 * binds the tool registry (durable audit log, OCC version continuity) and runs
 * the ops passed as a JSON file. Everything goes through the same Apply-Gate +
 * tools an MCP client would use — no parallel write path.
 *
 * Usage: node scripts/gate-session.mjs <ops.json>
 *   ops.json: [{ "tool": "graph_reseed"|"graph_mutate"|"graph_export"|..., "input": {...} }, ...]
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync } from 'node:fs';
import { createHarness } from '../dist/index.js';
import { bindToolsToHarness } from '../dist/mcp-tools.js';

const opsFile = process.argv[2];
if (!opsFile) {
  process.stderr.write('usage: node scripts/gate-session.mjs <ops.json>\n');
  process.exit(1);
}
const ops = JSON.parse(readFileSync(opsFile, 'utf8'));

const repoRoot = process.cwd();
const harness = await createHarness({
  repoRoot,
  scope: { workspaceId: 'graphcode', systemId: 'graphcode' },
  consumerType: 'agent',
  preCommitTimeout: 5000,
});
await harness.initialize();
try {
  const tools = bindToolsToHarness(harness);
  for (const { tool, input } of ops) {
    if (!tools[tool]) throw new Error(`unknown tool: ${tool}`);
    const result = await tools[tool].handler(tools[tool].inputSchema.parse(input ?? {}));
    const summary = JSON.stringify(result);
    console.log(`${tool}: ${summary.length > 600 ? summary.slice(0, 600) + '…' : summary}`);
    if (result && result.success === false) {
      throw new Error(`${tool} rejected: ${JSON.stringify(result.violations)}`);
    }
  }
} finally {
  await harness.close();
}
