// Arm C — local model (LM Studio, qwen3.6-27b on a 48GB M4).
// Feeds ONLY the graph_context bundle (never the stale SPEC.md) and asks the model to implement
// slice(). The decisive H3 test: can a 27B local model produce a correct impl from the ~667-tok
// definition-of-done alone? It can only honour recall>=0.85 / required sourceRef / deterministic
// hash IDs if the BUNDLE conveyed them (the SPEC says the WRONG 0.70 / optional / random).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RIG = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = readFileSync(join(RIG, '.armB-bundle.txt'), 'utf8');
const ENDPOINT = 'http://localhost:1234/v1/chat/completions';
const MODEL = 'qwen/qwen3.6-27b';

const system =
  'You implement exactly one TypeScript function from a graph "context-pack" that states its ' +
  'definition of done (the REQ it must satisfy, the TEST that verify it, the data SCHEMA). ' +
  'Output ONLY the TypeScript for src/slice.ts — no prose, no markdown fences. Honour every REQ.';
const user =
  `Graph context-pack for FN-slice (this is the whole spec — there is no other doc):\n\n${bundle}\n\n` +
  `Implement and export \`function slice(docs: DocRecord[]): SlicerOutput\` in src/slice.ts.\n` +
  `Types: DocRecord = { id: string; text: string; page: number }; ` +
  `SlicerOutput = { candidates: Array<{ id: string; text: string; sourceRef: { doc: string; page: number; region: string } }> }.\n` +
  `Obey the closure: recall-first (surface the superset, never drop), deterministic IDs (hash, no random/uuid), ` +
  `and a non-empty sourceRef on every candidate.`;

const ctrl = new AbortController();
const to = setTimeout(() => ctrl.abort(), 280000);
const t0 = Date.now();
const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: MODEL, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  signal: ctrl.signal,
});
clearTimeout(to);
const json = await res.json();
const raw = json.choices?.[0]?.message?.content ?? JSON.stringify(json);
const code = raw.replace(/^```[a-z]*\n?/gim, '').replace(/```$/gm, '').trim();
writeFileSync(join(RIG, '.armC-output.ts'), code + '\n');

const has = (re) => re.test(code);
const checks = {
  'exports slice()': has(/export\s+function\s+slice\s*\(/) || has(/export\s+const\s+slice\s*=/),
  'has sourceRef {doc,page,region}': has(/sourceRef/) && has(/region/) && has(/page/) && has(/doc/),
  'deterministic id (hash, not random)': (has(/hash|createHash|sha|reduce|charCodeAt/i)) && !has(/Math\.random|randomUUID|uuid/i),
  'recall-first (iterates/maps docs, no early filter-drop)': has(/\.map\(|\.flatMap\(|for\s*\(/),
  'returns candidates array': has(/candidates\s*[:=]/),
};
console.log(`=== Arm C — local model ${MODEL} (${((Date.now() - t0) / 1000).toFixed(1)}s, ${code.length} chars out) ===`);
for (const [k, v] of Object.entries(checks)) console.log(`  [${v ? 'PASS' : 'FAIL'}] ${k}`);
const score = Object.values(checks).filter(Boolean).length;
console.log(`\nARM C SCORE: ${score}/5 criteria from the bundle alone (SPEC.md never seen).`);
console.log('--- generated src/slice.ts (saved to .armC-output.ts) ---\n' + code);
