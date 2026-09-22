// Turn results into a communicable report: every raw run shown (never just a mean),
// per-arm RANGES not std-dev (n is small → a range, not significance), an explicit
// limits block, and the module-reuse AUDIT (a list a human judges, not a score —
// exact-name matching proved too brittle, see README).
//
// Reads results.json + results-opus.json (arms may run separately). @author andreas@siglochconsulting
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { leseTurns, cacheVerursacher, dryRunWirkung } from './turn-analyse.mjs';
import { steuerungsBericht } from './steuerung.mjs';
import { vergleichBericht } from './trajektorie.mjs';
import { schattenBericht } from './schatten-suggest.mjs';
import { ARM_ACHSEN, achsenUnterschied } from './run.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const rows = [];
// RESULTS_FILE waehlt EINEN Korpus. Ohne die Variable werden wie bisher alle
// results*.json zusammengezogen — das war richtig, solange es EINEN Korpus gab (Arme liefen
// parallel in getrennte Dateien). Seit rig/sigllm-spezifikation ist es falsch: der Report
// mischte sonst Laeufe verschiedener Fragen mit verschiedenen Goldens in eine Tabelle.
const files = process.env.RESULTS_FILE
  ? [process.env.RESULTS_FILE]
  : readdirSync(HERE).filter((f) => /^results(-.*)?\.json$/.test(f));
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

// CR-GC-572 — welche Achse unterscheidet zwei Arme? Ohne diese Tabelle liest sich jede
// Gegenueberstellung, als waere der Unterschied die eine Sache, die gerade interessiert.
// Gemessen war das falsch: `opus5` gegen `gcrun` variierte DREI Achsen zugleich, und
// zwoelf Laeufe lang wurde an einem Proxy optimiert, ohne dass irgendwo stand, wovon er
// ein Proxy ist.
console.log('\n## Betriebsmodi — worin sich diese Arme unterscheiden\n');
console.log('| arm | wer treibt die Schleife | Modell | Agent-Harness |');
console.log('|---|---|---|---|');
for (const a of arms) {
  const ax = ARM_ACHSEN[a];
  console.log(ax
    ? `| ${a} | ${ax.treiber} | ${ax.modell} | ${ax.agent ?? 'entfaellt (der Treiber IST die Schleife)'} |`
    : `| ${a} | (unbekannt — Arm nicht in ARM_ACHSEN eingetragen) | — | — |`);
}
const achsenNamen = { treiber: 'wer treibt', modell: 'Modell', agent: 'Agent-Harness' };
const paare = [];
for (let i = 0; i < arms.length; i++) {
  for (let j = i + 1; j < arms.length; j++) {
    const diff = achsenUnterschied(arms[i], arms[j]);
    if (diff) paare.push({ a: arms[i], b: arms[j], diff });
  }
}
if (paare.length) {
  console.log('\nPaarweise (eine Achse, die bei einem Arm ENTFAELLT, zaehlt nicht — sie ist');
  console.log('die Bedeutung der Treiber-Achse, keine zweite Variable daneben):');
  for (const p of paare.sort((u, v) => u.diff.length - v.diff.length)) {
    const wie = p.diff.length === 0 ? 'identische Modi (nur Wiederholung)'
      : p.diff.length === 1 ? `**genau eine Achse: ${achsenNamen[p.diff[0]]}** — sauber vergleichbar`
      : `${p.diff.length} Achsen zugleich (${p.diff.map((k) => achsenNamen[k]).join(', ')}) — konfundiert, keine Aussage ueber eine davon`;
    console.log(`  ${p.a} vs ${p.b}: ${wie}`);
  }
}

