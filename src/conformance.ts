/**
 * CodeFacts extractor + conformance-enriched readiness (CR-GC-253, supersedes
 * the CR-GC-206 rule-carrying shape).
 *
 * The RC resolution rules (RC-01 realRef, RC-02 testRef) live in
 * `@sigloch/contracts/se` (conformance-rules.ts) — one rule base per onto set,
 * no rule definitions in executor codebases. This module is graphcode's
 * executor side only:
 *
 *   - `extractCodeFacts` : resolve every file referenced by a realRef/testRef
 *     against `repoRoot` via the TypeScript compiler's own parser (declared
 *     symbols + it/test/describe case names). Deterministic, filesystem-reads
 *     only. Multi-language swap point for CR-GC-254 (ast-grep).
 *   - `conformanceViolations` : run the contracts RC rules over the facts and
 *     map them onto the harness RuleViolation shape.
 *   - `scoreReadinessWithConformance` : the product-facing readiness — V3_RULES
 *     violations (L2 gate) merged with RC violations, so drift shows up in
 *     `violationsByRule`, the CDR/TRR gates and the dashboard.
 *
 * `typescript` is a runtime dependency of this path (moved from devDeps in
 * CR-GC-253): a governance harness that resolves code bindings parses code at
 * runtime by design.
 *
 * Out of scope (documented follow-up, CR-GC-256): cross-module import edges
 * (`importEdges` facts) — undocumented MOD→MOD relationships.
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve as resolvePath } from 'node:path';
import ts from 'typescript';
import {
  RealRefSchema,
  TestRefSchema,
  evaluateConformanceRules,
  type CodeFacts,
  type FileFacts,
  type ImportEdge,
  type OntologyGraph,
} from '@sigloch/contracts/se';
import type { RuleViolation } from '@sigloch/contracts/harness';
import type { Graph } from '@sigloch/graph-api-core';
import { computeReadiness, type ReadinessReport } from './readiness.js';

type CGraph = Pick<Graph, 'nodes' | 'edges'>;

/** Every declared symbol name in a source file — the compiler's own parser. */
function parseFileFacts(source: string, fileName: string): Omit<FileFacts, 'exists'> {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const declaredSymbols = new Set<string>();
  const testCases = new Set<string>();
  const importedSymbols = new Set<string>(); // exported names imported here (CR-211, RC-04)
  const parsedSymbols = new Set<string>(); // X in X.parse(/X.safeParse( (CR-211, RC-04)
  const add = (n: ts.Node | undefined): void => {
    if (n && ts.isIdentifier(n)) declaredSymbols.add(n.text);
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
    // import { X } / { X as Y } / default / * as ns — record the EXPORTED name (X),
    // which is what a SCHEMA's realRef.symbol names (RC-04 usage check).
    if (ts.isImportDeclaration(node) && node.importClause) {
      const clause = node.importClause;
      if (clause.name) importedSymbols.add(clause.name.text); // default import
      if (clause.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) {
          importedSymbols.add(clause.namedBindings.name.text);
        } else {
          for (const spec of clause.namedBindings.elements) {
            importedSymbols.add((spec.propertyName ?? spec.name).text);
          }
        }
      }
    }
    // X.parse( / X.safeParse( — the schema symbol X is actually used to validate.
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      (node.expression.name.text === 'parse' || node.expression.name.text === 'safeParse')
    ) {
      parsedSymbols.add(node.expression.expression.text);
    }
    // it('name', …) / test / describe — also matched behind .skip/.only/.each.
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const callee = node.expression;
      const calleeName = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)
          ? callee.expression.text
          : undefined;
      const arg = node.arguments[0];
      if (
        (calleeName === 'it' || calleeName === 'test' || calleeName === 'describe') &&
        (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))
      ) {
        testCases.add(arg.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return {
    declaredSymbols: [...declaredSymbols],
    testCases: [...testCases],
    importedSymbols: [...importedSymbols],
    parsedSymbols: [...parsedSymbols],
  };
}

/**
 * Extract CodeFacts for every file referenced by a realRef/testRef in `graph`,
 * resolved against `repoRoot`. Guarantees an entry per referenced file — the
 * RC rules treat an absent key as an extractor gap (loud, not silently green).
 */
export function extractCodeFacts(graph: CGraph, repoRoot: string): CodeFacts {
  const referenced = new Set<string>();
  for (const node of graph.nodes) {
    // CR-228: ONE realization binding for every type — a FUNC's code symbol, a
    // SCHEMA's Zod export and a physical MOD's CAD artefact are all `realRef`
    // now, so the formerly separate codeRef/schemaRef scans collapse into one.
    const real = RealRefSchema.safeParse(node.attributes?.realRef);
    if (real.success) referenced.add(real.data.file);
    const test = TestRefSchema.safeParse(node.attributes?.testRef);
    if (test.success) referenced.add(test.data.file);
  }
  const files: Record<string, FileFacts> = {};
  for (const rel of referenced) {
    const abs = join(repoRoot, rel);
    if (!existsSync(abs)) {
      files[rel] = { exists: false, declaredSymbols: [], testCases: [], importedSymbols: [], parsedSymbols: [] };
      continue;
    }
    files[rel] = { exists: true, ...parseFileFacts(readFileSync(abs, 'utf8'), abs) };
  }
  return { files, importEdges: extractImportEdges(repoRoot) };
}

// ---------------------------------------------------------------------------
// CR-212: file-level import graph of the repo's `src` tree, for RC-05. TS parser
// (not dependency-cruiser — a heavyweight runtime dep is unjustified for one warn
// rule, per the CR's Build-vs-Buy gate). JS/TS only, deterministic, no LSP: walk
// src/**, read each ImportDeclaration / re-export specifier, resolve RELATIVE ones
// to a real source file (repo-relative). Bare specifiers (node_modules) are
// skipped — they map to no MOD and produce no findings.
// ---------------------------------------------------------------------------
const SRC_EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

function walkSourceFiles(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string): void => {
    let entries: import('node:fs').Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
      const abs = join(dir, e.name);
      if (e.isDirectory()) visit(abs);
      else if (SRC_EXTS.some((x) => e.name.endsWith(x)) && !/\.d\.ts$/.test(e.name)) out.push(abs);
    }
  };
  visit(root);
  return out;
}

