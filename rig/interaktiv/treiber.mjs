#!/usr/bin/env node
/**
 * treiber.mjs — EIN Testtreiber für beide Arme des interaktiven Rigs (CR-GC-715, Leitlinie T-E3).
 *
 *   node rig/interaktiv/treiber.mjs <lokal|frontier> <lauf-nr> [--zuege=12] [--modell=claude-opus-5-5]
 *
 * Ein Lauf: frisches Repo aus der Vorlage → Start-Prompt → je Zug Antwort lesen, Simulator entscheidet die nächste
 * Nachricht (Antwortblatt vor Vorschlag) → Ende bei Freigabe oder Zuglimit. Artefakte unter
 * rig/interaktiv/runs/<arm>-<nr>/: lauf.json (Züge, Nachrichten, Antworten, Dauer, Werkzeuge, Audit je Zug),
 * denken.json, audit.jsonl, graph.json (Export des Hosts) — und eine Zeile mit Stempel in docs/messung/interaktiv.md.
 * Frontier: `GRAPHCODE_RIG_CLAUDE=<pfad>` wählt das CLI (Opus 5.5 braucht Claude Code >= 2.1.280).
 * Das Blindurteil danach: node rig/greenfield-systemtest/blindurteil.mjs vorbereiten <ziel> runs/… --raster=…
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { naechsteNachricht, ende } from './simulator.mjs';
import { kennzahlen, zeile, anhaengen, auditDelta } from './auswertung.mjs';
import { repoAnlegen, frontierRepo, lokal, frontier } from './arme.mjs';
import { openMeasured, stampLine } from '../../dist/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const KORPUS = join(HERE, 'korpus', 'todo.json');

const auditZeilen = (repo) => {
  const p = join(repo, '.graphcode', 'audit.jsonl');
  return existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean) : [];
};

export async function lauf(arm, nr, { zuege: maxZuege = 12, modell = 'claude-opus-5-5' } = {}) {
  const korpus = JSON.parse(readFileSync(KORPUS, 'utf8'));
  const dir = join(HERE, 'runs', `${arm}-${nr}`);
  if (existsSync(dir)) throw new Error(`${dir} gibt es schon — ein Lauf wird nicht überschrieben`);
  mkdirSync(dir, { recursive: true });
  const repo = repoAnlegen(join(dir, 'todo'), 4800 + nr + (arm === 'frontier' ? 50 : 0));
  if (arm === 'frontier') frontierRepo(repo, 4850 + nr);
  const s = arm === 'lokal' ? await lokal(repo, 4900 + nr) : await frontier(repo, modell);

  const protokoll = [];
  let nachricht = korpus.start, blattGegeben = false, gebaut = false, grund = null;
  try {
    for (let zug = 1; !grund; zug++) {
      const vorher = auditZeilen(repo).length;
      const r = await s.zug(nachricht);
      const audit = auditDelta(auditZeilen(repo).slice(vorher));
      gebaut ||= audit.angenommen > 0;
      protokoll.push({ zug, nachricht, ...r, audit });
      writeFileSync(join(dir, 'lauf.json'), JSON.stringify({ arm, nr, zuege: protokoll }, null, 1));
      console.log(`[${arm}-${nr}] Zug ${zug}: ${(r.dauerMs / 60_000).toFixed(1)} min, ${r.werkzeuge.length} Schritte, +${audit.angenommen}/-${audit.abgelehnt}, Vorschlag: ${r.vorschlag ?? '—'}`);
      grund = ende(zug, maxZuege, nachricht);
      if (grund) break;
      const n = naechsteNachricht({ antwort: r.text, vorschlag: r.vorschlag, blattGegeben, antwortblatt: korpus.antwortblatt, gebaut });
      nachricht = n.nachricht;
      blattGegeben = n.blattGegeben;
    }
  } finally {
    writeFileSync(join(dir, 'denken.json'), JSON.stringify(s.denken(), null, 1));
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

  const ergebnis = { arm, nr, modell: s.modell, stempel, ende: grund, graph, zuege: protokoll };
  writeFileSync(join(dir, 'lauf.json'), JSON.stringify(ergebnis, null, 1));
  anhaengen(zeile(new Date().toISOString().slice(0, 10), ergebnis, kennzahlen(ergebnis)));
  return ergebnis;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
  const [arm, nr] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!['lokal', 'frontier'].includes(arm) || !Number.isInteger(Number(nr))) {
    console.error('node rig/interaktiv/treiber.mjs <lokal|frontier> <lauf-nr> [--zuege=12] [--modell=claude-opus-5-5]');
    process.exit(1);
  }
  const e = await lauf(arm, Number(nr), { zuege: Number(flags.zuege ?? 12), modell: flags.modell ?? 'claude-opus-5-5' });
  console.log(`[${arm}-${nr}] Ende: ${e.ende} nach ${e.zuege.length} Zügen · ${e.stempel}`);
}