// CR-GC-553 — die Bewertung hat zwei Haelften, und beide gehoeren in den Bericht.
console.log('\n## Spezifikation — Dimensionen, Steuerung, und was NICHT gefragt wurde\n');
console.log('| run | req | uc | arch | alloc | ver | schema | cr | ms | Steuerwert @ Anker |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows.filter((x) => !x.error && x.spec)) {
  const d = r.spec.dimensions ?? {};
  const c = (k) => (d[k] == null ? '—' : d[k]);
  const st = r.spec.steer ? `${r.spec.steer.worst} @ ${r.spec.steer.anchor ?? '—'}` : '—';
  console.log(`| ${r.arm} #${r.run} | ${c('req')} | ${c('uc')} | ${c('arch')} | ${c('alloc')} `
    + `| ${c('ver')} | ${c('schema')} | ${c('cr')} | ${c('ms')} | ${st} |`);
}
for (const r of rows.filter((x) => !x.error && x.spec)) {
  const ne = r.spec.notEvaluated ?? [];
  if (ne.length) console.log(`\n  ${r.arm} #${r.run} — NICHT ausgewertet (0 Befunde heisst hier "nicht gefragt"): ${ne.join(', ')}`);
  const ao = r.spec.advisoryOnly ?? [];
  if (ao.length) console.log(`  ${r.arm} #${r.run} — ausgewertet, aber ohne Gate-Wirkung: ${ao.join(', ')}`);
}

console.log('\n## Code — dreiwertig, mit Reichweite (nie ein blosses gruen)\n');
console.log('| run | Urteil | Reichweite | Bindung (Blatt-FUNC) | Begruendung |');
console.log('|---|---|---|---|---|');
for (const r of rows.filter((x) => !x.error && x.code)) {
  const c = r.code;
  console.log(`| ${r.arm} #${r.run} | **${c.verdict}** | ${c.reach.assigned}/${c.reach.endpoints} (${c.reach.pct} %) `
    + `| ${c.binding.bound}/${c.binding.leafFuncs} (${c.binding.pct ?? 0} %) | ${c.why} |`);
}
console.log('\n`kongruent` = RC lief, hatte Reichweite, fand nichts · `gedriftet` = RC-Befunde');
console.log('· `nicht pruefbar` = RC lief nicht oder hatte keine Reichweite. Ein Gate, das ohne');
console.log('Bindung "gruen" meldet, ist schlimmer als keins — deshalb steht die Reichweite immer dabei.');

console.log('\n## Module reuse — AUDIT BY HAND (not a score)\n');
console.log('Did the authored architecture leverage the real sigloch-modules? Exact-name matching');
console.log('is too brittle (paraphrases → false 0); judge overlap by eye.\n');
for (const r of rows.filter((x) => !x.error && x.moduleAudit)) {
  console.log(`- **${r.arm} #${r.run}** authored MODs: ${r.moduleAudit.MOD.authored.join(', ')}`);
}
const gold = rows.find((r) => r.moduleAudit)?.moduleAudit?.MOD?.golden ?? [];
if (gold.length) console.log(`- **golden MODs**: ${gold.join(', ')}`);

// CR-GC-555 — die Loop-Kennzahlen gibt es NUR auf dem gcrun-Arm. Sie sind der Grund
// fuer diesen Arm: sie zeigen, ob die Steuerungsmaschinerie ueberhaupt gegriffen hat.
const mitLoop = rows.filter((x) => !x.error && x.tokens?.loop);
if (mitLoop.length) {
  console.log('\n## Executor-Loop — nur `graphcode run` (die anderen Arme haben keinen)\n');
  console.log('| run | Runden | Turns | angewandt | abgelehnt | repariert | preflight fix | preflight block | dry-run | fertig |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of mitLoop) {
    const l = r.tokens.loop;
    console.log(`| ${r.arm} #${r.run} | ${l.genRounds} | ${l.modelTurns} | ${l.mutatesApplied} | `
      + `${l.mutatesRejected} | ${l.repairedAfterRejection} | ${l.preflightFixed} | `
      + `${l.preflightBlocked} | ${l.dryRunProbes} | ${l.done ? 'ja' : 'nein'} |`);
  }
  console.log('\n`repariert` = das Gate hat abgelehnt, die Verstoesse gingen zurueck ans Modell, und');
  console.log('der naechste Versuch ging durch. `preflight fix` = der Loop hat selbst ergaenzt, was');
  console.log('eine Regel verlangt. Beides gibt es auf den `claude -p`-Armen nicht — dort setzt der');
  console.log('Agent Mutationen ohne Rueckkanal ab (gemessen: 16 von 19 ohne vorheriges Werkzeug).\n');
}

