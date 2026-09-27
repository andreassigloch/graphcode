#!/usr/bin/env node
// REQ-kinds-Migration auf zwei Werte (CR-GC-669, Ontologie-Major contracts 10.x, CR-SM-365/366).
//
// Zielbild: REQ.kinds = genau EIN Wert aus {functional, non-functional}; risk/mitigation werden
// das Rollen-Attribut `attributes.role`; pre-/postcondition entfallen; FCHAIN erfuellt nur noch
// non-functional. Ein Graph mit Altwerten bootet weiter, R-18 meldet die betroffenen
// satisfy-Kanten aber als error — dieses Werkzeug zieht den Bestand um.
//
// Zwei Schritte, bewusst getrennt (Entscheidung je REQ, kein Pauschalzug — wie `negative` in
// CR-SM-266a):
//   propose  liest den SSOT (nur lesend), zaehlt den Bestand und schreibt eine
//            Entscheidungsdatei: je betroffener REQ ein Eintrag mit Vorschlag und Grund.
//            Mechanisch (decidedBy "mechanical"): risk/mitigation -> role, pre/post an FUNC ->
//            functional. Alles andere schlaegt eine Heuristik vor (decidedBy "heuristic").
//   apply    liest die Entscheidungsdatei und schreibt EINEN Batch durch den Tool-Layer
//            (graph_mutate, danach graph_export) — nie rohe harness.mutate(), nie Hand-Edit.
//            Ein Eintrag mit decidedBy "heuristic" wird verweigert, solange nicht
//            --accept-heuristic gesetzt ist (Probelauf auf Kopien).
//
// Usage:
//   node scripts/migrate-req-kinds.mjs propose --repo <dir> [--graph <name>] [--out <file>]
//   node scripts/migrate-req-kinds.mjs apply   --repo <dir> --decisions <file> [--graph <name>]
//                                               [--accept-heuristic] [--dry-run]
//
// --repo zeigt auf das Repo, dessen Store migriert wird. Fuer einen Probelauf: eine KOPIE
// (docs/graph/<name>.graph.json in einem Wegwerf-Verzeichnis) — nie das .graphcode eines echten
// Repos neben einem laufenden Host (single-writer, Memory grammar-major-migration-mechanik).
//
// @author andreas@siglochconsulting
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Die Altwerte, die entfallen, und wohin sie gehen. */
export const LEGACY_CONDITION = ['precondition', 'postcondition'];
export const ROLE_VALUES = ['risk', 'mitigation'];
export const CORE_KINDS = ['functional', 'non-functional'];
const FUNCTIONAL_SATISFIERS = ['FUNC'];
const NON_FUNCTIONAL_SATISFIERS = ['MOD', 'SYS', 'FCHAIN'];
/** satisfy-where der contracts 10.x (meta-model.ts): FUNC -> functional; MOD/SYS/FCHAIN -> non-functional. */
const admits = (type, kind) => (kind === 'functional' ? FUNCTIONAL_SATISFIERS : NON_FUNCTIONAL_SATISFIERS).includes(type);

/** Toleranter Leser wie contracts `normalizeReqKinds` (Liste oder Komma-String). */
export function readKinds(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((k) => String(k).trim()).filter(Boolean);
  return String(raw).split(',').map((k) => k.trim()).filter(Boolean);
}

const tokens = (s) =>
  new Set(
    String(s ?? '')
      .toLowerCase()
      .split(/[^a-z0-9äöüß]+/)
      .filter((t) => t.length >= 4 && !['func', 'fchain'].includes(t)),
  );

