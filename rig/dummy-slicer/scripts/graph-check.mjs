// Read-only: open the PERSISTED rig store and report whether FN-slice was realized in the graph.
import { createHarness } from '../../../dist/index.js';
import { bindToolsToHarness } from '../../../dist/mcp-tools.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RIG = join(dirname(fileURLToPath(import.meta.url)), '..');
const harness = await createHarness({ repoRoot: RIG, scope: { workspaceId: 'dummy-slicer', systemId: 'dummy-slicer' } });
await harness.initialize();

const fn = harness.getGraph().nodes.find((n) => n.uid === 'FN-slice');
const reg = bindToolsToHarness(harness);
const ctx = await reg['graph_context'].handler({ id: 'FN-slice', depth: 1 });
const rd = await reg['graph_readiness'].handler({});

console.log('=== rig graph state after the run ===');
console.log('FN-slice.attributes.codeRef :', JSON.stringify(fn?.attributes?.codeRef ?? null));
console.log('FN-slice.attributes.status  :', JSON.stringify(fn?.attributes?.status ?? null));
console.log('graph_context missingRefs   :', JSON.stringify(ctx.missingRefs));
console.log('GRAPH UPDATED PROPERLY      :', (fn?.attributes?.codeRef && !ctx.missingRefs.includes('FN-slice')) ? 'YES' : 'NO');
console.log('readiness                   :', JSON.stringify(rd).slice(0, 200));
await harness.close();
