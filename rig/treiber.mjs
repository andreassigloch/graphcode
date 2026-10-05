#!/usr/bin/env node
/**
 * treiber.mjs — EIN Treiber für das Rig (CR-GC-715, CR-GC-738; Leitlinie T-E3, §9.4).
 *
 *   node rig/treiber.mjs <lokal|frontier> <nr> [--aufgabe=todo] [--zuege=30] [--sitzung=8] [--modell=<id>] [--arm=<kennung>]
 *   node rig/treiber.mjs serie [--plan]        das Standard-Set (serie.json): fährt, was für den heutigen Stand fehlt
 *   node rig/treiber.mjs referenz <lauf-dir>   macht einen Lauf zum Referenzlauf seiner Aufgabe × Arm (tauscht den alten)
 *
 * `--aufgabe`: ein Verzeichnis unter rig/aufgaben/ (start.md, antwortblatt.md, punkte.json, aufgabe.json).
 * `--modell`: lokal eine Modell-ID des Gateways (Vorgabe: das Modell der Vorlage), frontier die Claude-Modell-ID.
 * `--arm`: Kennung für Lauf-Ordner und Tabelle (Vorgabe: lokal/frontier), z. B. `lokal-nvfp4`.
 *
 * Ein Lauf: frisches Repo aus der Vorlage → die Stufen der Sequenz der Aufgabe (`aufgabe.sequenz`, heute nur
 * `modellieren`). Modellieren: Start-Prompt → je Zug Antwort lesen, Simulator entscheidet die nächste Nachricht
 * (Antwortblatt vor Vorschlag); Ende, sobald die Readiness SRR und PDR als bestanden meldet (geprüft nach jedem Zug
 * mit Mutation an einem Nachbau aus dem Audit), bei Freigabe oder Zuglimit. Eine Analyse bekommt eine frische Sitzung
 * (neuer Client-Prozess, derselbe Store), ebenso die Rückkehr zur Strukturarbeit; `--sitzung` begrenzt die Züge je
 * Sitzung. Eine weitere Stufe (etwa Code aus dem Modell) ist eine Funktion in STUFEN — kein zweiter Treiber.
 *
 * Artefakte unter rig/runs/<aufgabe>/<arm>-<nr>/: lauf.json (Stand, Züge mit Stufe, Sitzung, Nachricht, Antwort,
 * Dauer, Werkzeugen, Audit, Gates), denken.json, audit.jsonl, graph.json (Export des Hosts), das Lauf-Repo. Der Treiber
 * rechnet nichts außer dem Ende; die Datensätze schreibt `auswertung/auswerten.mjs` (nach `serie` automatisch). Der
 * Stand nennt neben dem Code-Stand von graphcode den Commit der Vorlage, weil der Prompt dort lebt.
 * Frontier: `GRAPHCODE_RIG_CLAUDE=<pfad>` wählt das CLI (Opus 5.5 braucht Claude Code >= 2.1.280).
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { naechsteNachricht, ende, ZIEL, zielText, analyseIn, sitzungswechsel, aufgabeLaden, AUFGABEN } from './simulator.mjs';
import { auditDelta } from '../auswertung/kennzahlen.mjs';
import { nachspielen } from '../auswertung/nachspielen.mjs';
import { repoAnlegen, frontierRepo, lokal, frontier, vorlageStand } from './arme.mjs';
import { openMeasured, stampLine } from '../dist/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const RUNS = join(HERE, 'runs');
export const SERIE = join(HERE, 'serie.json');
/** Die Artefakte eines Laufs, die als Referenz ins Repo gehen (das Lauf-Repo bleibt draußen). */
export const REFERENZ_DATEIEN = ['graph.json', 'audit.jsonl', 'lauf.json', 'denken.json'];

/** Code-Stand von graphcode und Commit der Vorlage — der Stand, gegen den `serie` Fehlendes zählt. */
export function stand() {
  const git = (...a) => execFileSync('git', a, { cwd: HERE, encoding: 'utf8' }).trim();
  // Nur verfolgte Änderungen am Code zählen — ein neues, noch nicht committetes Verzeichnis ändert den gemessenen Code
  // nicht, und docs/ (Benchmark, Modell-Export) schreibt die Auswertung zwischen zwei Läufen.
  const dirty = git('status', '--porcelain', '--untracked-files=no', '--', '..', ':(exclude,top)docs').length > 0;
  return { code: git('rev-parse', '--short', 'HEAD') + (dirty ? '+dirty' : ''), vorlage: vorlageStand() };
}

