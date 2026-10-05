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
 * Dauer, Werkzeugen, Audit, Gates), denken.json, audit.jsonl, graph.json (Export des Hosts), das Lauf-Repo — und eine
 * Zeile mit Stempel in docs/messung/interaktiv.md. Der Stand nennt neben dem Code-Stand von graphcode den Commit der
 * Vorlage, weil der Prompt dort lebt.
 * Frontier: `GRAPHCODE_RIG_CLAUDE=<pfad>` wählt das CLI (Opus 5.5 braucht Claude Code >= 2.1.280).
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { naechsteNachricht, ende, analyseIn, sitzungswechsel, aufgabeLaden } from './simulator.mjs';
import { kennzahlen, zeile, anhaengen, auditDelta, nachspielen } from './auswertung.mjs';
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
  // Nur verfolgte Änderungen zählen — ein neues, noch nicht committetes Verzeichnis ändert den gemessenen Code nicht.
  const dirty = git('status', '--porcelain', '--untracked-files=no', '--', '..').length > 0;
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
 * Stufe `modellieren`: Züge bis SRR und PDR bestanden. `lage` trägt, was alle Stufen teilen: Repo, Client-Fabrik,
 * Aufgabe, Grenzen, Protokoll und das Denken; die Stufe hängt ihre Züge an und gibt den Grund des Endes zurück.
 */
