#!/usr/bin/env node
// retro-kpi — post-project KPI evaluator (CR-GC-212).
//
// Computes the 6 standard KPIs (docs/KPI.md) from a session-data JSON the agent
// assembles during the retro: graph-vs-grep tool usage (transcript), audit_stats
// (applied/rejected), graph_readiness start→end, git net-LOC, plan conformance,
// and R-19/R-20 binding coverage at close. The agent reads audit_* / graph_readiness
// over MCP (no 2nd DB handle here — this runner only reads the JSON + git).
//
// Logic (computeKpis / renderKpiTable) is exported + unit-tested; the main block
// reads ./retro-session.json (or argv[2]), auto-fills git net-LOC, and prints the table.
//
// Usage: node scripts/retro-kpi.mjs [session.json]
// @author andreas@siglochconsulting
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Round to 2 decimals for deterministic, comparable KPI values. */
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Compute the 6 KPIs from session data. Pure — every input is supplied by the caller
 * (the agent reads the audit + readiness tools over MCP, the transcript for tool counts, git for LOC).
 *
 * `s` shape: `{ toolUsage:{graphCalls,grepGlobDocReads,mutate?,impact?,expand?,rulesEvaluate?},`
 * `audit:{applied,rejected}, readiness:{start,end}, git:{netLoc,tokens?},`
 * `plan:{dependsOnViolations}, binding:{coveragePct} }`.
 */
export function computeKpis(s) {
  const grep = Math.max(1, s.toolUsage.grepGlobDocReads ?? 0);
  return {
    // KPI 1 — Graph-vs-Grep ratio. Target > 1 (the graph was used, not grep-bypassed).
    graphVsGrepRatio: r2((s.toolUsage.graphCalls ?? 0) / grep),
    // KPI 2 — tool usage counts (no target; a usage profile).
    toolUsage: {
      mutate: s.toolUsage.mutate ?? 0,
      impact: s.toolUsage.impact ?? 0,
      expand: s.toolUsage.expand ?? 0,
      rulesEvaluate: s.toolUsage.rulesEvaluate ?? 0,
    },
    // KPI 3 — tokens per net LOC. Target ↓. null if tokens not captured (transcript follow-up).
    tokenPerLoc: s.git.tokens != null && s.git.netLoc > 0 ? r2(s.git.tokens / s.git.netLoc) : null,
    // KPI 4 — plan conformance: # CRs violating depends-on order. Target 0.
    planConformance: s.plan.dependsOnViolations,
    // KPI 5 — gate health: applied÷rejected + readiness delta start→end.
    gateHealth: {
      appliedRejectedRatio: r2((s.audit.applied ?? 0) / Math.max(1, s.audit.rejected ?? 0)),
      readinessDelta: r2((s.readiness.end ?? 0) - (s.readiness.start ?? 0)),
    },
    // KPI 6 — binding coverage: R-19/R-20 (testRef/codeRef) at close. Target 100%.
    bindingCoverage: s.binding.coveragePct,
  };
}

// ---------------------------------------------------------------------------
// KPI 1 aus dem Sitzungsprotokoll (CR-GC-639)
// ---------------------------------------------------------------------------
//
// Bis CR-GC-639 zaehlte hier niemand: `computeKpis` bekam `toolUsage` von Hand, waehrend der Retro.
// `rig/referenz-change/messen.mjs` zaehlte dann selbst — mit EIGENER Definition (nur Lesezugriffe,
// ohne Doc-Reads). Zwei Definitionen derselben Kennzahl laufen auseinander, ohne dass es jemand
// merkt. Diese EINE Zaehlung folgt `docs/KPI.md`:
//
//   KPI 1 = graph_*-Aufrufe ÷ (Grep + Glob + Doc-Read)
//
// „Grep" umfasst auch `grep`/`find`/`rg` in einem Bash-Aufruf — in Claude-Code-Sitzungen laeuft
// die Suche fast immer ueber Bash, das dedizierte Grep-Werkzeug zaehlte am Referenz-Change 0.
// „Doc-Read" ist das Lesen der AUSGABEN, die GRAPHCODE.md ausdruecklich verbietet:
// `docs/graph/`, `docs/views/`, `.graphcode/` — nicht das Lesen von Quelltext.

