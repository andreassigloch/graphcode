/**
 * GraphCode — Claude Code Sidecar Harness
 *
 * Exports:
 * - GraphCodeHarness (core)
 * - MCP_TOOLS (transport)
 * - HookSystem (extensibility)
 */

export { GraphCodeHarness } from './harness.js';
export type { HarnessConfig, MutateCommand, MutateResult } from './harness.js';

export { MCP_TOOLS, type MCPToolRegistry } from './mcp-tools.js';

export { HookSystem } from './hooks.js';
export type { Hook, HookType, HookResult } from './hooks.js';

export { GraphCodeCodec } from './codec.js';

// Version (bump with ontology or major harness changes)
export const GRAPHCODE_VERSION = '0.1.0-carve-out';