async function modellieren(lage) {
  const { repo, oeffnen, aufgabe, maxZuege, jeSitzung, protokoll, denken, kennung, nr } = lage;
  let s = await oeffnen(), sitzung = 1, thema = null, zugInSitzung = 0;
  let nachricht = aufgabe.start, blattGegeben = false, gebaut = false, grund = null, gates = {}, letzterVorschlag = null;
  lage.modell = s.modell;
  try {
    for (let zug = 1; ; zug++) {
      const vorher = auditZeilen(repo).length;
      const r = await s.zug(nachricht);
      zugInSitzung++;
      letzterVorschlag = r.vorschlag ?? letzterVorschlag;
      const audit = auditDelta(auditZeilen(repo).slice(vorher));
      gebaut ||= audit.angenommen > 0;
      if (audit.angenommen > 0) gates = (await nachspielen(join(repo, '.graphcode', 'audit.jsonl'), repo)).gates;
      protokoll.push({ zug, stufe: 'modellieren', sitzung, nachricht, ...r, audit, gates });
      lage.schreiben();
      console.log(`[${kennung}-${nr}] Zug ${zug} (Sitzung ${sitzung}): ${(r.dauerMs / 60_000).toFixed(1)} min, ${r.werkzeuge.length} Schritte, +${audit.angenommen}/-${audit.abgelehnt}, Abbruch L${r.abbruch?.laenge ?? 0}/F${r.abbruch?.fehler ?? 0}, SRR ${gates.SRR ? '✓' : '·'} PDR ${gates.PDR ? '✓' : '·'}, Vorschlag: ${r.vorschlag ?? '—'}`);
      grund = ende(zug, maxZuege, nachricht, gates);
      if (grund) break;
      // Frische Sitzung: neues Thema laut Vorschlag, oder die Sitzung hat ihr Zuglimit erreicht.
      if (sitzungswechsel(thema, r.vorschlag) || zugInSitzung >= jeSitzung) {
        denken.push(...s.denken());
        lage.modell = s.modell;
        await s.ende();
        await hostWeg(repo);
        s = await oeffnen();
        sitzung++;
        // Die frische Sitzung beginnt mit dem letzten Vorschlag — ohne einen mit dem Start-Prompt.
        nachricht = letzterVorschlag ?? aufgabe.start;
        thema = analyseIn(nachricht);
        zugInSitzung = 0;
        blattGegeben = false;
        continue;
      }
      const n = naechsteNachricht({ antwort: r.text, vorschlag: r.vorschlag, blattGegeben, antwortblatt: aufgabe.antwortblatt, gebaut });
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

/** Die Stufen, die eine Sequenz nennen darf. Eine neue Stufe kommt hier dazu — und nirgends sonst. */
export const STUFEN = { modellieren };

export async function lauf(arm, nr, { aufgabe: aufgabeName = 'todo', zuege: maxZuege = 30, jeSitzung = 8, modell = null, kennung = arm } = {}) {
  const aufgabe = aufgabeLaden(aufgabeName);
  for (const st of aufgabe.sequenz) if (!STUFEN[st]) throw new Error(`Aufgabe ${aufgabeName}: Stufe „${st}" kennt der Treiber nicht (${Object.keys(STUFEN).join(', ')})`);
  const dir = join(RUNS, aufgabeName, `${kennung}-${nr}`);
  if (existsSync(dir)) throw new Error(`${dir} gibt es schon — ein Lauf wird nicht überschrieben`);
  mkdirSync(dir, { recursive: true });
  const repo = repoAnlegen(join(dir, 'todo'), 4800 + nr + (arm === 'frontier' ? 50 : 0), arm === 'lokal' ? modell : null);
  if (arm === 'frontier') frontierRepo(repo, 4850 + nr);
  const oeffnen = () => (arm === 'lokal' ? lokal(repo, 4900 + nr) : frontier(repo, modell ?? 'claude-opus-5-5'));

  const protokoll = [], denken = [], st = stand();
  const kopf = { arm: kennung, nr, aufgabe: aufgabeName, sequenz: aufgabe.sequenz, stand: st };
  const lage = { repo, oeffnen, aufgabe, maxZuege, jeSitzung, protokoll, denken, kennung, nr, modell: null, sitzungen: 0,
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

  // Der Host exportiert beim Beenden (auto-export); gemessen wird der Export, nie der Store.
  await new Promise((r) => setTimeout(r, 3000));
  const exporte = existsSync(join(repo, 'docs', 'graph')) ? readdirSync(join(repo, 'docs', 'graph')).filter((f) => f.endsWith('.graph.json')) : [];
  let graph = null, stempel = 'graph —';
  if (exporte.length === 1) {
    copyFileSync(join(repo, 'docs', 'graph', exporte[0]), join(dir, 'graph.json'));
    const m = await openMeasured({ graph: resolve(dir, 'graph.json'), systemId: 'todo', configFrom: repo });
    try {
      stempel = `${stampLine(m.provenance).replace(`${dir}/`, '')} · vorlage ${st.vorlage}`;
      graph = { elements: m.provenance.graph.elements, traces: m.provenance.graph.traces };
    } finally {
      await m.close();
    }
  }
  if (existsSync(join(repo, '.graphcode', 'audit.jsonl'))) copyFileSync(join(repo, '.graphcode', 'audit.jsonl'), join(dir, 'audit.jsonl'));

  const ergebnis = { ...kopf, modell: lage.modell, stempel, ende: grund, sitzungen: lage.sitzungen, graph, zuege: protokoll };
  writeFileSync(join(dir, 'lauf.json'), JSON.stringify(ergebnis, null, 1));
  anhaengen(zeile(new Date().toISOString().slice(0, 10), ergebnis, kennzahlen(ergebnis)));
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
      for (const o of offen) await lauf(o.arm, o.nr, { aufgabe: o.aufgabe, zuege: serie.zuege, jeSitzung: serie.sitzung, modell: o.modell, kennung: o.kennung });
    }
  } else if (worte[0] === 'referenz') {
    if (!worte[1]) usage();
    console.log(`Referenz: ${referenzSetzen(resolve(worte[1]))}`);
  } else {
    const [arm, nr] = worte;
    if (!['lokal', 'frontier'].includes(arm) || !Number.isInteger(Number(nr))) usage();
    const e = await lauf(arm, Number(nr), { aufgabe: flags.aufgabe ?? 'todo', zuege: Number(flags.zuege ?? 30), jeSitzung: Number(flags.sitzung ?? 8), modell: flags.modell ?? null, kennung: flags.arm ?? arm });
    console.log(`[${e.arm}-${nr}] Ende: ${e.ende} nach ${e.zuege.length} Zügen · ${e.stempel}`);
  }
}
