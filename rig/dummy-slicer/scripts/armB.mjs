// Arm B — enforcement mechanism (deterministic, no LLM).
// (1) graph_context FN-slice serves the definition-of-done from the rig graph.
// (2) the CR-GC-214 hook DENIES Read of the stale INPUT-ONLY SPEC.md and ALLOWS Read of src/.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { openMeasured, stampLine } from '../../../dist/index.js';

const RIG = join(dirname(fileURLToPath(import.meta.url)), '..');

// CR-GC-496: die WURZEL bleibt das Rig — von dort kommen `graphcode.config.jsonc` und die
// `realRef`-Aufloesung, an der `missingRefs` haengt. Der STORE liegt im Wegwerf-Verzeichnis
// (REQ-single-kuzu-owner). Bis hierher ging das nur am `createHarness` vorbei, mit dem stillen
// Verlust der Config-Ladung und des policy-gebauten Descriptors (CR-GC-491 §1).
//
// Nebenbefund: die alten Importe zeigten auf `dist/harness.js` und `dist/mcp-tools.js` — beide
// gibt es nach dem dist-Umbau nicht mehr. Dieses Rig war NICHT LAUFFAEHIG, und niemand hat es
// gemerkt: ein Rig ohne Lauf meldet sich nicht, es schweigt.
const measured = await openMeasured({
  graph: join(RIG, 'model', 'dummy-slicer.graph.json'),
  repoRoot: RIG,
  systemId: 'dummy-slicer',
  workspaceId: 'rig',
});
console.log(`[stempel] ${stampLine(measured.provenance)}`);
const harness = measured.harness;
const reg = measured.tools;

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

await measured.close();
process.exit(pass ? 0 : 1);