/** Bis der Host der alten Sitzung weg ist — der nächste Client wählt sonst einen sterbenden Host. */
const hostWeg = async (repo, ms = 30_000) => {
  const lock = join(repo, '.graphcode', 'owner.lock');
  const lebt = () => {
    if (!existsSync(lock)) return false;
    try { process.kill(JSON.parse(readFileSync(lock, 'utf8')).pid, 0); return true; } catch { return false; }
  };
  for (const bis = Date.now() + ms; lebt(); ) {
    if (Date.now() > bis) throw new Error(`${repo}: Host der alten Sitzung lebt nach ${ms} ms noch`);
    await new Promise((r) => setTimeout(r, 500));
  }
};

const auditZeilen = (repo) => {
  const p = join(repo, '.graphcode', 'audit.jsonl');
  return existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean) : [];
};

/**
 * Eine Stufe: Züge, bis ihr Ziel (simulator.ZIEL) am Nachbau aus dem Audit erreicht ist. `lage` trägt, was alle Stufen
 * teilen: Repo, Client-Fabrik, Aufgabe, Basis, Grenzen, Protokoll und das Denken; die Stufe hängt ihre Züge an und
 * gibt den Grund des Endes zurück. Die erste Stufe beginnt mit start.md, jede weitere mit `<stufe>.md` der Aufgabe.
 */
async function stufe(name, lage) {
  const { repo, oeffnen, aufgabe, maxZuege, jeSitzung, protokoll, denken, kennung, nr } = lage;
  const zuegeVorher = protokoll.length;
  const start = zuegeVorher === 0 ? aufgabe.start : aufgabe.stufenPrompt(name);
  if (!start) throw new Error(`Aufgabe ${aufgabe.name}: Stufe „${name}" folgt auf eine andere und braucht ${name}.md`);
  let s = await oeffnen(), sitzung = 1, thema = null, zugInSitzung = 0, leerlauf = 0;
  let nachricht = start, blattGegeben = false, gebaut = false, grund = null, gates = {}, befund = null, letzterVorschlag = null;
  lage.modell = s.modell;
  try {
    for (let zug = zuegeVorher + 1; ; zug++) {
      const vorher = auditZeilen(repo).length;
      const r = await s.zug(nachricht);
      zugInSitzung++;
      const audit = auditDelta(auditZeilen(repo).slice(vorher));
      gebaut ||= audit.angenommen > 0;
      leerlauf = audit.angenommen > 0 ? 0 : leerlauf + 1;
      // Der Stand am Nachbau: nach jeder Mutation, und einmal vorab, wenn der Lauf auf einer Basis beginnt.
      if (audit.angenommen > 0 || (befund === null && lage.basis)) ({ gates, befund } = await nachspielen(join(repo, '.graphcode', 'audit.jsonl'), repo, Infinity, { basis: lage.basis }));
      const erreicht = ZIEL[name](gates, befund);
      // Der Nutzer entscheidet seine nächste Nachricht — die Entscheidung steht am Zug, auf den sie antwortet.
      const n = naechsteNachricht({ antwort: r.text, vorschlag: r.vorschlag, blattGegeben, antwortblatt: aufgabe.antwortblatt, antworten: aufgabe.antworten,
        gebaut, politik: aufgabe.politik, ziel: { erreicht: Boolean(erreicht), text: zielText(name, befund) } });
      letzterVorschlag = n.vorschlag ?? letzterVorschlag;
      protokoll.push({ zug, stufe: name, sitzung, nachricht, ...r, audit, gates, befund, simulator: n.entscheidungen });
      lage.schreiben();
      console.log(`[${kennung}-${nr}] Zug ${zug} (Sitzung ${sitzung}): ${(r.dauerMs / 60_000).toFixed(1)} min, ${r.werkzeuge.length} Schritte, +${audit.angenommen}/-${audit.abgelehnt}, Abbruch L${r.abbruch?.laenge ?? 0}/F${r.abbruch?.fehler ?? 0}, SRR ${gates.SRR ? '✓' : '·'} PDR ${gates.PDR ? '✓' : '·'}, F${befund?.fehler ?? '·'}/W${befund?.warnungen ?? '·'}${befund?.abgenommen ? ` (abgenommen ${befund.abgenommen})` : ''}, Vorschlag: ${r.vorschlag ?? '—'} → Nutzer: ${n.entscheidungen.map((e) => e.art).join('+')}`);
      grund = ende(zug - zuegeVorher, maxZuege, nachricht, erreicht, leerlauf);
      if (grund) break;
      // Frische Sitzung: der abgeschickte Vorschlag hat ein neues Thema, oder die Sitzung hat ihr Zuglimit erreicht.
      if (sitzungswechsel(thema, n.vorschlag) || zugInSitzung >= jeSitzung) {
        denken.push(...s.denken());
        lage.modell = s.modell;
        await s.ende();
        await hostWeg(repo);
        s = await oeffnen();
        sitzung++;
        // Die frische Sitzung beginnt mit dem letzten abgeschickten Vorschlag — ohne einen mit dem Start-Prompt der Stufe.
        nachricht = letzterVorschlag ?? start;
        thema = analyseIn(nachricht);
        zugInSitzung = 0;
        blattGegeben = false;
        continue;
      }
      nachricht = n.nachricht;
      blattGegeben = n.blattGegeben;
    }
  } finally {
    denken.push(...s.denken());
    lage.modell = s.modell ?? lage.modell;
    lage.sitzungen = (lage.sitzungen ?? 0) + sitzung;
    await s.ende();
  }
  return grund;
}

