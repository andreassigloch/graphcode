#!/usr/bin/env node
/**
 * treiber.mjs — EIN Testtreiber für beide Arme des interaktiven Rigs (CR-GC-715, Leitlinie T-E3).
 *
 *   node rig/interaktiv/treiber.mjs <lokal|frontier> <lauf-nr> [--zuege=30] [--sitzung=8] [--modell=<id>] [--arm=<kennung>]
 *
 * `--modell`: lokal eine Modell-ID des Gateways (Vorgabe: das Modell der Vorlage), frontier die Claude-Modell-ID.
 * `--arm`: Kennung für Lauf-Ordner und Tabelle (Vorgabe: lokal/frontier), z. B. `lokal-nvfp4`.
 *
 * Ein Lauf: frisches Repo aus der Vorlage → Start-Prompt → je Zug Antwort lesen, Simulator entscheidet die nächste
 * Nachricht (Antwortblatt vor Vorschlag). Ende, sobald die Readiness SRR und PDR als bestanden meldet (geprüft nach
 * jedem Zug mit Mutation an einem Nachbau aus dem Audit), bei Freigabe oder Zuglimit. Eine Analyse bekommt eine
 * frische Sitzung (neuer Client-Prozess, derselbe Store), ebenso die Rückkehr zur Strukturarbeit; `--sitzung`
 * begrenzt die Züge je Sitzung. Artefakte unter rig/interaktiv/runs/<arm>-<nr>/: lauf.json (Züge mit Sitzung,
 * Nachricht, Antwort, Dauer, Werkzeugen, Audit, Gates), denken.json, audit.jsonl, graph.json (Export des Hosts) —
 * und eine Zeile mit Stempel in docs/messung/interaktiv.md.
 * Frontier: `GRAPHCODE_RIG_CLAUDE=<pfad>` wählt das CLI (Opus 5.5 braucht Claude Code >= 2.1.280).
 * Das Blindurteil danach: node rig/greenfield-systemtest/blindurteil.mjs vorbereiten <ziel> runs/… --raster=…
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { naechsteNachricht, ende, analyseIn, sitzungswechsel } from './simulator.mjs';
import { kennzahlen, zeile, anhaengen, auditDelta, nachspielen } from './auswertung.mjs';
import { repoAnlegen, frontierRepo, lokal, frontier } from './arme.mjs';
import { openMeasured, stampLine } from '../../dist/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const KORPUS = join(HERE, 'korpus', 'todo.json');

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

export async function lauf(arm, nr, { zuege: maxZuege = 30, jeSitzung = 8, modell = null, kennung = arm } = {}) {
  const korpus = JSON.parse(readFileSync(KORPUS, 'utf8'));
  const dir = join(HERE, 'runs', `${kennung}-${nr}`);
  if (existsSync(dir)) throw new Error(`${dir} gibt es schon — ein Lauf wird nicht überschrieben`);
  mkdirSync(dir, { recursive: true });
  const repo = repoAnlegen(join(dir, 'todo'), 4800 + nr + (arm === 'frontier' ? 50 : 0), arm === 'lokal' ? modell : null);
  if (arm === 'frontier') frontierRepo(repo, 4850 + nr);
  const oeffnen = () => (arm === 'lokal' ? lokal(repo, 4900 + nr) : frontier(repo, modell ?? 'claude-opus-5-5'));

  const protokoll = [], denken = [];
  let s = await oeffnen(), sitzung = 1, thema = null, zugInSitzung = 0;
  let nachricht = korpus.start, blattGegeben = false, gebaut = false, grund = null, gates = {}, letzterVorschlag = null;
  let modellId = s.modell;
  try {
    for (let zug = 1; ; zug++) {
      const vorher = auditZeilen(repo).length;
      const r = await s.zug(nachricht);
      zugInSitzung++;
      letzterVorschlag = r.vorschlag ?? letzterVorschlag;
      const audit = auditDelta(auditZeilen(repo).slice(vorher));
      gebaut ||= audit.angenommen > 0;
      if (audit.angenommen > 0) gates = (await nachspielen(join(repo, '.graphcode', 'audit.jsonl'), repo)).gates;
      protokoll.push({ zug, sitzung, nachricht, ...r, audit, gates });
      writeFileSync(join(dir, 'lauf.json'), JSON.stringify({ arm, nr, zuege: protokoll }, null, 1));
      console.log(`[${kennung}-${nr}] Zug ${zug} (Sitzung ${sitzung}): ${(r.dauerMs / 60_000).toFixed(1)} min, ${r.werkzeuge.length} Schritte, +${audit.angenommen}/-${audit.abgelehnt}, Abbruch L${r.abbruch?.laenge ?? 0}/F${r.abbruch?.fehler ?? 0}, SRR ${gates.SRR ? '✓' : '·'} PDR ${gates.PDR ? '✓' : '·'}, Vorschlag: ${r.vorschlag ?? '—'}`);
      grund = ende(zug, maxZuege, nachricht, gates);
      if (grund) break;
      // Frische Sitzung: neues Thema laut Vorschlag, oder die Sitzung hat ihr Zuglimit erreicht.
      if (sitzungswechsel(thema, r.vorschlag) || zugInSitzung >= jeSitzung) {
        denken.push(...s.denken());
        modellId = s.modell;
        await s.ende();
        await hostWeg(repo);
        s = await oeffnen();
        sitzung++;
        // Die frische Sitzung beginnt mit dem letzten Vorschlag — ohne einen mit dem Start-Prompt.
        nachricht = letzterVorschlag ?? korpus.start;
        thema = analyseIn(nachricht);
        zugInSitzung = 0;
        blattGegeben = false;
        continue;
      }
      const n = naechsteNachricht({ antwort: r.text, vorschlag: r.vorschlag, blattGegeben, antwortblatt: korpus.antwortblatt, gebaut });
      nachricht = n.nachricht;
      blattGegeben = n.blattGegeben;
    }
  } finally {
    denken.push(...s.denken());
    modellId = s.modell ?? modellId;
    writeFileSync(join(dir, 'denken.json'), JSON.stringify(denken, null, 1));
    await s.ende();
  }

  // Der Host exportiert beim Beenden (auto-export); gemessen wird der Export, nie der Store.
  await new Promise((r) => setTimeout(r, 3000));
  const exporte = existsSync(join(repo, 'docs', 'graph')) ? readdirSync(join(repo, 'docs', 'graph')).filter((f) => f.endsWith('.graph.json')) : [];
  let graph = null, stempel = 'graph —';
  if (exporte.length === 1) {
    copyFileSync(join(repo, 'docs', 'graph', exporte[0]), join(dir, 'graph.json'));
    const m = await openMeasured({ graph: resolve(dir, 'graph.json'), systemId: 'todo', configFrom: repo });
    try {
      stempel = stampLine(m.provenance).replace(`${dir}/`, '');
      graph = { elements: m.provenance.graph.elements, traces: m.provenance.graph.traces };
    } finally {
      await m.close();
    }
  }
  if (existsSync(join(repo, '.graphcode', 'audit.jsonl'))) copyFileSync(join(repo, '.graphcode', 'audit.jsonl'), join(dir, 'audit.jsonl'));

  const ergebnis = { arm: kennung, nr, modell: modellId, stempel, ende: grund, sitzungen: sitzung, graph, zuege: protokoll };
  writeFileSync(join(dir, 'lauf.json'), JSON.stringify(ergebnis, null, 1));
  anhaengen(zeile(new Date().toISOString().slice(0, 10), ergebnis, kennzahlen(ergebnis)));
  return ergebnis;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
  const [arm, nr] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!['lokal', 'frontier'].includes(arm) || !Number.isInteger(Number(nr))) {
    console.error('node rig/interaktiv/treiber.mjs <lokal|frontier> <lauf-nr> [--zuege=30] [--sitzung=8] [--modell=<id>] [--arm=<kennung>]');
    process.exit(1);
  }
  const e = await lauf(arm, Number(nr), { zuege: Number(flags.zuege ?? 30), jeSitzung: Number(flags.sitzung ?? 8), modell: flags.modell ?? null, kennung: flags.arm ?? arm });
  console.log(`[${e.arm}-${nr}] Ende: ${e.ende} nach ${e.zuege.length} Zügen · ${e.stempel}`);
}
