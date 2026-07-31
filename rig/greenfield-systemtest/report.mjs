// Turn results into a communicable report: every raw run shown (never just a mean),
// per-arm RANGES not std-dev (n is small → a range, not significance), an explicit
// limits block, and the module-reuse AUDIT (a list a human judges, not a score —
// exact-name matching proved too brittle, see README).
//
// Reads results.json + results-opus.json (arms may run separately). @author andreas@siglochconsulting
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const rows = [];
// all result files: results.json (qwen) + results-opus*.json (opus, possibly parallel ranges)
const files = readdirSync(HERE).filter((f) => /^results(-.*)?\.json$/.test(f));
for (const f of files) {
  try { rows.push(...JSON.parse(readFileSync(join(HERE, f), 'utf8'))); } catch { /* skip */ }
}
// de-dupe by arm+run (a range file may overlap); keep the last seen
const seen = new Map();
for (const r of rows) seen.set(`${r.arm}#${r.run}`, r);
rows.length = 0; rows.push(...seen.values());
if (!rows.length) { console.error('no results*.json found'); process.exit(1); }

const range = (xs) => {
  const v = xs.filter((x) => x != null && !Number.isNaN(x));
  return v.length ? (Math.min(...v) === Math.max(...v) ? `${v[0]}` : `${Math.min(...v)}–${Math.max(...v)}`) : 'n/a';
};
const arms = [...new Set(rows.map((r) => r.arm))];

console.log('# Greenfield System Test — Phase 1 (graph authoring)\n');

console.log('## Raw runs (all shown — no averaging)\n');
for (const r of rows) {
  if (r.error) { console.log(`  ${r.arm} #${r.run}: ERROR ${r.error.slice(0, 120)}`); continue; }
  if (!r.structure) { console.log(`  ${r.arm} #${r.run}: (incomplete row — re-run)`); continue; }
  const u = r.tokens ?? {};
  console.log(
    `  ${r.arm} #${r.run}: el=${r.elements} (UC${r.structure.UC}/FN${r.structure.FUNC}/MOD${r.structure.MOD}`
    + `/REQ${r.structure.REQ}/TEST${r.structure.TEST}) compliance=${r.readiness.compliance} `
    + `gates=${r.readiness.gatesPassed} rejections=${r.gate_rejections} `
    + `tok=${u.tokens_in ?? '?'}/${u.tokens_out ?? '?'} $${(u.cost_usd ?? 0).toFixed ? (u.cost_usd).toFixed(2) : u.cost_usd} ${u.wall_s ?? '?'}s`);
}

console.log('\n## Per-arm ranges (range, not std-dev)\n');
console.log('| arm | runs | elements | compliance | gate-rejections | tok out | cost $ | wall s |');
console.log('|---|---|---|---|---|---|---|---|');
for (const a of arms) {
  const g = rows.filter((r) => r.arm === a && !r.error);
  if (!g.length) { console.log(`| ${a} | 0 (all errored) | — | — | — | — | — | — |`); continue; }
  const col = (f) => range(g.map(f));
  console.log(`| ${a} | ${g.length} | ${col((r) => r.elements)} | ${col((r) => r.readiness.compliance)} `
    + `| ${col((r) => r.gate_rejections)} | ${col((r) => r.tokens?.tokens_out)} `
    + `| ${range(g.map((r)=>r.tokens?.cost_usd!=null?+r.tokens.cost_usd.toFixed(2):null))} | ${col((r) => r.tokens?.wall_s)} |`);
}

console.log('\n## Module reuse — AUDIT BY HAND (not a score)\n');
console.log('Did the authored architecture leverage the real sigloch-modules? Exact-name matching');
console.log('is too brittle (paraphrases → false 0); judge overlap by eye.\n');
for (const r of rows.filter((x) => !x.error && x.moduleAudit)) {
  console.log(`- **${r.arm} #${r.run}** authored MODs: ${r.moduleAudit.MOD.authored.join(', ')}`);
}
const gold = rows.find((r) => r.moduleAudit)?.moduleAudit?.MOD?.golden ?? [];
if (gold.length) console.log(`- **golden MODs**: ${gold.join(', ')}`);

console.log('\n## Limits (quote these with the numbers)\n');
console.log([
  '- One machine, one prompt, one domain — every number is conditional on that.',
  '- Two specific models/executors (qwen3.6-35b-a3b via opencode vs Opus 5 via Claude Code), NOT "local vs frontier" as categories — the executor differs too.',
  `- n = ${range(arms.map((a) => rows.filter((r) => r.arm === a && !r.error).length))} per arm → a range, never a confidence interval.`,
  '- compliance / gate-rejections are computed by graphcode rules — no AI judge in the scorer.',
  '- Module reuse is a hand-audited list, not a metric — name-matching could not measure semantic convergence.',
  '- The best-fit pick for Phase 2 is a human judgment, NOT part of any local-vs-frontier verdict.',
].join('\n'));
