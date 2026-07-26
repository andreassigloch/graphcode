// The milestone's acceptance check — what an agent runs to confirm FN-slice is done.
// Mirrors TEST-recall / TEST-determinism / TEST-provenance from the graph. No npm install
// needed: `node --experimental-strip-types scripts/verify.ts` (or `npm run verify`).
import { slice } from '../src/slice.ts';
import { scoreRecall } from '../spikes/score.ts';

const docs = [{ id: 'd1', page: 1, text: 'Alpha is here. Beta follows. Gamma ends.' }];
const out = slice(docs);
const out2 = slice(docs);
const truth = ['Alpha is here.', 'Beta follows.', 'Gamma ends.'];

const recall = scoreRecall(out.candidates.map((c) => c.text), truth);
const deterministic = JSON.stringify(out) === JSON.stringify(out2);
const sourceRefOk = out.candidates.length > 0 && out.candidates.every(
  (c) => c.sourceRef && c.sourceRef.doc && typeof c.sourceRef.page === 'number' && !!c.sourceRef.region,
);

const pass = recall >= 0.85 && deterministic && sourceRefOk;
console.log(`TEST-recall:      recall=${recall} ${recall >= 0.85 ? 'PASS' : 'FAIL'}`);
console.log(`TEST-determinism: Jaccard=1.0 ${deterministic ? 'PASS' : 'FAIL'}`);
console.log(`TEST-provenance:  sourceRef ${sourceRefOk ? 'PASS' : 'FAIL'}`);
console.log(`\n${pass ? 'ALL PASS' : 'FAIL'} (${out.candidates.length} candidates)`);
process.exit(pass ? 0 : 1);
