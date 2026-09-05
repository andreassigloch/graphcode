#!/usr/bin/env node
/**
 * rig/moneyflow-struktur — moneyflow durch das ECHTE Gate strukturieren.
 *
 * Warum ein Rig und keine weitere Skript-Analyse (Auftraggeber, 2026-09-05): jede Messung
 * dieser Session lief bisher an `docs/graph/*.graph.json` vorbei am Gate. Das ist unsicher
 * (keine Validierung, kein Rollback, kein Audit) und misst eine Datei statt eines Systems.
 * Hier laeuft derselbe Pfad wie in Produktion: Disk-Kuzu, `GraphCodeHarness`,
 * `bindToolsToHarness` — `graph_mutate` ist dasselbe `harness.mutate()`, das der MCP-Server ruft.
 *
 * ISOLATION: der Store liegt in einem temporaeren Verzeichnis. Das echte moneyflow-Repo wird
 * NUR GELESEN und nie angefasst.
 *
 * Warum das die neuen Regeln ueberhaupt sieht: `graphcode/node_modules/@sigloch/contracts` ist
 * ein Symlink auf die Arbeitskopie in sigloch-modules — der lokale Build fuehrt RULES_VERSION
 * 12.0.0 mit BW-02, dem RD-04-Wurzelwald und dem CR-SM-284-Guard. Der per npx gebundene
 * MCP-Server (`@sigloch/graphcode@0.19.1`) kennt sie nicht.
 *
 *   node rig/moneyflow-struktur/driver.mjs            # nur messen
 *   node rig/moneyflow-struktur/driver.mjs --propose  # + einen Zug als dryRun durchs Gate
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GraphCodeHarness, bindToolsToHarness } from '../../dist/index.js';
import { KuzuAdapter } from '@sigloch/graph-api-core/kuzu';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';

const SOURCE = '/Users/andreas/Developer/dev/moneyflow/docs/graph/moneyflow.graph.json';
const PROPOSE = process.argv.includes('--propose');
const STRUCTURE = process.argv.includes('--structure');
const APPLY = process.argv.includes('--apply');

/**
 * Der Schnitt, vom Auftraggeber bestaetigt (2026-09-05). Er ist KEINE Erfindung: er faellt aus
 * README ("Geldfluesse und Kreislaeufe darstellen und simulieren"), den 13 dokumentierten UCs in
 * docs/project/architecture-graph.md (Stand 2026-03-18, beim Code-Reseed verloren gegangen) und
 * den Modul-Praefixen des Imports. Reihenfolge = Wirkkette: beschaffen -> halten -> fragen ->
 * zeigen, mit betreiben als Querschnitt.
 */
const BLOCKS = [
  ['beschaffen', 'Zahlen beschaffen', 'Quellen crawlen, importieren und in die Ontologie uebersetzen.', ['crawlers', 'import', 'transformers']],
  ['kreislauf', 'Kreislauf halten', 'Der Geldkreislauf als Graph: traversieren, Bilanz pruefen, Konfidenz, privates Overlay.', ['core', 'schemas']],
  ['simulieren', 'Fragen und simulieren', 'Was-waere-wenn, Kohortenvergleich, NL-Query, MCP-Zugang.', ['simulation', 'llm', 'mcp']],
  ['zeigen', 'Sichtbar machen', 'Sankey, Ring-View, Tabellen und der HTTP-Rand.', ['frontend', 'api']],
  ['betreiben', 'Betreiben', 'Auth, Monitoring, Billing, Moderation.', ['auth', 'ops', 'billing', 'content']],
];
const blockOfPrefix = new Map(BLOCKS.flatMap(([key, , , pre]) => pre.map((p) => [p, key])));

const config = (repoRoot) => ({
  repoRoot,
  scope: { workspaceId: 'moneyflow-rig', systemId: 'moneyflow' },
  consumerType: 'system',
  preCommitTimeout: 5000,
});

async function openRig() {
  const fixture = JSON.parse(readFileSync(SOURCE, 'utf8'));
  const tmp = mkdtempSync(join(tmpdir(), 'rig-moneyflow-'));
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
  const harness = new GraphCodeHarness(config(tmp), storage);
  await harness.initialize();
  await harness.importGraph(fixture);
  return { tmp, harness, tools: bindToolsToHarness(harness) };
}

