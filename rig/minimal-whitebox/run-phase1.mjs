// Phase 1, Arme A0/A/B — deterministisch, kein LLM.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { openFixture, measureJob, OUT } from './measure.mjs';
import { JOBS } from './jobs.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rows = [];
for (const job of JOBS) {
  const fx = await openFixture(join(REPO, job.fixture.graph), job.fixture.systemId);
  const r = await measureJob(fx, job);
  await fx.close();
  const { texts, ...clean } = r;
  rows.push({ ...clean, texts: undefined });
  writeFileSync(join(OUT, `${job.name.split(' ')[0]}-armA.txt`), texts.armA);
  writeFileSync(join(OUT, `${job.name.split(' ')[0]}-armB.txt`), texts.armB);
  writeFileSync(join(OUT, `${job.name.split(' ')[0]}-armA0.txt`), texts.a0);
  writeFileSync(join(OUT, `${job.name.split(' ')[0]}-today.txt`), texts.today);
  writeFileSync(join(OUT, `slice-${job.name.split(' ')[0]}.json`), JSON.stringify(r.artifact, null, 2));
  console.log('\n===', r.job, '===');
  console.log(`G=${r.G}  |B|=${r.blast.nodes} (${r.blast.tokens} tok)  |W|=${r.whitebox.nodes} (${r.whitebox.tokens} tok)  Ring=${r.ring.nodes} (${r.ring.tokens} tok)`);
  console.log(`Arm A ${r.armA_tokens} tok · Arm B ${r.armB_tokens} tok · heute ${r.today_tokens} tok`);
  console.log(`W/B=${r.ratios.W_over_B}  W/G=${r.ratios.W_over_G}`);
  console.log(`W liegt zu ${r.overlap.W_and_B}/${r.whitebox.nodes} in B — ${r.overlap.W_outside_B} Knoten liegen AUSSERHALB des Blast-Radius`);
  console.log(`GT in W: ${r.groundTruth.inWhitebox}/${r.groundTruth.total} · in B: ${r.groundTruth.inBlast}/${r.groundTruth.total} · im heutigen Index: ${r.groundTruth.inTodayIndex}/${r.groundTruth.total}`);
  if (r.groundTruth.missedByBlast.length) console.log(`  B verfehlt: ${r.groundTruth.missedByBlast.join(', ')}`);
  if (r.groundTruth.missedByToday.length) console.log(`  heute verfehlt: ${r.groundTruth.missedByToday.join(', ')}`);
}
writeFileSync(join(OUT, 'phase1.json'), JSON.stringify(rows, null, 2));
console.log('\n→', join(OUT, 'phase1.json'));