// CR-GC-553 — wurde jede Anforderung des Auftrags umgesetzt oder verworfen?
const mitDeckung = rows.filter((x) => !x.error && x.briefCoverage);
if (mitDeckung.length) {
  console.log('\n## Auftrags-Anforderungen — PRUEFLISTE, keine Note\n');
  console.log('Wortlaut-Ueberdeckung misst **Abschreiben, nicht Deckung** — und zwar messbar:');
  console.log('die Pruefliste ist aus der STRUKTURIERTEN Projektdefinition gezogen (`quelle` in');
  console.log('anforderungen-auftrag.json). Lauf 1 las genau diesen Wortlaut und erreicht 42/42,');
  console.log('Lauf 2 las die Prosa-Fassung und erreicht 1/42 — bei mehr Elementen und mehr Use');
  console.log('Cases. Die Zahl misst also den INPUT des Arms, nicht sein Ergebnis, und ist zwischen');
  console.log('den beiden Laeufen NICHT vergleichbar. Die Liste unten ist zum LESEN, schwaechste');
  console.log('zuerst; ein Score daraus waere eine Praemie auf Transkription (ITEM-2026-360).\n');
  console.log('Deterministisch waere die Frage nur mit HERKUNFT am REQ. Die Ontologie hat kein');
  console.log('solches Feld, und ihr status-Enum (draft/reviewed/open/done) kennt kein');
  console.log('"verworfen" — beide Haelften der Frage sind heute nicht ausdrueckbar (ITEM-2026-306).\n');
  for (const r of mitDeckung) {
    const b = r.briefCoverage;
    console.log(`### ${r.arm} #${r.run} — ${b.gesamt} Anforderungen, ${b.schwach} davon schwach gedeckt (< 0,3)`);
    console.log(`explizit verworfen: ${b.explizitVerworfen.length} (Konstrukt existiert nicht — die Null ist erzwungen)\n`);
    console.log('| Anforderung | Überdeckung | bester Treffer | Text |');
    console.log('|---|---:|---|---|');
    for (const z of b.zeilen.slice(0, 10)) {
      console.log(`| ${z.id} | ${z.ueberdeckung} | ${z.match ?? '—'} | ${z.text.slice(0, 70)} |`);
    }
    console.log(`\n(die zehn schwaechsten von ${b.gesamt}; die vollstaendige Liste steht in results*.json)\n`);
  }
}

// CR-GC-567 — wohin geht das Kontextfenster, und traegt der Dry-Run die Auswahl?
// Zwei Fragen, die die Ergebniszeile eines Laufs nicht beantworten kann: sie kennt nur
// eine Summe. Die Auswertung liest den Turn-Strom (nur `claude -p` mit stream-json) und
// das Audit (jeder Arm).
{
  const zeilen = [];
  for (const r of rows) {
    if (r.error) continue;
    const dir = join(HERE, 'runs', `${r.arm}-${r.run}`);
    const strom = join(dir, 'claude-stream.jsonl');
    const dr = dryRunWirkung(join(dir, '.graphcode', 'audit.jsonl'));
    let cache = null;
    if (existsSync(strom)) {
      try {
        const turns = leseTurns(strom);
        const top = cacheVerursacher(turns).slice(0, 3);
        const ges = turns.reduce((a, t) => a + t.verbrauch.cacheCreate, 0);
        cache = { turns: turns.length, ges, top };
      } catch { /* Strom unlesbar — Zeile bleibt ohne Cache-Spalte */ }
    }
    if (dr || cache) zeilen.push({ r, dr, cache });
  }
  if (zeilen.length) {
    console.log('\n## Kontextkosten und Dry-Run-Wirkung (CR-GC-567)\n');
    console.log('| Lauf | Turns | Cache-Schreibung | teuerster Verursacher | Previews | verworfen | Quote |');
    console.log('|---|---:|---:|---|---:|---:|---:|');
    for (const { r, dr, cache } of zeilen) {
      const top = cache?.top?.[0];
      console.log(
        `| ${r.arm} #${r.run} | ${cache?.turns ?? '—'} | ${cache ? cache.ges.toLocaleString('de-DE') : '—'} `
        + `| ${top ? `${top.werkzeug} (${top.tokens.toLocaleString('de-DE')})` : '—'} `
        + `| ${dr?.previews ?? '—'} | ${dr?.verworfen ?? '—'} | ${dr?.quote ?? '—'} |`);
    }
    console.log('\nCache-Schreibung kostet rund das Fuenfzehnfache einer Cache-Lesung — sie, nicht die');
    console.log('Trefferquote, ist der Posten. Die Zuschreibung ist eine Naeherung: trafen mehrere');
    console.log('Werkzeugergebnisse vor demselben Turn ein, wird gleich verteilt.');
    console.log('\nQuote = geprobt-und-verworfen je Preview. **0 heisst: der Dry-Run traegt die Auswahl');
    console.log('nicht** — jede Probe wurde angewandt, die Metrik bestaetigt nur. Ein Arm ohne');
    console.log('Previews hatte den Kanal gar nicht an (Executor: `candidates = 1`, CR-GC-568).');
    console.log('\nJe Lauf im Detail: `node rig/greenfield-systemtest/turn-analyse.mjs runs/<arm>-<n>`\n');
  }
}