/** Die Stufen, die eine Sequenz nennen darf; ihr Ziel steht in simulator.ZIEL. Eine neue Stufe kommt hier dazu — und nirgends sonst. */
export const STUFEN = { modellieren: (lage) => stufe('modellieren', lage), warnungsfrei: (lage) => stufe('warnungsfrei', lage) };

export async function lauf(arm, nr, { aufgabe: aufgabeName = 'todo', zuege: maxZuege = 30, jeSitzung = 8, modell = null, kennung = arm, stand: st = stand() } = {}) {
  const aufgabe = aufgabeLaden(aufgabeName);
  for (const st of aufgabe.sequenz) if (!STUFEN[st]) throw new Error(`Aufgabe ${aufgabeName}: Stufe „${st}" kennt der Treiber nicht (${Object.keys(STUFEN).join(', ')})`);
  const dir = join(RUNS, aufgabeName, `${kennung}-${nr}`);
  if (existsSync(dir)) throw new Error(`${dir} gibt es schon — ein Lauf wird nicht überschrieben`);
  mkdirSync(dir, { recursive: true });
  const repo = repoAnlegen(join(dir, 'todo'), 4800 + nr + (arm === 'frontier' ? 50 : 0), arm === 'lokal' ? modell : null);
  if (arm === 'frontier') frontierRepo(repo, 4850 + nr);
  // Basis: der Host seedet beim ersten Start aus docs/graph/<systemId>.graph.json — der Lauf beginnt auf diesem Graphen.
  if (aufgabe.basis) {
    mkdirSync(join(repo, 'docs', 'graph'), { recursive: true });
    copyFileSync(aufgabe.basis, join(repo, 'docs', 'graph', `${basename(repo)}.graph.json`));
  }
  const oeffnen = () => (arm === 'lokal' ? lokal(repo, 4900 + nr) : frontier(repo, modell ?? 'claude-opus-5-5'));

  const protokoll = [], denken = [];
  const kopf = { arm: kennung, nr, aufgabe: aufgabeName, sequenz: aufgabe.sequenz, stand: st, ...(aufgabe.basis ? { basis: relative(AUFGABEN, aufgabe.basis) } : {}) };
  const lage = { repo, oeffnen, aufgabe, basis: aufgabe.basis, maxZuege, jeSitzung, protokoll, denken, kennung, nr, modell: null, sitzungen: 0,
    schreiben: () => writeFileSync(join(dir, 'lauf.json'), JSON.stringify({ ...kopf, zuege: protokoll }, null, 1)) };
  let grund = null;
  try {
    for (const stufe of aufgabe.sequenz) {
      grund = await STUFEN[stufe](lage);
      console.log(`[${kennung}-${nr}] Stufe ${stufe}: ${grund}`);
    }
  } finally {
    writeFileSync(join(dir, 'denken.json'), JSON.stringify(denken, null, 1));
  }

  // Der Host exportiert beim Beenden (auto-export); gemessen wird der Export, nie der Store. Erst warten, bis der
  // letzte Host weg ist — sonst ist der Export der einer früheren Sitzung (frontier-1 am 2026-10-05: Export v4,
  // Audit v10, EXPORT_PENDING). Ist der Export trotzdem älter als das Audit, zählt das Audit: der Graph wird aus
  // ihm nachgebaut (nachspielen, echtes Gate) und als `graphQuelle: nachspiel` ausgewiesen.
  await hostWeg(repo).catch((e) => console.log(`[${kennung}-${nr}] ${e.message}`));
  await new Promise((r) => setTimeout(r, 3000));
  if (existsSync(join(repo, '.graphcode', 'audit.jsonl'))) copyFileSync(join(repo, '.graphcode', 'audit.jsonl'), join(dir, 'audit.jsonl'));
  const exporte = existsSync(join(repo, 'docs', 'graph')) ? readdirSync(join(repo, 'docs', 'graph')).filter((f) => f.endsWith('.graph.json')) : [];
  const letzteVersion = Math.max(0, ...auditZeilen(repo).map((l) => JSON.parse(l)).filter((a) => a.operation === 'mutate' && a.result === 'applied').map((a) => a.graphVersion ?? 0));
  let graph = null, stempel = 'graph —', graphQuelle = 'export';
  if (exporte.length === 1 && JSON.parse(readFileSync(join(repo, 'docs', 'graph', exporte[0]), 'utf8')).graphVersion === letzteVersion) {
    copyFileSync(join(repo, 'docs', 'graph', exporte[0]), join(dir, 'graph.json'));
  } else if (existsSync(join(dir, 'audit.jsonl'))) {
    const nb = await nachspielen(join(dir, 'audit.jsonl'), repo, Infinity, { basis: aufgabe.basis });
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({ ...nb.flach, graphVersion: letzteVersion }, null, 1));
    graphQuelle = 'nachspiel';
    console.log(`[${kennung}-${nr}] Export fehlt oder veraltet (${exporte.length ? 'v' + JSON.parse(readFileSync(join(repo, 'docs', 'graph', exporte[0]), 'utf8')).graphVersion : 'kein Export'} gegen Audit v${letzteVersion}) — graph.json aus dem Audit nachgebaut`);
  }
  if (existsSync(join(dir, 'graph.json'))) {
    const m = await openMeasured({ graph: resolve(dir, 'graph.json'), systemId: 'todo', configFrom: repo });
    try {
      stempel = `${stampLine(m.provenance).replace(`${dir}/`, '')} · vorlage ${st.vorlage}`;
      graph = { elements: m.provenance.graph.elements, traces: m.provenance.graph.traces };
    } finally {
      await m.close();
    }
  }

  const ergebnis = { ...kopf, modell: lage.modell, stempel, ende: grund, sitzungen: lage.sitzungen, graph, graphQuelle, zuege: protokoll, dir };
  writeFileSync(join(dir, 'lauf.json'), JSON.stringify({ ...ergebnis, dir: undefined }, null, 1));
  return ergebnis;
}

