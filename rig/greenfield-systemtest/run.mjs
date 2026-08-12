// Greenfield system test — Phase 1 authoring benchmark orchestrator.
//
// For each arm × N runs: fresh empty graphcode workspace, inject the ONE prompt,
// let the model DISCOVER the module capabilities itself (no curated brief — that
// would remove the challenge), author the architecture through the real MCP
// Apply-Gate, then export the graph + readiness and score against the held-out
// golden. Raw per-run rows → results.json; report.mjs makes the table.
//
// Two executors, deliberately (see SPIKE-GC-loop-executor-benchmark: `claude -p`
// @local overflows the heavy harness; opencode's lean harness is the viable local
// path). Local arm = opencode + LM Studio; frontier arm = claude -p + Opus. The
// "opencode vs Claude Code" difference is thus IN the test, not a hidden confound.
//
// @author andreas@siglochconsulting
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMetrics } from './metrics.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GC_ROOT = join(HERE, '..', '..');
const MCP_ARGS = [join(GC_ROOT, 'dist', 'cli.js'), 'mcp']; // local dist, not npx-published

// --- CONFIG (edit before running; no silent fallbacks) --------------------------
const CFG = {
  claudeBin: process.env.CLAUDE_BIN ?? 'claude',
  opencodeBin: process.env.OPENCODE_BIN ?? 'opencode',
  runs: Number(process.env.RUNS ?? 3),
  startRun: Number(process.env.START_RUN ?? 0), // first run index (parallelize by ranges)
  resultsFile: process.env.RESULTS_FILE ?? 'results.json',
  timeoutMs: Number(process.env.RUN_TIMEOUT_S ?? 1200) * 1000, // per-run cap; stuck run fails clean
  golden: process.env.GOLDEN
    ?? '/Users/andreas/Developer/dev/sigloch-modules/docs/graph/sigloch-modules.graph.json',
  // The module repo the model may READ to DISCOVER capabilities itself. Not a
  // pre-digested brief — discovery is the challenge. node_modules excluded via prompt.
  material: process.env.MATERIAL ?? '/Users/andreas/Developer/dev/sigloch-modules',
  lmstudio: process.env.LMSTUDIO ?? 'http://192.168.78.89:1234',
  arms: [
    { label: 'qwen-35b', executor: 'opencode', model: process.env.LOCAL_MODEL ?? 'qwen3.6-35b-a3b-mlx' },
    { label: 'opus5', executor: 'claude', model: process.env.FRONTIER_MODEL ?? 'claude-opus-5' },
  ],
};

function buildPrompt() {
  return readFileSync(join(HERE, 'prompt.txt'), 'utf8').trim()
    + `\n\nSYS-webapp existiert bereits im Graphen (das System aus dem Prompt). Baue die`
    + ` Architektur darauf auf: rufe graph_next_step für den nächsten sinnvollen Schritt,`
    + ` autoriere über graph_mutate, und frage graph_authoring_guide nach den legalen Kanten`
    + ` je Typ, bevor du einen Knoten anlegst.`
    + `\nDas sigloch-module-Quellrepo liegt im Workspace unter ./material — entdecke die`
    + ` Fähigkeiten selbst aus dem Quellcode, es gibt keinen fertigen Überblick. Nur der Graph zählt, kein Code.`;
}

// graphcode enforces single-writer via .graphcode/owner.lock. Our orchestrator opens
// the store to seed, then hands off to the executor's MCP server — but the lock file
// outlives our in-process harness.close() while run.mjs stays alive, so the executor
// sees the store as "owned" and fast-exits. We drive the store strictly sequentially
// (seed → executor → capture, never concurrent), so releasing the lock between steps
// is safe and is exactly what the StoreOwnershipError message advises.
function releaseStore(dir) {
  for (const f of ['owner.lock', 'host.sock']) rmSync(join(dir, '.graphcode', f), { force: true });
}

function initWorkspace(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // graphcode init scaffolds .mcp.json + opencode.json into cwd → run INSIDE workspace.
  execFileSync('node', [join(GC_ROOT, 'dist', 'cli.js'), 'init'], { cwd: dir, stdio: 'pipe' });
  // Copy the module SOURCE into the workspace so the executor's sandbox may read it
  // (opencode blocks external-dir reads even with --dangerously-skip-permissions).
  // Exclude noise (node_modules/dist/.git) AND the golden graph (docs/graph) — the
  // golden must never be visible to the model, only used for scoring.
  // Exclude .graphcode too: it holds the LIVE Kuzu store (~100M) which both drowns
  // the executor's file index AND leaks the golden graph data.
  execFileSync('rsync', ['-a', '--exclude', 'node_modules', '--exclude', 'dist',
    '--exclude', '.git', '--exclude', 'docs/graph', '--exclude', '.graphcode',
    `${CFG.material}/`, join(dir, 'material') + '/'],
    { stdio: 'pipe' });
}