// CR-GC-585 — Kanaele, Zeitlinie, Navigation, Effizienz, Endstand. Nur wo ein Strom da ist
// (Claude-Code-Arm): der Executor-Arm schreibt keinen, und das ist hier Absicht, kein Loch.
{
  const laeufe = rows
    .filter((r) => !r.error)
    .map((r) => ({ label: `${r.arm} #${r.run}`, strom: join(HERE, 'runs', `${r.arm}-${r.run}`, 'claude-stream.jsonl'), elemente: r.elements }))
    .filter((l) => existsSync(l.strom));
  if (laeufe.length) console.log('\n' + steuerungsBericht(laeufe) + '\n');
}

// CR-GC-586 — Auto gegen Hand. GOLDEN ist ein Berichtsparameter wie RESULTS_FILE (die Korpus-env
// setzt ihn); der Hand-Trail liegt als referenz-trail.jsonl daneben. Jeder Arm mit Audit zaehlt.
{
  const laeufe = rows
    .filter((r) => !r.error)
    .map((r) => {
      const dir = join(HERE, 'runs', `${r.arm}-${r.run}`);
      return { label: `${r.arm} #${r.run}`, audit: join(dir, 'audit.jsonl'), graph: join(dir, 'graph.json') };
    })
    .filter((l) => existsSync(l.audit));
  if (laeufe.length) console.log('\n' + vergleichBericht(laeufe, process.env.GOLDEN) + '\n');
}

// CR-GC-609 — Schatten-graph_suggest: nur Laeufe, fuer die schatten-suggest.mjs gelaufen ist (kostet Dry-Runs,
// deshalb nicht Teil des Berichtslaufs selbst).
{
  const laeufe = rows
    .filter((r) => !r.error)
    .map((r) => ({ label: `${r.arm} #${r.run}`, pfad: join(HERE, 'runs', `${r.arm}-${r.run}`, 'schatten-suggest.json') }))
    .filter((l) => existsSync(l.pfad))
    .map((l) => ({ label: l.label, schatten: JSON.parse(readFileSync(l.pfad, 'utf8')) }));
  if (laeufe.length) console.log('\n' + schattenBericht(laeufe) + '\n');
}

console.log('\n## Limits (quote these with the numbers)\n');
console.log([
  '- One machine, one prompt, one domain — every number is conditional on that.',
  '- Two specific models/executors (qwen3.6-35b-a3b via opencode vs Opus 5 via Claude Code), NOT "local vs frontier" as categories — the executor differs too.',
  `- n = ${range(arms.map((a) => rows.filter((r) => r.arm === a && !r.error).length))} per arm → a range, never a confidence interval.`,
  '- compliance / gate-rejections are computed by graphcode rules — no AI judge in the scorer.',
  '- Module reuse is a hand-audited list, not a metric — name-matching could not measure semantic convergence.',
  '- The best-fit pick for Phase 2 is a human judgment, NOT part of any local-vs-frontier verdict.',
].join('\n'));