/** Die zwei Blackbox-Zahlen aus CR-SM-282/-283, gelesen aus dem LEBENDEN Store. */
function blackboxReport(graph) {
  const byId = new Map(graph.elements.map((e) => [e.id, e]));
  const t = (id) => byId.get(id)?.type;
  const kids = new Map();
  const hasParent = new Set();
  for (const tr of graph.traces) {
    const s = t(tr.source), g = t(tr.target);
    const nest =
      (tr.type === 'compose' && s === 'FUNC' && g === 'FUNC') ||
      (tr.type === 'compose' && s === 'MOD' && g === 'MOD');
    if (nest) { hasParent.add(tr.target); (kids.get(tr.source) ?? kids.set(tr.source, []).get(tr.source)).push(tr.target); }
    else if (tr.type === 'allocate' && s === 'FUNC' && g === 'MOD') (kids.get(tr.target) ?? kids.set(tr.target, []).get(tr.target)).push(tr.source);
  }
  const rootF = graph.elements.filter((e) => e.type === 'FUNC' && !hasParent.has(e.id)).length;
  const rootM = graph.elements.filter((e) => e.type === 'MOD' && !hasParent.has(e.id)).length;
  const widths = [...kids.values()].map((v) => v.length).sort((a, b) => b - a);
  return { rootF, rootM, container: kids.size, maxBreadth: widths[0] ?? 0, over11: widths.filter((x) => x > 11).length };
}