function overlap(a, b) {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

const hasRealRef = (e) => e?.realRef != null || e?.attributes?.realRef != null;

/**
 * Bestand eines Graphen (Format: `{elements, traces}` wie docs/graph/*.graph.json). Die Spalten
 * entsprechen der Tabelle "Migrationsbestand" in CR-SM-366, damit der Probelauf sie abgleichen kann.
 */
export function countGraph(ontology) {
  const byId = new Map(ontology.elements.map((e) => [e.id, e]));
  const reqs = ontology.elements.filter((e) => e.type === 'REQ');
  const kindsOf = (e) => readKinds(e.kinds ?? e.attributes?.kinds);
  const c = {
    req: reqs.length,
    prePost: 0,
    risk: 0,
    mitigation: 0,
    functionalAndNonFunctional: 0,
    roleWithCoreKind: 0,
    noCoreKindAfterMove: 0,
    noKinds: 0,
    satisfyToPrePost: 0,
    satisfyToRole: 0,
    fchainToFunctional: 0,
  };
  for (const r of reqs) {
    const k = kindsOf(r);
    const core = k.filter((x) => CORE_KINDS.includes(x));
    const role = k.some((x) => ROLE_VALUES.includes(x));
    if (k.some((x) => LEGACY_CONDITION.includes(x))) c.prePost++;
    if (k.includes('risk')) c.risk++;
    if (k.includes('mitigation')) c.mitigation++;
    if (core.length === 2) c.functionalAndNonFunctional++;
    if (role && core.length > 0) c.roleWithCoreKind++;
    if (k.length === 0) c.noKinds++;
    else if (core.length === 0) c.noCoreKindAfterMove++;
  }
  for (const t of ontology.traces) {
    if (t.type !== 'satisfy') continue;
    const tgt = byId.get(t.target);
    if (tgt?.type !== 'REQ') continue;
    const k = kindsOf(tgt);
    if (k.some((x) => LEGACY_CONDITION.includes(x))) c.satisfyToPrePost++;
    if (k.some((x) => ROLE_VALUES.includes(x))) c.satisfyToRole++;
    if (byId.get(t.source)?.type === 'FCHAIN' && k.includes('functional')) c.fchainToFunctional++;
  }
  return c;
}

/**
 * Ein Eintrag je REQ, die der Major beruehrt. Felder, die `apply` liest: `kinds` (Zielliste,
 * genau ein Wert oder leer), `role` (risk|mitigation|null), `dropSatisfy`/`addSatisfy` (Quell-uids
 * der satisfy-Kanten auf diese REQ), `decidedBy`. Der Rest (`before`, `satisfiedBy`,
 * `candidates`, `reason`) ist die Entscheidungsgrundlage fuer den Menschen.
 */
export function proposeDecisions(ontology) {
  const byId = new Map(ontology.elements.map((e) => [e.id, e]));
  const satisfiers = new Map();
  const members = new Map(); // FCHAIN/MOD -> FUNC-Glieder (compose bzw. allocate)
  const allocatedTo = new Map(); // FUNC -> MOD
  for (const t of ontology.traces) {
    if (t.type === 'satisfy' && byId.get(t.target)?.type === 'REQ') {
      const list = satisfiers.get(t.target) ?? [];
      const src = byId.get(t.source);
      if (src) list.push({ uid: src.id, type: src.type });
      satisfiers.set(t.target, list);
    }
    const push = (map, key, val) => map.set(key, [...(map.get(key) ?? []), val]);
    if (t.type === 'compose' && byId.get(t.source)?.type === 'FCHAIN' && byId.get(t.target)?.type === 'FUNC') {
      push(members, t.source, byId.get(t.target));
    }
    if (t.type === 'allocate' && byId.get(t.source)?.type === 'FUNC' && byId.get(t.target)?.type === 'MOD') {
      push(members, t.target, byId.get(t.source)); // MOD -> ihm zugeteilte FUNC
      push(allocatedTo, t.source, byId.get(t.target)); // FUNC -> MOD
    }
  }

  const decisions = [];
  for (const req of ontology.elements.filter((e) => e.type === 'REQ')) {
    const before = readKinds(req.kinds ?? req.attributes?.kinds);
    const sat = satisfiers.get(req.id) ?? [];
    const legacy = before.filter((k) => LEGACY_CONDITION.includes(k));
    const roles = before.filter((k) => ROLE_VALUES.includes(k));
    const core = [...new Set(before.filter((k) => CORE_KINDS.includes(k)))];
    const unknown = before.filter((k) => ![...LEGACY_CONDITION, ...ROLE_VALUES, ...CORE_KINDS].includes(k));
    const fchains = sat.filter((s) => s.type === 'FCHAIN');
    const funcs = sat.filter((s) => FUNCTIONAL_SATISFIERS.includes(s.type));
    const nonFuncSat = sat.filter((s) => NON_FUNCTIONAL_SATISFIERS.includes(s.type));

    const cases = [];
    if (legacy.length > 0) cases.push(fchains.length > 0 ? 'prepost-on-fchain' : 'prepost');
    if (roles.length > 0) cases.push('role');
    if (core.includes('functional') && fchains.length > 0) cases.push('functional-on-fchain');
    else if (core.length === 1 && sat.some((s) => !admits(s.type, core[0]))) cases.push('kinds-mismatch');
    if (before.length === 0 && sat.length > 0) cases.push('undeclared-with-satisfier');
    if (core.length > 1) cases.push('mixed');
    if (unknown.length > 0) cases.push('unknown-kind');
    if (cases.length === 0) continue;

    const entry = {
      uid: req.id,
      name: req.name,
      case: cases,
      before: { kinds: before },
      satisfiedBy: sat,
      kinds: [],
      role: roles.length === 1 ? roles[0] : null,
      dropSatisfy: [],
      addSatisfy: [],
      decidedBy: 'heuristic',
      reason: '',
    };
    const reasons = [];

    if (roles.length > 1) {
      entry.decidedBy = 'open';
      reasons.push('traegt risk UND mitigation — genau eine Rolle waehlen');
    }
    if (core.length > 1 || unknown.length > 0) {
      entry.decidedBy = 'open';
      reasons.push(core.length > 1 ? 'functional+non-functional = falsch zerlegt, REQ teilen' : `unbekannter Wert ${unknown.join(', ')}`);
    }

    // Kern-kind: vorhandenes behalten, sonst aus den Erfuellern ableiten.
    let kind = core.length === 1 ? core[0] : null;
    if (kind === null && core.length === 0) {
      if (funcs.length > 0) kind = 'functional';
      else if (nonFuncSat.length > 0) kind = 'non-functional';
      else if (legacy.length > 0) kind = 'functional';
    }

    // Erfueller, deren Typ das Kern-kind nicht zulaesst (functional an FCHAIN/MOD/SYS,
    // non-functional an FUNC): erfuellt schon ein passender -> Kante weg; sonst umhaengen
    // (functional: an ein FUNC-Glied der Kette / des MOD mit realRef, bestes Wort-Ueberlappen;
    // non-functional: an das MOD, dem die FUNC zugeteilt ist); ohne Kandidat functional ->
    // non-functional (Ende-zu-Ende), non-functional -> offen.
    const wrong = kind ? sat.filter((s) => !admits(s.type, kind)) : [];
    if (wrong.length > 0) {
      const fitting = sat.filter((s) => admits(s.type, kind));
      const reqTok = tokens(`${req.id} ${req.name} ${req.description}`);
      const candidates = [];
      for (const w of wrong) {
        const pool = kind === 'functional' ? (members.get(w.uid) ?? []).filter(hasRealRef) : (allocatedTo.get(w.uid) ?? []);
        for (const c of pool) {
          if (candidates.some((x) => x.uid === c.id)) continue;
          candidates.push({ uid: c.id, name: c.name, via: w.uid, score: overlap(reqTok, tokens(`${c.id} ${c.name} ${c.description}`)) });
        }
      }
      candidates.sort((a, b) => b.score - a.score || a.uid.localeCompare(b.uid));
      if (candidates.length > 0) entry.candidates = candidates.slice(0, 5);
      const list = (xs) => xs.map((x) => x.uid).join(', ');
      if (fitting.length > 0) {
        entry.dropSatisfy = wrong.map((w) => w.uid);
        reasons.push(`${kind}, ${list(fitting)} erfuellt schon — satisfy von ${list(wrong)} entfaellt`);
      } else if (candidates.length > 0 && (kind === 'non-functional' || candidates[0].score > 0)) {
        entry.dropSatisfy = wrong.map((w) => w.uid);
        entry.addSatisfy = [candidates[0].uid];
        reasons.push(`${kind} an ${list(wrong)} — an ${candidates[0].uid} haengen (Ueberlappung ${candidates[0].score})`);
      } else if (kind === 'functional') {
        kind = 'non-functional';
        reasons.push(`an ${list(wrong)} ohne passendes FUNC mit realRef — als non-functional (Ende-zu-Ende) einordnen`);
      } else {
        entry.decidedBy = 'open';
        reasons.push(`non-functional an ${list(wrong)} ohne MOD — Erfueller heben oder REQ teilen`);
      }
    }

    entry.kinds = kind ? [kind] : [];

    // Mechanisch ist nur, was keine Wahl laesst.
    const onlyRole = cases.length === 1 && cases[0] === 'role' && core.length === 1;
    const prePostAtFunc = cases.length === 1 && cases[0] === 'prepost' && funcs.length > 0 && nonFuncSat.length === 0;
    if (entry.decidedBy === 'heuristic' && (onlyRole || prePostAtFunc)) entry.decidedBy = 'mechanical';

    if (legacy.length > 0 && reasons.length === 0) {
      reasons.push(
        funcs.length > 0
          ? 'pre/postcondition an FUNC -> functional'
          : nonFuncSat.length > 0
            ? `pre/postcondition an ${nonFuncSat.map((s) => s.type).join('/')} -> non-functional (Alternative: Eingangs-FLOW / UC-Ziel)`
            : 'pre/postcondition ohne Erfueller -> functional (Alternative: Eingangs-FLOW / UC-Ziel, REQ aufloesen)',
      );
    }
    if (roles.length === 1) {
      reasons.push(
        `${roles[0]} -> role` +
          (core.length === 1 ? '' : kind ? `, Kern-kind ${kind} aus den Erfuellern` : ', ohne Erfueller kein Kern-kind (Rolle traegt die Bedeutung)'),
      );
    }
    if (cases.includes('undeclared-with-satisfier') && kind) reasons.push(`ohne kinds, Erfueller ${sat.map((s) => s.type).join('/')} -> ${kind}`);
    entry.reason = reasons.join('; ');
    decisions.push(entry);
  }
  return decisions;
}

/**
 * Entscheidungen -> EIN MutateCommand-Batch. Prueft gegen den aktuellen Graphen, dass die Datei
 * nicht veraltet ist (kinds wie beim Vorschlag, Kanten vorhanden) und dass jede Entscheidung
 * getroffen ist. Wirft mit allen Befunden auf einmal, statt still zu ueberspringen.
 */
export function buildCommands(decisions, graph, { acceptHeuristic = false } = {}) {
  const nodes = new Map(graph.nodes.map((n) => [n.uid, n]));
  const edgeSet = new Set(graph.edges.map((e) => `${e.sourceId} ${e.edgeType} ${e.targetId}`));
  const problems = [];
  const commands = [];
  for (const d of decisions) {
    const node = nodes.get(d.uid);
    if (!node) { problems.push(`${d.uid}: nicht im Graphen`); continue; }
    const now = readKinds(node.attributes?.kinds);
    if (JSON.stringify(now) !== JSON.stringify(d.before.kinds)) {
      problems.push(`${d.uid}: kinds ${JSON.stringify(now)} statt ${JSON.stringify(d.before.kinds)} — Entscheidungsdatei veraltet`);
    }
    if (d.decidedBy === 'open') problems.push(`${d.uid}: offen — ${d.reason}`);
    if (d.decidedBy === 'heuristic' && !acceptHeuristic) problems.push(`${d.uid}: heuristischer Vorschlag nicht bestaetigt (decidedBy setzen)`);
    if (d.kinds.length > 1 || d.kinds.some((k) => !CORE_KINDS.includes(k))) problems.push(`${d.uid}: kinds muss genau ein Wert aus ${CORE_KINDS.join('|')} sein oder leer`);
    if (d.role != null && !ROLE_VALUES.includes(d.role)) problems.push(`${d.uid}: role ${d.role} unbekannt`);
    for (const s of d.dropSatisfy) if (!edgeSet.has(`${s} satisfy ${d.uid}`)) problems.push(`${d.uid}: ${s} -satisfy-> fehlt`);
    for (const s of d.addSatisfy) if (!nodes.has(s)) problems.push(`${d.uid}: Erfueller ${s} fehlt`);

    const attributes = { kinds: d.kinds };
    if (d.role != null) attributes.role = d.role;
    commands.push({ op: 'update-node', node: { uid: d.uid, attributes } });
    for (const s of d.dropSatisfy) commands.push({ op: 'delete-edge', edge: { sourceId: s, targetId: d.uid, edgeType: 'satisfy' } });
    for (const s of d.addSatisfy) {
      if (!edgeSet.has(`${s} satisfy ${d.uid}`)) commands.push({ op: 'add-edge', edge: { sourceId: s, targetId: d.uid, edgeType: 'satisfy' } });
    }
  }
  if (problems.length > 0) {
    const err = new Error(`migrate-req-kinds: ${problems.length} Befund(e), nichts angewendet:\n  ${problems.join('\n  ')}`);
    err.problems = problems;
    throw err;
  }
  return commands;
}

/**
 * Anwenden ueber den Tool-Layer: `registry` ist `bindToolsToHarness(harness)`. EIN graph_mutate-
 * Batch (Deletes und Adds zusammen), danach graph_export — der kanonische Sync-Pfad.
 */
export async function applyDecisions(registry, harness, decisions, { acceptHeuristic = false, dryRun = false } = {}) {
  const commands = buildCommands(decisions, harness.getGraph(), { acceptHeuristic });
  if (commands.length === 0) return { commands: 0, result: null, exported: null };
  const result = await registry['graph_mutate'].handler({ commands, consumerId: 'migrate-req-kinds', dryRun });
  if (!result.success || dryRun) return { commands: commands.length, result, exported: null };
  const exported = await registry['graph_export'].handler({});
  return { commands: commands.length, result, exported };
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function resolveGraph(repo, name) {
  if (name) return { name, path: join(repo, 'docs/graph', `${name}.graph.json`) };
  const files = readdirSync(join(repo, 'docs/graph')).filter((f) => f.endsWith('.graph.json'));
  const own = files.find((f) => f === `${basename(repo)}.graph.json`) ?? (files.length === 1 ? files[0] : undefined);
  if (!own) throw new Error(`mehrere Graphen unter ${repo}/docs/graph — --graph <name> angeben: ${files.join(', ')}`);
  return { name: own.replace(/\.graph\.json$/, ''), path: join(repo, 'docs/graph', own) };
}

async function main(argv) {
  const verb = argv[0];
  const repo = resolve(arg(argv, '--repo') ?? process.cwd());
  const { name, path } = resolveGraph(repo, arg(argv, '--graph'));
  if (verb === 'propose') {
    const ontology = JSON.parse(readFileSync(path, 'utf8'));
    const decisions = proposeDecisions(ontology);
    const out = {
      tool: 'migrate-req-kinds',
      cr: 'CR-GC-669',
      graph: name,
      counts: countGraph(ontology),
      decisions,
    };
    const file = arg(argv, '--out') ?? join(repo, `req-kinds-decisions.${name}.json`);
    writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
    const by = (k) => decisions.filter((d) => d.decidedBy === k).length;
    console.log(`${name}: ${decisions.length} REQ betroffen (mechanical ${by('mechanical')}, heuristic ${by('heuristic')}, open ${by('open')}) -> ${file}`);
    console.log(JSON.stringify(out.counts));
    return 0;
  }
  if (verb === 'apply') {
    const file = arg(argv, '--decisions');
    if (!file) throw new Error('apply braucht --decisions <file>');
    const { decisions } = JSON.parse(readFileSync(file, 'utf8'));
    const dist = pathToFileURL(join(fileURLToPath(new URL('..', import.meta.url)), 'dist/index.js')).href;
    const { createHarness, bindToolsToHarness } = await import(dist);
    const harness = await createHarness({ repoRoot: repo, scope: { workspaceId: name, systemId: name } });
    await harness.initialize();
    try {
      if (harness.getGraph().nodes.length === 0) await harness.seedFromJson();
      const registry = bindToolsToHarness(harness);
      const res = await applyDecisions(registry, harness, decisions, {
        acceptHeuristic: argv.includes('--accept-heuristic'),
        dryRun: argv.includes('--dry-run'),
      });
      const v = res.result?.violations ?? [];
      console.log(`${name}: ${res.commands} Kommandos, success=${res.result?.success} tier=${res.result?.tier}, ${v.length} Verdict-Befunde`);
      for (const x of v.filter((x) => x.severity === 'error')) console.log(`  ${x.ruleId} ${x.elementId ?? ''} ${x.message}`);
      if (res.exported) console.log(`export: ${res.exported.graphJson?.path ?? '(ok)'}`);
      return res.result && !res.result.success ? 1 : 0;
    } finally {
      await harness.close();
    }
  }
  console.error('usage: migrate-req-kinds.mjs propose|apply --repo <dir> [--graph <name>] ...');
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    },
  );
}
