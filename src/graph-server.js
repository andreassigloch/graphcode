import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'
import 'dotenv/config'

const app = express()
const PORT = process.env.GRAPH_PORT || 3001
const GRAPH_DATA_DIR = resolve('.aimprove')
const GRAPH_FILE = resolve(GRAPH_DATA_DIR, 'graph.json')

mkdirSync(GRAPH_DATA_DIR, { recursive: true })

app.use(cors())
app.use(express.json({ limit: '50mb' }))

let graphData = { elements: [] }

function loadGraph() {
  try {
    if (existsSync(GRAPH_FILE)) {
      const content = readFileSync(GRAPH_FILE, 'utf-8')
      graphData = JSON.parse(content)
    }
  } catch (err) {
    console.error(`[Graph] Error loading:`, err.message)
  }
}

function saveGraph() {
  try {
    writeFileSync(GRAPH_FILE, JSON.stringify(graphData, null, 2))
  } catch (err) {
    console.error(`[Graph] Error saving:`, err.message)
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    project: process.cwd(),
    graphElements: graphData.elements?.length || 0,
  })
})

app.get('/api/graph/nodes', (req, res) => {
  res.json({
    nodes: graphData.elements || [],
    count: graphData.elements?.length || 0,
  })
})

app.get('/api/graph/violations', (req, res) => {
  res.json([])
})

app.get('/api/graph/capabilities', (req, res) => {
  res.json({
    version: '1.0.0',
    formatE: {
      attributes: ['@rationale', '@reqType', '@kind', '@zodDefinition', '@sourceFile', '@sourceExport'],
      knownAttributes: {
        REQ: ['@rationale', '@reqType', '@kind'],
        SCHEMA: ['@zodDefinition', '@sourceFile', '@sourceExport'],
      },
    },
  })
})

app.post('/api/graph/apply', (req, res) => {
  const { formatE } = req.body
  if (!formatE) {
    res.status(400).json({ error: 'Missing formatE' })
    return
  }
  res.json({ applied: 0, rejected: 0, violations: [] })
})

app.post('/api/graph/reset', (req, res) => {
  graphData = { elements: [] }
  saveGraph()
  res.json({ status: 'reset', elements: 0 })
})

app.get('/api/graph/stats', (req, res) => {
  res.json({
    elements: graphData.elements?.length || 0,
    by_type: graphData.elements?.reduce((acc, el) => {
      acc[el.type] = (acc[el.type] || 0) + 1
      return acc
    }, {}),
  })
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use((err, req, res, next) => {
  console.error('[Graph Server] Error:', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

loadGraph()

const server = app.listen(PORT, () => {
  console.log(`[Graph Server] ✓ Listening on http://localhost:${PORT}`)
  console.log(`[Graph Server] ✓ Data: ${GRAPH_DATA_DIR}`)
})

process.on('SIGINT', () => {
  console.log('\n[Graph Server] Shutting down...')
  saveGraph()
  server.close(() => process.exit(0))
})
