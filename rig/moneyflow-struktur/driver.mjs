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
import { readFileSync, writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GraphCodeHarness, bindToolsToHarness } from '../../dist/index.js';
import { KuzuAdapter } from '@sigloch/graph-api-core/kuzu';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';

const SOURCE = '/Users/andreas/Developer/dev/moneyflow/docs/graph/moneyflow.graph.json';
const PROPOSE = process.argv.includes('--propose');
const STRUCTURE = process.argv.includes('--structure');
const APPLY = process.argv.includes('--apply');
const WOZU = process.argv.includes('--wozu');
/**
 * CR-SM-287 Go/No-Go: die Zustaende des Rigs als Datei ablegen, damit ein Ranker sie vergleichen
 * kann, OHNE dass die Messung wieder an `docs/graph/*.graph.json` vorbei am Gate laeuft. Was hier
 * herausfaellt, ist der Graph, wie das Gate ihn fuehrt — nicht die committete Datei.
 *
 *   node rig/moneyflow-struktur/driver.mjs --structure --apply --dump <verzeichnis>
 */
const DUMP = (() => { const i = process.argv.indexOf('--dump'); return i >= 0 ? process.argv[i + 1] : null; })();
const liveOf = (g) => ({
  elements: (g.nodes ?? []).map((n) => ({ ...n, id: n.uid })),
  traces: (g.edges ?? []).map((e) => ({ source: e.sourceId, target: e.targetId, type: e.edgeType })),
});
function dump(stage, g) {
  if (!DUMP) return;
  mkdirSync(DUMP, { recursive: true });
  const live = liveOf(g);
  writeFileSync(join(DUMP, `${stage}.json`), JSON.stringify(live));
  console.log(`  [dump] ${stage}: ${live.elements.length} Elemente, ${live.traces.length} Kanten -> ${join(DUMP, stage + '.json')}`);
}

/**
 * Die Wozu-Ebene, WIEDERHERGESTELLT aus docs/project/architecture-graph.md (Stand 2026-03-18).
 * Sie ist nicht erfunden: der Code-Reseed (`se:import-code`) hat sie ueberschrieben, weil er nur
 * FUNC/MOD/FLOW/SCHEMA erzeugt und den ganzen Graphen ersetzt. Die Doku ist die Quelle.
 *
 * UC.004 fehlt in der Doku — die Luecke wird uebernommen, nicht stillschweigend gefuellt.
 */
const ACTORS = [
  ['nutzer', 'Nutzer', 'Buerger, Berater, Journalist — die Produkt-UCs, tier-gesteuert (AC.001).'],
  ['externe-llm', 'Externe LLM', 'Claude, ChatGPT ueber den MCP-Zugang (AC.002).'],
  ['supporter', 'Supporter', 'Community-Beitragende, Content Moderation (AC.003).'],
  ['kurator', 'Kurator', 'Datenqualitaet und Review (AC.004).'],
  ['admin', 'Admin', 'Operator: User Management, Billing, Deployment, Monitoring, Backup (AC.005).'],
  ['crawler', 'Crawler', 'Automatisierte Quellenabfrage (AC.006).'],
  ['scheduler', 'Scheduler', 'Zeitgesteuerte Laeufe (AC.007).'],
];
const USE_CASES = [
  ['wohin-fliesst-der-euro', 'Wohin fliesst der Euro?', 'Ein Nutzer verfolgt einen Geldfluss durch den Graphen und sieht, wo er endet (UC.001).', 'kreislauf', ['traversal', 'template']],
  ['was-waere-wenn', 'Was waere wenn?', 'Ein Nutzer aendert einen Parameter und vergleicht den Zustand vorher/nachher (UC.002).', 'simulieren', ['snapshot_diff', 'simulation']],
  ['frag-den-graphen', 'Frag den Graphen', 'Ein Nutzer oder eine externe LLM stellt eine Frage in natuerlicher Sprache (UC.003).', 'simulieren', ['nl_to_cypher', 'mcp']],
  ['kohorten-vergleichen', 'Kohorten vergleichen', 'Ein Nutzer stellt zwei Bevoelkerungsgruppen nebeneinander (UC.005).', 'simulieren', ['cohort', 'compare']],
  ['private-layer', 'Private Layer', 'Ein Nutzer legt eigene Zahlen ueber den oeffentlichen Graphen, ohne dass sie den Browser verlassen (UC.006).', 'kreislauf', ['private_overlay']],
  ['graph-plausibilisieren', 'Graph plausibilisieren', 'Kurator und Crawler pruefen Bilanz und Konfidenz der eingehenden Daten (UC.007).', 'beschaffen', ['conservation', 'confidence']],
  ['user-management', 'User Management', 'Ein Admin verwaltet Konten, Rollen und Tiers (UC.008).', 'betreiben', ['auth']],
  ['billing', 'Billing', 'Ein Admin rechnet Tiers ab (UC.009).', 'betreiben', ['billing']],
  ['graph-deployment', 'Graph Deployment', 'Ein Admin bringt einen geprueften Graphstand nach produktiv (UC.010).', 'betreiben', ['deploy']],
  ['monitoring-health', 'Monitoring und Health', 'Ein Admin sieht Zustand und Alarme des Betriebs (UC.011).', 'betreiben', ['monitoring']],
  ['content-moderation', 'Content Moderation', 'Supporter und Kurator pruefen Beitraege der Community (UC.012).', 'betreiben', ['content', 'cr_lifecycle']],
  ['backup-restore', 'Backup und Restore', 'Ein Admin sichert den Graphen und spielt ihn zurueck (UC.013).', 'betreiben', ['backup']],
];