/** Resolve a relative import specifier to an existing repo-relative source file, or undefined. */
function resolveRelativeImport(fromAbs: string, spec: string, repoRoot: string): string | undefined {
  const baseAbs = resolvePath(dirname(fromAbs), spec);
  const candidates = [
    baseAbs,
    // A `.js`/`.mjs`/`.cjs` specifier maps to its TS source (NodeNext convention).
    baseAbs.replace(/\.(js|mjs|cjs)$/, '.ts'),
    baseAbs.replace(/\.(js|mjs|cjs)$/, '.tsx'),
    ...SRC_EXTS.map((x) => baseAbs + x),
    ...SRC_EXTS.map((x) => join(baseAbs, 'index' + x)),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return relative(repoRoot, c);
  }
  return undefined;
}

export function extractImportEdges(repoRoot: string): ImportEdge[] {
  const srcRoot = join(repoRoot, 'src');
  if (!existsSync(srcRoot)) return [];
  const seen = new Set<string>();
  const edges: ImportEdge[] = [];
  for (const abs of walkSourceFiles(srcRoot)) {
    let source: string;
    try {
      source = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.Latest, true);
    const from = relative(repoRoot, abs);
    for (const stmt of sf.statements) {
      // import ... from '...'  |  export ... from '...'  (re-export)
      const spec =
        (ts.isImportDeclaration(stmt) || ts.isExportDeclaration(stmt)) &&
        stmt.moduleSpecifier &&
        ts.isStringLiteral(stmt.moduleSpecifier)
          ? stmt.moduleSpecifier.text
          : undefined;
      if (!spec || !spec.startsWith('.')) continue; // bare = node_modules → skip
      const to = resolveRelativeImport(abs, spec, repoRoot);
      if (!to || to === from) continue;
      const key = `${from}\u0000${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from, to });
    }
  }
  return edges;
}

/**
 * Map the core graph onto the contracts OntologyGraph shape the rules expect.
 *
 * Exported since CR-GC-303: this is the ONE mapper for every rule-evaluation input.
 * The steering/generate path used to build its OntologyGraph via
 * `JSON.parse(exportGraphJson(graph))` instead — and `exportGraphJson` flattens
 * `node.attributes` onto the element (the committed SSOT/Format-E convention since
 * CR-216/228). Contracts rules read `element.attributes?.x`, so every
 * attribute-reading rule (R-19 testRef, R-20 realRef/codeRef, VR-01 testResult,
 * SC-04, AF-01..05 analysisFreshness) was permanently blind in that path.
 *
 * Fix direction matters: the export encoding stays exactly as it is (it is a
 * committed on-disk convention with round-trip consumers). What was wrong is using
 * the *export* encoding as *rule-eval* input. One mapper, no serialization detour.
 *
 * BOTH shapes must be served, because `OntologyElement` is not a flat bag NOR a
 * pure nested one: it declares TYPED TOP-LEVEL fields (`kinds`, `asil`, `method`)
 * next to the free-form `attributes` record, and the rules read whichever the
 * schema declares. `kinds` is read top-level (UC-05/UC-06: `e.kinds?.includes(…)`),
 * `testRef`/`realRef`/`analysisFreshness` are read out of `attributes`. graphcode
 * stores all of them in one `node.attributes` bag, so the mapper must LIFT the
 * typed ones out while keeping the bag intact. Mapping only one way blinds the
 * other half of the catalog — that was the actual defect behind CR-GC-299/303,
 * and it also silently disabled UC-05/UC-06 on the conformance path.
 *
 * NOTE: `attributes` is passed by REFERENCE, not cloned — callers must treat the
 * result as read-only (both call sites only evaluate rules over it).
 */
export function toOntologyGraph(graph: CGraph): OntologyGraph {
  type OElement = OntologyGraph['elements'][number];
  return {
    elements: graph.nodes.map((n) => ({
      id: n.uid,
      type: n.type as OElement['type'],
      name: n.name,
      description: n.description ?? '',
      status: (n.attributes?.status as OElement['status']) ?? 'draft',
      created_at: (n.attributes?.created_at as string) ?? '',
      // Typed OntologyElement columns, lifted out of the bag (see doc comment).
      // Left `undefined` when absent — the schema marks all three optional.
      kinds: n.attributes?.kinds as OElement['kinds'],
      asil: n.attributes?.asil as OElement['asil'],
      method: n.attributes?.method as OElement['method'],
      attributes: n.attributes,
    })),
    // CR-211: RC-04 walks io + relation traces (FUNC ─io→ FLOW ─relation→ SCHEMA),
    // so the edges must be mapped, not dropped.
    traces: graph.edges.map((e) => ({
      source: e.sourceId,
      target: e.targetId,
      type: e.edgeType as OntologyGraph['traces'][number]['type'],
      label: (e.attributes?.label as string) ?? undefined,
      weight: 1,
      created_at: '',
    })),
  };
}

/** Minimal harness duck-type — avoids importing the class (no circular dep). */
export interface ConformanceHarness {
  evaluateRules(): RuleViolation[];
  getGraph(): CGraph;
  getRepoRoot(): string;
}

/** RC violations of the live graph, in the harness RuleViolation shape. */
export function conformanceViolations(harness: Pick<ConformanceHarness, 'getGraph' | 'getRepoRoot'>): RuleViolation[] {
  const graph = harness.getGraph();
  const facts = extractCodeFacts(graph, harness.getRepoRoot());
  return evaluateConformanceRules(toOntologyGraph(graph), facts).map((v) => ({
    ruleId: v.rule_id,
    severity: v.severity,
    elementId: v.element_id,
    message: v.message,
    fixHint: v.fix_hint,
  }));
}

/**
 * Product-facing readiness: V3_RULES (L2 gate) + RC conformance in ONE report.
 * Every readiness consumer (graph_readiness, graph_help, dashboard) goes
 * through this — plain `scoreReadiness` stays the pure/browser-safe primitive.
 */
export function scoreReadinessWithConformance(harness: ConformanceHarness): ReadinessReport {
  const violations = [...harness.evaluateRules(), ...conformanceViolations(harness)];
  return computeReadiness(violations, harness.getGraph());
}