const IST_GRAPH = (name) => typeof name === 'string' && name.startsWith('mcp__graphcode__');
const GRAPH_SCHREIBT = new Set(['graph_mutate', 'graph_merge', 'graph_reseed', 'graph_realize', 'graph_export', 'graph_test_ingest']);
const kurz = (name) => name.replace(/^mcp__graphcode__/, '');
const AUSGABE_PFAD = /(^|[\s'"/])(docs\/graph\/|docs\/views\/|\.graphcode\/)/;
/**
 * Die Befehle, die ein Bash-Aufruf wirklich AUSFUEHRT — je Pipeline der Kopf.
 *
 * Gezaehlt werden darf nur, was laeuft, nicht was als Text in einem Befehl steht. Zwei gemessene
 * Fehlzaehlungen haben das erzwungen:
 *   - `npm test | grep FAIL` — der grep NACH der Pipe filtert eine Ausgabe und fragt nichts ueber den
 *     Code (29 von 188 greps in der Sitzung, aus der diese Zaehlung stammt).
 *   - Heredocs, die Dateien schreiben und `npm test` nur ERWAEHNEN — an CR-GC-639 selbst 7 von 8
 *     gezaehlten „Volllaeufen".
 * Also: Heredoc-Rumpf weg, `echo`/`printf`-Argumente zaehlen nicht, dann je Segment (`&&`, `||`, `;`,
 * Zeilenumbruch) der Kopf der Pipeline, ohne vorangestelltes `env -u X` und `VAR=wert`.
 */
export function befehlsKoepfe(cmd) {
  const ohneHeredoc = cmd.replace(/<<-?\s*['"]?(\w+)['"]?[^\n]*\n[\s\S]*?\n\1[ \t]*(?=\n|$)/g, '');
  return pipelineKoepfe(ohneHeredoc)
    .map((kopf) => kopf.replace(/^env(\s+-u\s+\S+|\s+\w+=\S*)*\s+/, '').replace(/^(\w+=\S*\s+)+/, ''))
    .filter((kopf) => kopf && !/^(echo|printf)\b/.test(kopf));
}

/**
 * Zerlegt an `&&`, `||`, `;`, Zeilenumbruch und nimmt je Segment den Teil vor der ersten Pipe —
 * aber nur an Trennern AUSSERHALB von Anfuehrungszeichen. Gemessener Anlass: `grep -E "a|b" datei`
 * wurde an dem `|` im Muster zerschnitten, und der Dateiname dahinter ging verloren.
 */
function pipelineKoepfe(cmd) {
  const koepfe = [];
  let seg = '', quote = null, inPipe = false;
  const ende = () => { koepfe.push(seg.trim()); seg = ''; inPipe = false; };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i], n = cmd[i + 1];
    if (quote) { if (c === quote) quote = null; if (!inPipe) seg += c; continue; }
    if (c === '"' || c === "'") { quote = c; if (!inPipe) seg += c; continue; }
    if ((c === '&' && n === '&') || (c === '|' && n === '|')) { ende(); i++; continue; }
    if (c === ';' || c === '\n') { ende(); continue; }
    if (c === '|') { inPipe = true; continue; }
    if (!inPipe) seg += c;
  }
  ende();
  return koepfe.filter(Boolean);
}

/**
 * Eine SUCHE fragt das Repo. Ein grep ueber die Ausgabedatei eines Testlaufs in /tmp liest ein Log —
 * das ist keine Frage, die der Graph haette beantworten koennen (am Referenz-Change 6 von 33).
 */
const istSuche = (koepfe) =>
  koepfe.some((k) => /^(grep|find|rg|git\s+grep)\s/.test(k) && !/(^|\s|["'])(\/private)?\/tmp\//.test(k));

/** Alle tool_use-Bloecke eines Protokollausschnitts, in Reihenfolge. */
function werkzeugAufrufe(saetze) {
  const out = [];
  for (const d of saetze) {
    const c = d?.message?.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) if (b?.type === 'tool_use') out.push(b);
  }
  return out;
}

/**
 * Der Ausschnitt eines Protokolls, der zu EINEM CR gehoert: ab dem ersten Satz, der die CR-ID
 * nennt (meist die Ausgabe von `aise dispatch prepare`), bis zu dem Satz, der ihn nach
 * `docs/cr/done/` verschiebt — oder bis zum Ende, solange er offen ist (der Hook laeuft direkt
 * nach dem Abschluss, da IST das Ende der Abschluss). Ohne das Ende zaehlte ein frueh
 * geschlossener CR rueckwirkend alles mit, was die Sitzung danach tat — gemessen an CR-GC-630:
 * 19 Volllaeufe statt 3.
 *
 * Nennt kein Satz die ID, ist das Fenster LEER — nicht das ganze Protokoll: eine Messung ueber
 * die falsche Arbeit ist schlimmer als keine.
 */
export function fensterFuer(saetze, crId) {
  const texte = saetze.map((d) => JSON.stringify(d));
  const i = texte.findIndex((t) => t.includes(crId));
  if (i < 0) return [];
  const abschluss = texte.findIndex((t, k) => k > i && t.includes(`docs/cr/done/${crId}`));
  return saetze.slice(i, abschluss < 0 ? saetze.length : abschluss + 1);
}

/** Werkzeugnutzung im Format von `computeKpis(...).toolUsage`, plus drei ausgewiesene Extras. */
export function werkzeugNutzung(saetze) {
  const n = {
    graphCalls: 0, grepGlobDocReads: 0, mutate: 0, impact: 0, expand: 0, rulesEvaluate: 0,
    // Extras — nicht Teil von KPI 1, aber das, was man zum Deuten braucht:
    graphReads: 0,   // Schreiben hat keinen grep-Ersatz; wer nur schreibt, hat nicht GEFRAGT
    volllaeufe: 0,   // `npm test` — die volle Suite
    selektiv: 0,     // `npx vitest run <dateien>` — die Auswahl
  };
  for (const b of werkzeugAufrufe(saetze)) {
    const name = b.name ?? '';
    const input = b.input ?? {};
    if (IST_GRAPH(name)) {
      const k = kurz(name);
      n.graphCalls++;
      if (!GRAPH_SCHREIBT.has(k)) n.graphReads++;
      if (k === 'graph_mutate') n.mutate++;
      if (k === 'graph_impact') n.impact++;
      if (k === 'graph_expand') n.expand++;
      if (k === 'rules_evaluate') n.rulesEvaluate++;
      continue;
    }
    if (name === 'Grep' || name === 'Glob') { n.grepGlobDocReads++; continue; }
    if (name === 'Read' && AUSGABE_PFAD.test(String(input.file_path ?? ''))) { n.grepGlobDocReads++; continue; }
    if (name === 'Bash') {
      const koepfe = befehlsKoepfe(String(input.command ?? ''));
      const liestAusgabe = koepfe.some((k) => /^(cat|sed|head|tail|less)\b/.test(k) && AUSGABE_PFAD.test(k));
      if (istSuche(koepfe) || liestAusgabe) n.grepGlobDocReads++;
      if (koepfe.some((k) => /^npm (test|run test)\b/.test(k))) n.volllaeufe++;
      if (koepfe.some((k) => /^npx vitest run\b/.test(k))) n.selektiv++;
    }
  }
  return n;
}

/** Ein Claude-Code-Protokoll (JSONL) lesen; eine abgeschnittene letzte Zeile wird uebergangen. */
export function leseProtokoll(pfad) {
  const saetze = [];
  for (const z of readFileSync(pfad, 'utf8').split('\n')) {
    if (!z.trim()) continue;
    try { saetze.push(JSON.parse(z)); } catch { /* Teilzeile am Ende einer laufenden Sitzung */ }
  }
  return saetze;
}

/** Render the KPI set as a markdown table. */
export function renderKpiTable(k) {
  const rows = [
    ['Graph-vs-Grep ratio', String(k.graphVsGrepRatio), '> 1'],
    ['Tool usage (mutate/impact/expand/rules)', `${k.toolUsage.mutate}/${k.toolUsage.impact}/${k.toolUsage.expand}/${k.toolUsage.rulesEvaluate}`, '—'],
    ['Tokens per net-LOC', k.tokenPerLoc == null ? 'n/a' : String(k.tokenPerLoc), '↓'],
    ['Plan conformance (depends-on violations)', String(k.planConformance), '0'],
    ['Gate health (applied÷rejected)', String(k.gateHealth.appliedRejectedRatio), '—'],
    ['Readiness Δ (start→end)', String(k.gateHealth.readinessDelta), '↑'],
    ['Binding coverage (R-19/R-20)', `${k.bindingCoverage}%`, '100%'],
  ];
  return ['| KPI | Value | Target |', '|---|---|---|', ...rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} |`)].join('\n');
}

/** Net LOC from `git diff --shortstat` (insertions − deletions), 0 if unavailable. */
function gitNetLoc() {
  try {
    const out = execSync('git diff --shortstat HEAD', { encoding: 'utf8' });
    const ins = Number(/(\d+) insertion/.exec(out)?.[1] ?? 0);
    const del = Number(/(\d+) deletion/.exec(out)?.[1] ?? 0);
    return ins - del;
  } catch {
    return 0;
  }
}

// --- main: read the session JSON, auto-fill git net-LOC, print the table ---
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = process.argv[2] ?? 'retro-session.json';
  if (!existsSync(path)) {
    console.error(
      `retro-kpi: no session file at ${path}.\n` +
        'Assemble it during the retro (se-retro): toolUsage (transcript), audit (audit_stats), ' +
        'readiness {start,end} (graph_readiness), git {netLoc,tokens}, plan {dependsOnViolations}, binding {coveragePct}.',
    );
    process.exit(1);
  }
  const session = JSON.parse(readFileSync(path, 'utf8'));
  if (session.git?.netLoc == null) session.git = { ...session.git, netLoc: gitNetLoc() };
  console.log(renderKpiTable(computeKpis(session)));
}