// Claude Code path (frontier): .mcp.json → repoint at local dist; claude -p JSON out.
function authorViaClaude(dir, arm) {
  const mcpPath = join(dir, '.mcp.json');
  const mcp = JSON.parse(readFileSync(mcpPath, 'utf8'));
  mcp.mcpServers.graphcode.command = 'node';
  mcp.mcpServers.graphcode.args = MCP_ARGS;
  writeFileSync(mcpPath, JSON.stringify(mcp, null, 2));
  const baseEnv = { ...process.env };
  delete baseEnv.ANTHROPIC_BASE_URL; delete baseEnv.ANTHROPIC_AUTH_TOKEN; // frontier = native
  const t0 = Date.now();
  const r = spawnSync(
    CFG.claudeBin,
    // acceptEdits does NOT grant MCP tool calls → graphcode tools get denied; skip all
    // permissions (throwaway sandbox), symmetric with opencode's --dangerously-skip-permissions.
    ['-p', buildPrompt(), '--output-format', 'json', '--model', arm.model, '--dangerously-skip-permissions'],
    { cwd: dir, env: baseEnv, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, timeout: CFG.timeoutMs },
  );
  const wall_s = +((Date.now() - t0) / 1000).toFixed(1);
  const out = r.stdout ?? '';
  writeFileSync(join(dir, 'claude-raw.json'), out);
  if (r.stderr) writeFileSync(join(dir, 'claude-stderr.log'), r.stderr);
  if (r.status !== 0) throw new Error(`claude exit=${r.status} signal=${r.signal}; stderr: ${(r.stderr ?? '').slice(-600)}`);
  let usage = { wall_s };
  try {
    const j = JSON.parse(out);
    usage = {
      wall_s, cost_usd: j.total_cost_usd ?? 0,
      tokens_in: j.usage?.input_tokens ?? null,
      tokens_out: j.usage?.output_tokens ?? null,
      tokens_reasoning: j.usage?.output_tokens_details?.reasoning_tokens ?? null,
    };
  } catch { /* raw saved */ }
  return usage;
}

// opencode path (local, lean harness): write opencode.json (lmstudio + graphcode MCP),
// then `opencode run --format json`. Usage shape is captured raw and parsed defensively.
function authorViaOpencode(dir, arm) {
  const cfg = {
    $schema: 'https://opencode.ai/config.json',
    provider: {
      lmstudio: {
        npm: '@ai-sdk/openai-compatible',
        name: 'LM Studio (local)',
        options: { baseURL: `${CFG.lmstudio}/v1` },
        models: { [arm.model]: { name: arm.model } },
      },
    },
    mcp: { graphcode: { type: 'local', command: ['node', ...MCP_ARGS], enabled: true } },
    permission: { edit: 'allow', bash: 'allow', webfetch: 'deny' },
    model: `lmstudio/${arm.model}`,
  };
  writeFileSync(join(dir, 'opencode.json'), JSON.stringify(cfg, null, 2));
  const t0 = Date.now();
  const r = spawnSync(
    CFG.opencodeBin,
    ['run', buildPrompt(), '-m', `lmstudio/${arm.model}`, '--format', 'json', '--dangerously-skip-permissions'],
    { cwd: dir, env: process.env, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, timeout: CFG.timeoutMs },
  );
  const wall_s = +((Date.now() - t0) / 1000).toFixed(1);
  const out = r.stdout ?? '';
  writeFileSync(join(dir, 'opencode-raw.json'), out);
  if (r.stderr) writeFileSync(join(dir, 'opencode-stderr.log'), r.stderr);
  // opencode may exit non-zero yet still have authored through the gate — don't throw;
  // record the exit and let metrics read whatever landed in the store.
  if (r.status !== 0) writeFileSync(join(dir, 'opencode-exit.txt'), `status=${r.status} signal=${r.signal}`);
  // opencode emits newline-delimited events; sum tokens across all `step-finish`
  // events ({part:{tokens:{input,output,reasoning}, cost}}).
  let tokens_in = 0, tokens_out = 0, tokens_reasoning = 0, cost_usd = 0, seen = false;
  for (const line of out.split('\n')) {
    try {
      const ev = JSON.parse(line);
      const t = ev.part?.tokens;
      if (t) { seen = true; tokens_in += t.input ?? 0; tokens_out += t.output ?? 0; tokens_reasoning += t.reasoning ?? 0; }
      if (ev.part?.cost != null) cost_usd += ev.part.cost;
    } catch { /* not a json line */ }
  }
  return { wall_s, cost_usd, tokens_in: seen ? tokens_in : null,
    tokens_out: seen ? tokens_out : null, tokens_reasoning: seen ? tokens_reasoning : null };
}

