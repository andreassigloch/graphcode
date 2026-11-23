/**
 * verlauf-repo.ts — der Verlauf an einem Repo: echtes Git, Zwischenspeicher im Store-Verzeichnis (CR-GC-946).
 *
 * `verlaufAmRepo` ist der Weg des Hosts (`graph_readiness({verlauf})`), `verlaufFuerRepo` der Weg der
 * Skripte (`retro-kpi --verlauf`) — beide rufen dieselbe Rechnung `rechneVerlauf`.
 *
 * @author andreas@siglochconsulting
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { MetricPolicySchema } from '@sigloch/contracts/se';
import { loadGraphcodeConfig } from '../kernel/config.js';
import { PlattenCache } from './verlauf-cache.js';
import { rechneVerlauf, verlaufPraefix, type Verlauf, type VerlaufCache } from './verlauf.js';

/** Der Auftrag des Hosts an die Verlaufsrechnung (SCHEMA-verlauf-request, CR-GC-1018). */
export const VerlaufAmRepoEingabeSchema = z.strictObject({
  repoRoot: z.string().min(1),
  /** `harness.getStoreDir()` — nicht fest `.graphcode`. `null` = kein Zwischenspeicher auf Platte. */
  storeDir: z.string().min(1).nullable(),
  policy: MetricPolicySchema,
  policySource: z.string().min(1),
  /** Zahl der juengsten Staende; `null` = alle. */
  window: z.number().int().min(1).nullable(),
});
export type VerlaufAmRepoEingabe = z.input<typeof VerlaufAmRepoEingabeSchema>;

export function verlaufAmRepo(e: VerlaufAmRepoEingabe): Verlauf {
  const platte = e.storeDir ? new PlattenCache(e.storeDir) : null;
  const cache: VerlaufCache = platte ?? { get: () => undefined, set: () => undefined };
  const v = rechneVerlauf({
    git: (args) =>
      execFileSync('git', ['-C', e.repoRoot, ...args], {
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    policy: e.policy,
    policySource: e.policySource,
    window: e.window,
    cache,
  });
  if (platte && v.measured > 0) platte.speichere(verlaufPraefix(e.policy, e.policySource));
  return v;
}

/** Der Verlauf eines Repos ohne Host: Policy aus `graphcode.config.jsonc`, Zwischenspeicher nur, wo `.graphcode/` schon liegt. */
export function verlaufFuerRepo(repoRoot: string, window: number | null = null): Verlauf {
  const { config, source } = loadGraphcodeConfig(repoRoot);
  const storeDir = join(repoRoot, '.graphcode');
  return verlaufAmRepo({ repoRoot, storeDir: existsSync(storeDir) ? storeDir : null, policy: config.metricPolicy, policySource: source, window });
}