const rig = await openRig();
try {
  const version = (await rig.tools.graph_readiness.handler({ detail: false })).graphVersion;
  const graph = rig.harness.graph ?? (await rig.harness.loadGraph?.());
  const live = { elements: graph.elements ?? graph.nodes?.map((n) => ({ id: n.uid, type: n.type })) ?? [],
                 traces: graph.traces ?? graph.edges?.map((e) => ({ source: e.sourceId, target: e.targetId, type: e.edgeType })) ?? [] };

  console.log('# rig/moneyflow-struktur — Baseline durch das echte Gate\n');
  console.log(`Store: ${rig.tmp} (temporaer) · Quelle: ${SOURCE} (nur gelesen) · graphVersion ${version}\n`);

  const b = blackboxReport(live);
  console.log('## Struktur');
  console.log(`| Kennzahl | Wert |`);
  console.log(`|---|--:|`);
  console.log(`| Elemente | ${live.elements.length} |`);
  console.log(`| FUNC-Wurzeln (compose-Wald) | **${b.rootF}** |`);
  console.log(`| MOD-Wurzeln | ${b.rootM} |`);
  console.log(`| Container mit Kindern | ${b.container} |`);
  console.log(`| breitester Container | ${b.maxBreadth} |`);
  console.log(`| Container ueber Schwelle 11 | ${b.over11} |`);

  const viol = await rig.tools.rules_get_violations.handler({ detail: 'grouped' });
  const groups = (viol.violations ?? viol.groups ?? []).slice().sort((x, y) => y.count - x.count);
  console.log(`\n## Regelbefunde am Gate (${viol.total ?? '?'} gesamt)\n`);
  console.log('| Regel | Sev | Anzahl |');
  console.log('|---|---|--:|');
  for (const g of groups.slice(0, 14)) console.log(`| ${g.ruleId} | ${g.severity} | ${g.count} |`);
  const rd04 = groups.find((g) => g.ruleId === 'RD-04');
  const bw02 = groups.find((g) => g.ruleId === 'BW-02');
  console.log(`\nRD-04: ${rd04 ? rd04.count + ' — ' + rd04.message : 'kein Befund'}`);
  console.log(`BW-02: ${bw02 ? bw02.count : 0} Befunde (moneyflow hat keine zerlegte FUNC, also keine Whitebox)`);

  if (PROPOSE) {
    console.log('\n## Ein Zug als dryRun durch das Gate\n');
    const res = await rig.tools.graph_mutate.handler({
      dryRun: true,
      baseVersion: version,
      commands: [
        { op: 'add-node', node: { uid: 'FUNC-mf-probe', type: 'FUNC', name: 'Probe-Ebene', description: 'Rig-Probe: eine Zwischenebene ueber zwei Wurzel-FUNCs.' } },
      ],
      violations: 'summary',
    });
    console.log('tier: ' + res.tier + ' · success: ' + res.success + ' · neue Violations: ' + (res.violations?.length ?? 0));
    for (const v of (res.violations ?? []).slice(0, 6)) console.log('  - ' + v.ruleId + ' ' + v.severity + ': ' + v.message);
    console.log('fitAdvisory: ' + JSON.stringify(res.fitAdvisory?.delta ?? null));
  }
  if (STRUCTURE) {
    console.log('\n## Strukturierungs-Zug' + (APPLY ? ' (APPLY)' : ' (dryRun)') + '\n');
    const byId = new Map(live.elements.map((e) => [e.id, e]));
    const modOfFunc = new Map();
    for (const tr of live.traces)
      if (tr.type === 'allocate' && byId.get(tr.source)?.type === 'FUNC' && byId.get(tr.target)?.type === 'MOD')
        modOfFunc.set(tr.source, tr.target);
    const prefixOf = (modId) => modId.replace(/^mod_/, '').split('_')[0];
    const mods = live.elements.filter((e) => e.type === 'MOD');
    const funcs = live.elements.filter((e) => e.type === 'FUNC');

    const unmappedMods = mods.filter((m) => !blockOfPrefix.has(prefixOf(m.id)));
    const unmappedFuncs = funcs.filter((f) => !modOfFunc.has(f.id) || !blockOfPrefix.has(prefixOf(modOfFunc.get(f.id))));
    console.log(`Module ohne Block: ${unmappedMods.length}${unmappedMods.length ? ' -> ' + unmappedMods.map((m) => m.id).join(', ') : ''}`);
    console.log(`FUNCs ohne Block: ${unmappedFuncs.length}${unmappedFuncs.length && unmappedFuncs.length < 8 ? ' -> ' + unmappedFuncs.map((f) => f.id).join(', ') : ''}\n`);

    const commands = [];
    for (const [key, name, desc] of BLOCKS) {
      commands.push({ op: 'add-node', node: { uid: `MOD-mf-${key}`, type: 'MOD', name, description: desc } });
      commands.push({ op: 'add-node', node: { uid: `FUNC-mf-${key}`, type: 'FUNC', name, description: desc } });
    }
    for (const m of mods) {
      const b = blockOfPrefix.get(prefixOf(m.id));
      if (b) commands.push({ op: 'add-edge', edge: { sourceId: `MOD-mf-${b}`, targetId: m.id, edgeType: 'compose' } });
    }
    for (const f of funcs) {
      const b = blockOfPrefix.get(prefixOf(modOfFunc.get(f.id) ?? ''));
      if (b) commands.push({ op: 'add-edge', edge: { sourceId: `FUNC-mf-${b}`, targetId: f.id, edgeType: 'compose' } });
    }
    console.log(`Batch: ${commands.length} Kommandos (10 Knoten, ${commands.length - 10} compose-Kanten)\n`);

    const res = await rig.tools.graph_mutate.handler({ dryRun: !APPLY, baseVersion: version, commands, violations: 'summary' });
    console.log(`tier: ${res.tier} · success: ${res.success} · neue Violations: ${res.violations?.length ?? 0}`);
    const byRule = {};
    for (const v of res.violations ?? []) byRule[v.ruleId] = (byRule[v.ruleId] ?? 0) + 1;
    console.log('neu je Regel: ' + JSON.stringify(byRule));
    for (const v of (res.violations ?? []).filter((x) => x.ruleId === 'RD-04' || x.severity === 'error').slice(0, 8))
      console.log('  - ' + v.ruleId + ' ' + v.severity + ': ' + v.message);

    const after = await rig.tools.rules_get_violations.handler({ detail: 'grouped' });
    const g2 = (after.violations ?? after.groups ?? []);
    const rd = g2.find((x) => x.ruleId === 'RD-04');
    const bw = g2.find((x) => x.ruleId === 'BW-02');
    console.log(`\nNACHHER  RD-04: ${rd ? rd.count + ' — ' + rd.message : 'kein Befund'}`);
    console.log(`NACHHER  BW-02: ${bw ? bw.count + ' Befunde' : '0 Befunde'}`);
    if (APPLY) {
      const full = await rig.tools.rules_get_violations.handler({ detail: 'summary' });
      for (const v of (full.violations ?? []).filter((x) => x.ruleId === 'BW-02')) console.log('    ' + v.message);
      const rd04all = (full.violations ?? []).filter((x) => x.ruleId === 'RD-04');
      console.log('  RD-04 im Detail:');
      for (const v of rd04all) console.log('    ' + v.message);
    }
    if (APPLY) {
      const g3 = rig.harness.graph;
      const live2 = {
        elements: (g3.nodes ?? []).map((n) => ({ id: n.uid, type: n.type })),
        traces: (g3.edges ?? []).map((e) => ({ source: e.sourceId, target: e.targetId, type: e.edgeType })),
      };
      console.log('NACHHER  Struktur: ' + JSON.stringify(blackboxReport(live2)));
    } else {
      console.log('(dryRun — nichts persistiert; die obigen Violations sind die NEUEN, der Wegfall des');
      console.log(' Wurzel-Befunds erscheint dort per Delta-Semantik nicht. Mit --apply messen.)');
    }
  }

} finally {
  await rig.harness.close();
  rmSync(rig.tmp, { recursive: true, force: true });
}