/**
 * Der Schnitt, vom Auftraggeber bestaetigt (2026-09-05). Er ist KEINE Erfindung: er faellt aus
 * README ("Geldfluesse und Kreislaeufe darstellen und simulieren"), den 13 dokumentierten UCs in
 * docs/project/architecture-graph.md (Stand 2026-03-18, beim Code-Reseed verloren gegangen) und
 * den Modul-Praefixen des Imports. Reihenfolge = Wirkkette: beschaffen -> halten -> fragen ->
 * zeigen, mit betreiben als Querschnitt.
 */
const BLOCKS = [
  { key: 'beschaffen', name: 'Zahlen beschaffen', desc: 'Quellen crawlen, importieren und in die Ontologie uebersetzen.', prefixes: ['crawlers', 'import', 'transformers'] },
  { key: 'kreislauf', name: 'Kreislauf halten', desc: 'Der Geldkreislauf als Graph: traversieren, Bilanz pruefen, Konfidenz, privates Overlay.', prefixes: ['core', 'schemas'] },
  { key: 'simulieren', name: 'Fragen und simulieren', desc: 'Was-waere-wenn, Kohortenvergleich, NL-Query, MCP-Zugang.', prefixes: ['simulation', 'llm', 'mcp'] },
  {
    key: 'zeigen', name: 'Sichtbar machen', desc: 'Der Weg vom Graphen zum Bild und nach draussen.', prefixes: [],
    // CR-Runde 2: der Block trug 100 sub-FUNCs und 23 Randvertraege — RD-04 UND BW-02 zugleich.
    // Der Schnitt ist funktional (was der Nutzer sieht / was nach draussen spricht), nicht der
    // Dateibaum: `pages` (25) und `routes` (22) sind selbst ueber der Schwelle, eine dritte Ebene
    // waere ein Abbild von src/ und keine Architektur.
    children: [
      { key: 'darstellung', name: 'Darstellen', desc: 'Sankey, Ring-View, Tabellen — was der Nutzer sieht.', prefixes: ['frontend'] },
      { key: 'httprand', name: 'HTTP-Rand', desc: 'Routen und Server — was nach draussen spricht.', prefixes: ['api'] },
    ],
  },
  { key: 'betreiben', name: 'Betreiben', desc: 'Auth, Monitoring, Billing, Moderation.', prefixes: ['auth', 'ops', 'billing', 'content'] },
];

