/**
 * TEST-shared-views-no-fork (CR-GC-110) — graphcode does NOT fork the SE rule
 * base or the view/ontology computation. It imports the shared family surface
 * (@sigloch/contracts/se via @sigloch/graph-api-core's SE_DESCRIPTOR) and never
 * carries a local BQ-rule fork (the retired aimprove path).
 *
 * Static source scan, no mocks. Proves the "shared-views-no-fork" invariant for
 * graphcode's own tree: the rule engine + ontology are sourced from the family
 * package, and no source file imports a forked rules/view-computation module.
 * (The sibling-repo migration of aimprove's own fork is tracked outside graphcode.)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');

function srcFiles(): string[] {
  return readdirSync(SRC).filter((f) => f.endsWith('.ts'));
}

/** Import specifiers (the module path in `from '...'`) per source file. */
function importsOf(file: string): string[] {
  const text = readFileSync(join(SRC, file), 'utf8');
  const specs: string[] = [];
  const re = /\bfrom\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) specs.push(m[1]);
  return specs;
}

describe('TEST-shared-views-no-fork: graphcode imports the shared rule base, no local fork', () => {
  // A forked rule base / view computation would import one of these. The retired
  // aimprove path lived at aimpro/src/contracts/se/view-rules + learning-engine/graph/views.
  const FORBIDDEN = [
    /view-rules/,
    /learning-engine[/\\]graph[/\\]views/,
    /[./]+contracts[/\\]se[/\\]rules/, // a relative *copy* of the contracts rules (a fork)
    /aimpro[/\\]src/,
  ];

  it('no source file imports a forked rules / view-computation module', () => {
    const offenders: string[] = [];
    for (const f of srcFiles()) {
      for (const spec of importsOf(f)) {
        if (FORBIDDEN.some((re) => re.test(spec))) offenders.push(`${f}: ${spec}`);
      }
    }
    expect(offenders, `forked imports found:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('the rule engine + ontology are sourced from the family package, not redefined locally', () => {
    // harness.ts is the single rule-evaluation owner; it must pull the shared engine.
    const harness = readFileSync(join(SRC, 'harness.ts'), 'utf8');
    expect(harness).toMatch(/SE_DESCRIPTOR/);
    expect(harness).toMatch(/from\s+['"]@sigloch\/graph-api-core['"]/);
    // No local definition of the V3 rule set (a fork would declare its own).
    const localRuleDef = srcFiles().some((f) =>
      /\b(const|let|var)\s+V3_RULES\b/.test(readFileSync(join(SRC, f), 'utf8')),
    );
    expect(localRuleDef, 'a source file defines its own V3_RULES — that is a fork').toBe(false);
  });

  it('every contracts/ontology import resolves to an @sigloch family package', () => {
    // Any import that mentions rules/ontology/descriptor must come from @sigloch/*.
    const bad: string[] = [];
    for (const f of srcFiles()) {
      for (const spec of importsOf(f)) {
        const mentionsRuleSurface = /(rules?|ontology|descriptor|v3_rules|se)\b/i.test(spec);
        const isRelative = spec.startsWith('.');
        const isFamily = spec.startsWith('@sigloch/');
        if (mentionsRuleSurface && isRelative && !isFamily) {
          // a relative import that looks like a rule/ontology module = a candidate fork
          if (/rules|view-rules|ontology|descriptor/i.test(spec)) bad.push(`${f}: ${spec}`);
        }
      }
    }
    expect(bad, `suspicious relative rule/ontology imports:\n${bad.join('\n')}`).toEqual([]);
  });
});