/** Rein: welche Läufe das Standard-Set für diesen Stand noch braucht — aus serie.json und den vorhandenen lauf.json. */
export function fehlendeLaeufe(serie, vorhanden, st) {
  const offen = [];
  for (const aufgabe of serie.aufgaben) {
    for (const a of serie.arme) {
      const kennung = a.kennung ?? a.arm;
      const passend = vorhanden.filter((l) => l.aufgabe === aufgabe && l.arm === kennung && l.stand?.code === st.code && l.stand?.vorlage === st.vorlage && l.ende);
      const nummern = vorhanden.filter((l) => l.aufgabe === aufgabe && l.arm === kennung).map((l) => l.nr);
      let nr = Math.max(0, ...nummern);
      for (let i = passend.length; i < serie.n; i++) offen.push({ arm: a.arm, kennung, modell: a.modell ?? null, aufgabe, nr: ++nr });
    }
  }
  return offen;
}

function vorhandeneLaeufe() {
  const out = [];
  if (!existsSync(RUNS)) return out;
  for (const aufgabe of readdirSync(RUNS, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const d of readdirSync(join(RUNS, aufgabe.name))) {
      const p = join(RUNS, aufgabe.name, d, 'lauf.json');
      // Läufe vor CR-GC-738 tragen keine Aufgabe — das Verzeichnis sagt sie; ihre Nummern bleiben vergeben.
      if (existsSync(p)) out.push({ aufgabe: aufgabe.name, ...JSON.parse(readFileSync(p, 'utf8')) });
    }
  }
  return out;
}