/** Flache Sicht auf den Baum: jeder Block mit seinem Elternteil (oder null). */
function flatBlocks(list, parent = null, out = []) {
  for (const b of list) {
    out.push({ ...b, parent });
    if (b.children) flatBlocks(b.children, b.key, out);
  }
  return out;
}
const ALL_BLOCKS = flatBlocks(BLOCKS);
// Ein Praefix zeigt immer auf den TIEFSTEN Block, der ihn fuehrt — `zeigen` selbst traegt keine
// Praefixe mehr, seine beiden Kinder tun es.
const blockOfPrefix = new Map(ALL_BLOCKS.flatMap((b) => b.prefixes.map((p) => [p, b.key])));

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

  dump('00-baseline', rig.harness.graph);

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
    for (const b of ALL_BLOCKS) {
      commands.push({ op: 'add-node', node: { uid: `MOD-mf-${b.key}`, type: 'MOD', name: b.name, description: b.desc } });
      commands.push({ op: 'add-node', node: { uid: `FUNC-mf-${b.key}`, type: 'FUNC', name: b.name, description: b.desc } });
      // Genau EIN compose-Elternteil je Kind (R-18, viertes Bein): der Unterblock haengt am
      // Oberblock, die Module haengen am Unterblock — nie an beiden.
      if (b.parent) {
        commands.push({ op: 'add-edge', edge: { sourceId: `MOD-mf-${b.parent}`, targetId: `MOD-mf-${b.key}`, edgeType: 'compose' } });
        commands.push({ op: 'add-edge', edge: { sourceId: `FUNC-mf-${b.parent}`, targetId: `FUNC-mf-${b.key}`, edgeType: 'compose' } });
      }
    }
    for (const m of mods) {
      const b = blockOfPrefix.get(prefixOf(m.id));
      if (b) commands.push({ op: 'add-edge', edge: { sourceId: `MOD-mf-${b}`, targetId: m.id, edgeType: 'compose' } });
    }
    for (const f of funcs) {
      const b = blockOfPrefix.get(prefixOf(modOfFunc.get(f.id) ?? ''));
      if (b) commands.push({ op: 'add-edge', edge: { sourceId: `FUNC-mf-${b}`, targetId: f.id, edgeType: 'compose' } });
    }
    console.log(`Batch: ${commands.length} Kommandos (${ALL_BLOCKS.length * 2} Knoten, ${commands.length - ALL_BLOCKS.length * 2} compose-Kanten)\n`);

    const res = await rig.tools.graph_mutate.handler({ dryRun: !APPLY, baseVersion: version, commands, violations: 'summary' });
    console.log(`tier: ${res.tier} · success: ${res.success} · neue Violations: ${res.violations?.length ?? 0}`);
    const byRule = {};
    for (const v of res.violations ?? []) byRule[v.ruleId] = (byRule[v.ruleId] ?? 0) + 1;
    console.log('neu je Regel: ' + JSON.stringify(byRule));
    for (const v of (res.violations ?? []).filter((x) => x.ruleId === 'RD-04' || x.severity === 'error').slice(0, 8))
      console.log('  - ' + v.ruleId + ' ' + v.severity + ': ' + v.message);

    // Der Zug ist ein Paar mit BEKANNTEM Vorzeichen (Auftraggeber bestaetigt, Regeln bestaetigen):
    // 306 Wurzeln -> 9, `zeigen` als Doppelblock entlarvt. Rankt der Zielvektor ihn richtig?
    const DIMS = ['modifiability', 'faultTolerance', 'flowEfficiency', 'coherence', 'viability', 'scalability'];
    const d = res.fitAdvisory?.delta ?? [];
    console.log('\nfitAdvisory (Delta je Dimension, layer arch):');
    DIMS.forEach((n, i) => console.log(`  ${n.padEnd(15)} ${(d[i] >= 0 ? '+' : '') + (d[i] ?? 0).toFixed(4)}`));
    console.log('  Summe            ' + (d.reduce((a, x) => a + x, 0) >= 0 ? '+' : '') + d.reduce((a, x) => a + x, 0).toFixed(4));
    if (res.fitAdvisory?.regressions?.length) console.log('  regressions: ' + JSON.stringify(res.fitAdvisory.regressions));

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
      dump('01-struktur', g3);
    } else {
      console.log('(dryRun — nichts persistiert; die obigen Violations sind die NEUEN, der Wegfall des');
      console.log(' Wurzel-Befunds erscheint dort per Delta-Semantik nicht. Mit --apply messen.)');
    }
  }

  if (WOZU) {
    console.log('\n## Wozu-Ebene wiederherstellen' + (APPLY ? ' (APPLY)' : ' (dryRun)') + '\n');
    const g4 = rig.harness.graph;
    const funcIds = (g4.nodes ?? []).filter((n) => n.type === 'FUNC').map((n) => n.uid);
    const cmds = [];
    for (const [key, name, desc] of ACTORS)
      cmds.push({ op: 'add-node', node: { uid: `ACTOR-mf-${key}`, type: 'ACTOR', name, description: desc } });

    const coverage = [];
    for (const [key, name, desc, , keys] of USE_CASES) {
      cmds.push({ op: 'add-node', node: { uid: `UC-mf-${key}`, type: 'UC', name, description: desc } });
      cmds.push({ op: 'add-edge', edge: { sourceId: 'SYS-moneyflow', targetId: `UC-mf-${key}`, edgeType: 'compose' } });
      cmds.push({ op: 'add-node', node: { uid: `FCHAIN-mf-${key}`, type: 'FCHAIN', name: `Kette: ${name}`, description: `Wirkkette zu ${name}.` } });
      cmds.push({ op: 'add-edge', edge: { sourceId: `UC-mf-${key}`, targetId: `FCHAIN-mf-${key}`, edgeType: 'compose' } });
      // Mitglieder: die BLATT-FUNCs des Code-Imports, deren Pfad eines der Stichworte traegt.
      const members = funcIds.filter((id) => keys.some((k) => id.includes(k)));
      for (const m of members) cmds.push({ op: 'add-edge', edge: { sourceId: `FCHAIN-mf-${key}`, targetId: m, edgeType: 'compose' } });
      coverage.push([key, members.length]);
    }
    console.log('Kettenbelegung (Doku-Konzept -> Code-Blaetter):');
    for (const [k, n] of coverage) console.log(`  ${n === 0 ? '!! ' : '   '}${k}: ${n}`);
    const leer = coverage.filter(([, n]) => n === 0);
    console.log(`\nKetten ohne einen einzigen Code-Treffer: ${leer.length}${leer.length ? ' -> ' + leer.map(([k]) => k).join(', ') : ''}`);
    console.log(`Batch: ${cmds.length} Kommandos\n`);

    const v2 = (await rig.tools.graph_readiness.handler({ detail: false })).graphVersion;
    const res2 = await rig.tools.graph_mutate.handler({ dryRun: !APPLY, baseVersion: v2, commands: cmds, violations: 'summary' });
    console.log(`tier: ${res2.tier} · success: ${res2.success} · neue Violations: ${res2.violations?.length ?? 0}`);
    const br = {};
    for (const v of res2.violations ?? []) br[v.ruleId] = (br[v.ruleId] ?? 0) + 1;
    console.log('neu je Regel: ' + JSON.stringify(br));
    for (const v of (res2.violations ?? []).filter((x) => x.severity === 'error').slice(0, 6))
      console.log('  ERROR ' + v.ruleId + ': ' + v.message);
    if (APPLY) {
      dump('02-wozu', rig.harness.graph);
      const rep = await rig.tools.graph_readiness.handler({ detail: false });
      console.log('\nReadiness nach der Wozu-Ebene:');
      for (const d of rep.dimension_readiness) console.log(`  ${d.dimension.padEnd(7)} ${String(d.score ?? '—').slice(0, 5).padStart(5)}  (${d.violations}/${d.applicable})`);
    }
  }

} finally {
  await rig.harness.close();
  rmSync(rig.tmp, { recursive: true, force: true });
}
