// Arm B — enforcement mechanism (deterministic, no LLM).
// (1) graph_context FN-slice serves the definition-of-done from the rig graph.
// (2) the CR-GC-214 hook DENIES Read of the stale INPUT-ONLY SPEC.md and ALLOWS Read of src/.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../../../dist/harness.js';
import { bindToolsToHarness } from '../../../dist/mcp-tools.js';

const RIG = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'rig-armB-'));
const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
const harness = new GraphCodeHarness(
  { repoRoot: RIG, scope: { workspaceId: 'rig', systemId: 'dummy-slicer' }, consumerType: 'system', preCommitTimeout: 5000 },
  storage,
);
await harness.initialize();
await harness.seedFromJson('model/dummy-slicer.graph.json');
const reg = bindToolsToHarness(harness);

const ctx = await reg['graph_context'].handler({ id: 'FN-slice', depth: 1 });
console.log('=== Arm B — graph_context FN-slice (the definition-of-done served to the agent) ===');
console.log(`nodes: ${ctx.nodeCount}  edges: ${ctx.edgeCount}  chars: ${ctx.formatE.length} (~${Math.round(ctx.formatE.length / 4)} tok)`);
console.log('missingRefs:', JSON.stringify(ctx.missingRefs));
console.log(ctx.formatE);
writeFileSync(join(RIG, '.armB-bundle.txt'), ctx.formatE);

const HOOK = join(RIG, '.claude', 'hooks', 'deny-stale-prose-read.sh');
function hook(file) {
  const r = spawnSync('bash', [HOOK], { input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: file } }), encoding: 'utf8' });
  return r.status;
}
const spec = join(RIG, 'docs', 'SPEC.md');
const src = join(RIG, 'src', 'slice.ts');
const specStatus = hook(spec);
const srcStatus = hook(src);
console.log('\n=== Arm B — CR-GC-214 read enforcement ===');
console.log(`Read docs/SPEC.md (INPUT-ONLY, wrong values)  -> exit ${specStatus}  ${specStatus === 2 ? 'BLOCKED ✓' : 'NOT blocked ✗'}`);
console.log(`Read src/slice.ts (live source)               -> exit ${srcStatus}  ${srcStatus === 0 ? 'ALLOWED ✓' : 'blocked ✗'}`);

const pass = ctx.nodeCount >= 7 && ctx.missingRefs.includes('FN-slice') && specStatus === 2 && srcStatus === 0;
console.log(`\nARM B VERDICT: ${pass ? 'PASS' : 'FAIL'} — bundle serves DoD, stale SPEC blocked, source allowed.`);

await harness.close();
rmSync(tmp, { recursive: true, force: true });
process.exit(pass ? 0 : 1);
