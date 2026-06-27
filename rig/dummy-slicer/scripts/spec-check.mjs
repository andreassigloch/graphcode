// Read-only: did the incremental spec authoring (UC + 2 REQs + TEST + edges) land through the gate?
import { createHarness } from '../../../dist/index.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const RIG = join(dirname(fileURLToPath(import.meta.url)), '..');
const h = await createHarness({ repoRoot: RIG, scope: { workspaceId: 'dummy-slicer', systemId: 'dummy-slicer' } });
await h.initialize();
const g = h.getGraph();
const want = ['UC-export', 'REQ-export-format', 'REQ-export-idempotent', 'TEST-export-format'];
console.log('=== nodes ===');
for (const u of want) { const n = g.nodes.find((x) => x.uid === u); console.log(`${u}: ${n ? n.type + ' ✓' : 'MISSING ✗'}`); }
console.log('=== edges ===');
const E = (s, t, ty) => g.edges.some((e) => e.sourceId === s && e.targetId === t && e.edgeType === ty);
console.log('SYS compose UC-export       :', E('SYS-dummy-slicer','UC-export','compose') ? '✓' : '✗');
console.log('UC compose REQ-format       :', E('UC-export','REQ-export-format','compose') ? '✓' : '✗');
console.log('UC compose REQ-idempotent   :', E('UC-export','REQ-export-idempotent','compose') ? '✓' : '✗');
console.log('TEST verify REQ-format      :', E('TEST-export-format','REQ-export-format','verify') ? '✓' : '✗');
const landed = want.every((u) => g.nodes.find((x) => x.uid === u));
console.log('\nINCREMENT AUTHORED VIA GATE :', landed ? 'YES' : 'NO');
await h.close();