/** Einen Lauf zum Referenzlauf machen: die vier Artefakte und sein Stempel nach aufgaben/<aufgabe>/referenz/<arm>/. */
export function referenzSetzen(laufDir, aufgabenRoot = join(HERE, 'aufgaben')) {
  const l = JSON.parse(readFileSync(join(laufDir, 'lauf.json'), 'utf8'));
  if (!l.aufgabe || !l.ende) throw new Error(`${laufDir}: kein abgeschlossener Lauf mit Aufgabe`);
  for (const f of REFERENZ_DATEIEN) if (!existsSync(join(laufDir, f))) throw new Error(`${laufDir}: ${f} fehlt — kein vollständiger Lauf`);
  const ziel = join(aufgabenRoot, l.aufgabe, 'referenz', l.arm);
  rmSync(ziel, { recursive: true, force: true });
  mkdirSync(ziel, { recursive: true });
  for (const f of REFERENZ_DATEIEN) copyFileSync(join(laufDir, f), join(ziel, f));
  writeFileSync(join(ziel, 'stempel.json'), JSON.stringify({ lauf: basename(laufDir), stempel: l.stempel, stand: l.stand, modell: l.modell, ende: l.ende, gesetzt: new Date().toISOString().slice(0, 10) }, null, 1) + '\n');
  return ziel;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
  const worte = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const usage = () => { console.error(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(4, 7).join('\n').replace(/^ \* {3}/gm, '')); process.exit(1); };
  if (worte[0] === 'serie') {
    const offen = fehlendeLaeufe(JSON.parse(readFileSync(SERIE, 'utf8')), vorhandeneLaeufe(), stand());
    for (const o of offen) console.log(`${'plan' in flags ? 'fehlt' : 'fahre'}: ${o.aufgabe} ${o.kennung}-${o.nr}${o.modell ? ` (${o.modell})` : ''}`);
    if (!('plan' in flags)) {
      const serie = JSON.parse(readFileSync(SERIE, 'utf8'));
      // EIN Stand für die ganze Serie: der Code ist beim Start geladen, was danach im Arbeitsbaum passiert, fährt nicht mit.
      const st = stand();
      const gefahren = [];
      for (const o of offen) gefahren.push((await lauf(o.arm, o.nr, { aufgabe: o.aufgabe, zuege: serie.zuege, jeSitzung: serie.sitzung, modell: o.modell, kennung: o.kennung, stand: st })).dir);
      // Die Serie endet mit ihren Datensätzen — ohne Zeile im laufenden Dokument ist ein Lauf nicht gemessen.
      const { auswertenLauf, lesen, upsert, rendern, JSONL, MD } = await import('../auswertung/auswerten.mjs');
      let saetze = lesen();
      for (const d of gefahren) saetze = upsert(saetze, await auswertenLauf(d));
      writeFileSync(JSONL, saetze.map((x) => JSON.stringify(x)).join('\n') + '\n');
      writeFileSync(MD, rendern(saetze));
      console.log(`${gefahren.length} Läufe ausgewertet → docs/messung/benchmark.md`);
    }
  } else if (worte[0] === 'referenz') {
    if (!worte[1]) usage();
    console.log(`Referenz: ${referenzSetzen(resolve(worte[1]))}`);
  } else {
    const [arm, nr] = worte;
    if (!['lokal', 'frontier'].includes(arm) || !Number.isInteger(Number(nr))) usage();
    const e = await lauf(arm, Number(nr), { aufgabe: flags.aufgabe ?? 'todo', zuege: Number(flags.zuege ?? 30), jeSitzung: Number(flags.sitzung ?? 8), modell: flags.modell ?? null, kennung: flags.arm ?? arm });
    console.log(`[${e.arm}-${nr}] Ende: ${e.ende} nach ${e.zuege.length} Zügen · ${e.stempel}\nAuswerten: node auswertung/auswerten.mjs ${e.dir}`);
  }
}
