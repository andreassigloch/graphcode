/**
 * Graph↔code conformance (CR-GC-206) — resolve each FUNC's `codeRef` binding to a
 * REAL declared symbol in its file, via the TypeScript compiler's own parser
 * (LSP-grade resolution, not a substring match). This is the consumer-side check
 * R-20 (contracts, presence-only) deliberately leaves out: R-20 guards that a
 * non-concept/non-external FUNC HAS a codeRef; this guards that the codeRef
 * actually POINTS at something real.
 *
 *   - concept/external : skipped (no local code artifact to resolve).
 *   - lang === 'prompt': prompt-realized FUNC (a .claude/skills/*.md) → file-exists only.
 *   - code (default)   : ts.createSourceFile → collect declared names (functions,
 *                        classes, methods, const, properties, interfaces, types,
 *                        enums, accessors); the codeRef.symbol must be among them.
 *
 * Out of scope (documented follow-up): cross-module-call coverage — that every
 * symbol called across a module boundary is itself a FUNC node. That needs a full
 * call graph; this resolves the existing bindings.
 *
 * Module is TEST/CLI-only (imports `typescript`, a devDep) — never reached from the
 * runtime entry points, so it stays out of the published bundle.
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { CodeRefSchema } from '@sigloch/contracts/se';
import type { Graph } from '@sigloch/graph-api-core';

export interface ConformanceViolation {
  id: string;
  reason: string;
  file?: string;
  symbol?: string;
}

export interface ConformanceReport {
  checkedFuncs: number;
  /** code codeRefs whose symbol resolved to a real declaration */
  resolved: number;
  /** prompt codeRefs whose skill file exists */
  promptResolved: number;
  /** concept + external FUNCs (no local artifact to resolve) */
  skipped: number;
  violations: ConformanceViolation[];
}

/** Every declared symbol name in a TS source — the compiler's own parser. */
function declaredSymbols(source: string, fileName: string): Set<string> {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const names = new Set<string>();
  const add = (n: ts.Node | undefined): void => {
    if (n && ts.isIdentifier(n)) names.add(n.text);
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isPropertyDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    ) {
      add(node.name);
    }
    if (ts.isVariableDeclaration(node)) add(node.name);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return names;
}

/**
 * Resolve every FUNC codeRef in `graph` against the real source tree under
 * `repoRoot`. Pure (filesystem reads only); returns a report — the caller decides
 * to gate/log. `violations` empty == graph↔code conformant.
 */
export function checkCodeConformance(graph: Graph, repoRoot: string): ConformanceReport {
  const violations: ConformanceViolation[] = [];
  const cache = new Map<string, Set<string>>();
  let resolved = 0;
  let promptResolved = 0;
  let skipped = 0;
  let checkedFuncs = 0;

  for (const node of graph.nodes) {
    if (node.type !== 'FUNC') continue;
    checkedFuncs += 1;
    const attrs = node.attributes ?? {};
    if (attrs.concept === true || attrs.external === true) {
      skipped += 1;
      continue;
    }

    const parsed = CodeRefSchema.safeParse(attrs.codeRef);
    if (!parsed.success) {
      // R-20 already warns on this; conformance records it so the report is self-contained.
      violations.push({ id: node.uid, reason: 'no valid codeRef (R-20)' });
      continue;
    }
    const ref = parsed.data;
    const abs = join(repoRoot, ref.file);
    if (!existsSync(abs)) {
      violations.push({ id: node.uid, reason: 'codeRef.file missing on disk', file: ref.file, symbol: ref.symbol });
      continue;
    }
    if (ref.lang === 'prompt') {
      promptResolved += 1; // prompt-realized: an existing skill file IS the binding
      continue;
    }

    let syms = cache.get(abs);
    if (!syms) {
      syms = declaredSymbols(readFileSync(abs, 'utf8'), abs);
      cache.set(abs, syms);
    }
    if (!syms.has(ref.symbol)) {
      violations.push({ id: node.uid, reason: 'codeRef.symbol not declared in file', file: ref.file, symbol: ref.symbol });
      continue;
    }
    resolved += 1;
  }

  return { checkedFuncs, resolved, promptResolved, skipped, violations };
}
