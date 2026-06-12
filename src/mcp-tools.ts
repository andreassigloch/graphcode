/**
 * MCP Tool Suite — Graph Operations via Claude Code
 *
 * Extracted from aimprove-harness MCP exports.
 * Transport: MCP-stdio (Claude Code native)
 *
 * Tool categories:
 * - graph_* — Graph read/write
 * - rules_* — Rule evaluation
 * - audit_* — History/audit-trail
 */

import { z } from 'zod';

/**
 * Tool registry type.
 */
export interface MCPToolRegistry {
  // Graph read
  graph_elements: any; // { name, description, inputSchema, handler }
  graph_get_node: any;
  graph_get_edges: any;

  // Graph write
  graph_mutate: any; // { name, description, inputSchema, handler } → MutateCommand

  // Rules
  rules_evaluate: any;
  rules_get_violations: any;

  // Audit
  audit_trail: any;
  audit_stats: any;
}

/**
 * MCP_TOOLS exported to Claude Code.
 *
 * TODO: Carve out from aimprove harness MCP exports.
 * Each tool = { name, description, inputSchema, handler }
 */
export const MCP_TOOLS: Partial<MCPToolRegistry> = {
  // graph_elements: { ... },
  // graph_mutate: { ... },
  // rules_evaluate: { ... },
  // etc.
};

/**
 * Helper to bind tools to a harness instance.
 */
export function bindToolsToHarness(harness: any): MCPToolRegistry {
  // TODO: Implement tool binding
  // Each tool calls harness.mutate(), harness.loadGraph(), harness.evaluateRules()
  throw new Error('bindToolsToHarness() not yet implemented');
}
