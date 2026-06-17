#!/usr/bin/env node
import { StdioServer } from '@modelcontextprotocol/sdk/server/stdio.js'
const GRAPH_API = process.env.GRAPH_API || 'http://localhost:3001'
async function waitForGraphServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${GRAPH_API}/api/health`, { signal: AbortSignal.timeout(1000) })
      if (response.ok) {
        const data = await response.json()
        console.error(`[MCP] Graph server ready (${data.graphElements} elements)`)
        return true
      }
    } catch { }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Graph server not available at ${GRAPH_API}`)
}
const tools = [
  { name: 'graph_health', description: 'Check graph server health', inputSchema: { type: 'object', properties: {} } },
  { name: 'graph_nodes', description: 'Get all graph nodes', inputSchema: { type: 'object', properties: { type: { type: 'string' } } } },
  { name: 'graph_stats', description: 'Get graph statistics', inputSchema: { type: 'object', properties: {} } },
  { name: 'graph_violations', description: 'Check violations', inputSchema: { type: 'object', properties: { severity: { type: 'string' } } } },
  { name: 'graph_apply', description: 'Apply mutations', inputSchema: { type: 'object', properties: { formatE: { type: 'string' } }, required: ['formatE'] } }
]
async function handleToolCall(toolName, toolInput) {
  try {
    switch (toolName) {
      case 'graph_health': return { type: 'text', text: JSON.stringify(await fetch(`${GRAPH_API}/api/health`).then(r => r.json()), null, 2) }
      case 'graph_nodes': {
        const data = await fetch(`${GRAPH_API}/api/graph/nodes`).then(r => r.json())
        return { type: 'text', text: JSON.stringify({ count: data.nodes?.length || 0, nodes: data.nodes?.slice(0, 50) }, null, 2) }
      }
      case 'graph_stats': return { type: 'text', text: JSON.stringify(await fetch(`${GRAPH_API}/api/graph/stats`).then(r => r.json()), null, 2) }
      case 'graph_violations': return { type: 'text', text: JSON.stringify(await fetch(`${GRAPH_API}/api/graph/violations`).then(r => r.json()), null, 2) }
      case 'graph_apply': {
        const response = await fetch(`${GRAPH_API}/api/graph/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ formatE: toolInput.formatE }) })
        return response.ok ? { type: 'text', text: JSON.stringify(await response.json(), null, 2) } : { type: 'error', text: `Failed: ${response.status}` }
      }
      default: return { type: 'error', text: `Unknown tool: ${toolName}` }
    }
  } catch (error) {
    return { type: 'error', text: `Error: ${error instanceof Error ? error.message : String(error)}` }
  }
}
async function main() {
  await waitForGraphServer()
  const server = new StdioServer({ name: 'graph-server', version: '1.0.0' })
  server.setRequestHandler('tools/list', async () => ({ tools }))
  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params
    const result = await handleToolCall(name, args || {})
    return { content: [result] }
  })
  await server.connect(process.stdin, process.stdout)
  console.error('[MCP] Connected')
}
main().catch((err) => { console.error('[MCP] Error:', err); process.exit(1) })