// Seed the ONE frame the human decides: the SYS from the prompt. On an empty graph
// next_step returns null (nothing to advise); with a SYS it points at "add use cases",
// giving the model the scaffold small models need. Identical for both arms → fair.
//
// MUST run in a SEPARATE process: createHarness loads Kuzu's native binding, which
// holds an OS-level lock on the store file that h.close() does NOT release while the
// parent process lives — the executor's MCP child would then fail to open the store.
// A subprocess releases every handle on exit, handing the executor a clean store.
const SEED_SCRIPT = `
const dir = process.argv[1];
const label = dir.split('/').pop();
const { createHarness } = await import(${JSON.stringify(join(GC_ROOT, 'dist', 'index.js'))});
const { bindToolsToHarness } = await import(${JSON.stringify(join(GC_ROOT, 'dist', 'mcp-tools.js'))});
const h = await createHarness({ repoRoot: dir, scope: { workspaceId: label, systemId: label } });
await h.initialize();
const reg = bindToolsToHarness(h);
await reg['graph_mutate'].handler({ commands: [{ op: 'add-node', node: {
  uid: 'SYS-webapp', type: 'SYS', name: 'GraphCode Multiuser Web App',
  description: 'Multiuser-faehige Web-App aus dem graphcode harness (System aus dem Prompt).', attributes: {},
} }] });
await h.close();
`;
function seedSystem(dir) {
  execFileSync('node', ['--input-type=module', '-e', SEED_SCRIPT, dir], { stdio: 'pipe' });
}

async function captureArtifacts(dir) {
  const { createHarness } = await import(join(GC_ROOT, 'dist', 'index.js'));
  const { bindToolsToHarness } = await import(join(GC_ROOT, 'dist', 'mcp-tools.js'));
  const label = dir.split('/').pop();
  const h = await createHarness({ repoRoot: dir, scope: { workspaceId: label, systemId: label } });
  await h.initialize();
  const reg = bindToolsToHarness(h);
  // graph_export writes the committable {elements,traces} to graphJson.path (relative
  // to the workspace); it returns metadata, not the graph. Read the written file.
  const exported = await reg['graph_export'].handler({});
  const exportPath = join(dir, exported.graphJson?.path ?? `docs/graph/${label}.graph.json`);
  cpSync(exportPath, join(dir, 'graph.json'));
  const rd = await reg['graph_readiness'].handler({});
  writeFileSync(join(dir, 'readiness.json'), JSON.stringify(rd, null, 2));
  await h.close();
  const audit = join(dir, '.graphcode', 'audit.jsonl');
  if (existsSync(audit)) cpSync(audit, join(dir, 'audit.jsonl'));
}

async function main() {
  const outDir = join(HERE, 'runs');
  mkdirSync(outDir, { recursive: true });
  const only = process.env.ARMS ? new Set(process.env.ARMS.split(',')) : null;
  const arms = only ? CFG.arms.filter((a) => only.has(a.label)) : CFG.arms;
  const results = [];
  for (const arm of arms) {
    for (let i = CFG.startRun; i < CFG.startRun + CFG.runs; i++) {
      const dir = join(outDir, `${arm.label}-${i}`);
      process.stderr.write(`\n[${arm.label}/${arm.executor}] run ${i + 1}/${CFG.runs} — ${arm.model}\n`);
      try {
        initWorkspace(dir);
        seedSystem(dir);       // seed SYS (subprocess) so next_step gives direction
        releaseStore(dir);     // free any lock so the executor's MCP can own the store
        const usage = arm.executor === 'opencode' ? authorViaOpencode(dir, arm) : authorViaClaude(dir, arm);
        releaseStore(dir);     // executor's MCP may leave a lock (esp. on timeout kill)
        writeFileSync(join(dir, 'usage.json'), JSON.stringify(usage, null, 2));
        await captureArtifacts(dir);
        const m = runMetrics({
          graphPath: join(dir, 'graph.json'), readinessPath: join(dir, 'readiness.json'),
          auditPath: join(dir, 'audit.jsonl'), goldenPath: CFG.golden, usage,
        });
        results.push({ arm: arm.label, model: arm.model, executor: arm.executor, run: i, ...m });
        process.stderr.write(
          `  elements=${m.elements} compliance=${m.readiness.compliance ?? '?'} `
          + `gates=${m.readiness.gatesPassed ?? '?'} rejections=${m.gate_rejections} `
          + `tok=${usage.tokens_in}/${usage.tokens_out} $${usage.cost_usd ?? 0} ${usage.wall_s}s\n`,
        );
      } catch (err) {
        // Surface the executor's real stderr (execFileSync buries it on non-zero exit).
        const stderr = (err.stderr ?? '').toString().slice(-1500);
        if (stderr) writeFileSync(join(dir, 'error.log'), (err.stdout ?? '').toString() + '\n---STDERR---\n' + stderr);
        process.stderr.write(`  FAILED: ${err.message}\n${stderr ? '  stderr: ' + stderr.slice(-400) + '\n' : ''}`);
        results.push({ arm: arm.label, model: arm.model, executor: arm.executor, run: i, error: (stderr || err.message).slice(-500) });
      }
      writeFileSync(join(HERE, CFG.resultsFile), JSON.stringify(results, null, 2));
    }
  }
  process.stderr.write(`\nDone. ${results.length} rows → ${CFG.resultsFile}. Run: node report.mjs\n`);
}

main().catch((e) => { process.stderr.write(`fatal: ${e.stack}\n`); process.exit(1); });
