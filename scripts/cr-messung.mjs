#!/usr/bin/env node
/**
 * cr-messung.mjs — KPI 1 fuer jeden CR, der geschlossen wird, ohne dass jemand daran denkt (CR-GC-639).
 *
 * WARUM. Die Frage „fragt der Agent den Graphen, oder greppt er?" ist die Zusage dieses Repos, und
 * sie war nur gemessen, wenn jemand eine Retro machte oder ein bezahltes Rig fuhr. Hier wird sie nach
 * JEDEM CR-Abschluss gemessen — kostenlos, an echter Arbeit, mit echter Streuung. Der Preis ist die
 * fehlende Kontrollgruppe: die Reihe zeigt Verlaeufe (vorher/nachher `se-umbau`), keine Ursachen.
 *
 * WIE.
 *   1. welche CRs schliesst der Commit? — Umbenennung open → done, oder Ankunft in done/
 *   2. welches Protokoll? — jede Claude-Code-Sitzung dieses Repos, die die CR-ID nennt
 *   3. welches Fenster? — ab der ersten Nennung der ID bis zum Ende (`fensterFuer`)
 *   4. gezaehlt wird in `retro-kpi.mjs` — EINE Zaehlung, keine zweite hier
 *   5. eine Zeile nach `.graphcode/cr-messung.jsonl` (lokal, Messdaten, nicht SSOT)
 *
 * Laeuft als `post-commit` (scripts/githooks) und wirft NIE: eine Messung, die einen Commit
 * stoert, wird abgeschaltet, und dann misst sie nichts mehr.
 *
 * Aufruf:  node scripts/cr-messung.mjs --commit HEAD
 *          node scripts/cr-messung.mjs CR-GC-630 CR-GC-631
 *          [--repo <dir>] [--protokolle <dir>]   (Tests)
 *
 * @author andreas@siglochconsulting
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeKpis, fensterFuer, leseProtokoll, werkzeugNutzung } from './retro-kpi.mjs';

/** Wo Claude Code die Protokolle eines Repos ablegt: der Pfad mit `/` → `-`. */
export function protokollVerzeichnis(repo) {
  return join(homedir(), '.claude', 'projects', repo.replace(/\//g, '-'));
}

/**
 * Die CR-IDs, die ein Commit schliesst. Zwei Formen, beide echt:
 *   R  docs/cr/open/X → docs/cr/done/X   — der CR war offen eingecheckt
 *   A  docs/cr/done/X                     — der CR aus `dispatch prepare` lag nie eingecheckt in
 *                                           open/, git sieht nur die Ankunft in done/
 * Gemessen an den acht Abschluessen vom 2026-09-23: 5 × A, 3 × R. Die erste Fassung hoerte nur
 * auf R und haette die Mehrheit verpasst.
 */
export function geschlosseneCrs(nameStatus) {
  const ids = [];
  for (const zeile of nameStatus.split('\n')) {
    const m =
      /^R\d*\tdocs\/cr\/open\/[^\t]+\tdocs\/cr\/done\/((?:[A-Z]+-)+\d+)/.exec(zeile) ??
      /^A\tdocs\/cr\/done\/((?:[A-Z]+-)+\d+)/.exec(zeile);
    if (m) ids.push(m[1]);
  }
  return ids;
}

const git = (repo, args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 << 20 });

/** Wie viele Dateien haben die Commits dieses CR geloescht? >0 = ein Umbau, fuer die Auswertung. */
function geloeschteDateien(repo, crId) {
  try {
    return git(repo, ['log', `--grep=${crId}`, '--name-status', '--format=', '-M'])
      .split('\n').filter((z) => z.startsWith('D\t')).length;
  } catch { return null; }
}

/** Eine Zeile je (CR, Sitzung). Ohne Protokoll: eine Zeile, die das SAGT, statt zu schweigen. */
export function miss(crId, { repo, protokolle, commit = null, jetzt = new Date() }) {
  const kandidaten = existsSync(protokolle)
    ? readdirSync(protokolle).filter((f) => f.endsWith('.jsonl'))
        .map((f) => join(protokolle, f))
        .filter((p) => jetzt - statSync(p).mtime < 14 * 864e5)
        .filter((p) => readFileSync(p, 'utf8').includes(crId))
    : [];
  const basis = { cr: crId, commit, datum: jetzt.toISOString(), geloeschteDateien: geloeschteDateien(repo, crId) };
  if (kandidaten.length === 0) return [{ ...basis, sitzung: null, grund: 'kein Protokoll nennt die CR-ID (kein Claude-Code-Lauf, oder aelter als 14 Tage)' }];

  return kandidaten.map((p) => {
    const fenster = fensterFuer(leseProtokoll(p), crId);
    const n = werkzeugNutzung(fenster);
    const kpi1 = computeKpis({ toolUsage: n, audit: {}, readiness: {}, git: { netLoc: 0 }, plan: {}, binding: {} }).graphVsGrepRatio;
    return { ...basis, sitzung: p.split('/').pop().replace('.jsonl', ''), fensterSaetze: fenster.length, ...n, kpi1 };
  });
}

// --- main -------------------------------------------------------------------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const a = process.argv.slice(2);
    const opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
    const repo = opt('--repo') ?? git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
    const protokolle = opt('--protokolle') ?? protokollVerzeichnis(repo);
    const commit = opt('--commit');
    const optWerte = new Set(['--repo', '--protokolle', '--commit'].map(opt).filter(Boolean));
    const ids = commit
      ? geschlosseneCrs(git(repo, ['show', '--name-status', '-M', '--format=', commit]))
      : a.filter((x) => !x.startsWith('--') && !optWerte.has(x));
    if (ids.length === 0) process.exit(0);

    const sha = commit ? git(repo, ['rev-parse', '--short', commit]).trim() : null;
    mkdirSync(join(repo, '.graphcode'), { recursive: true });
    for (const id of ids) {
      for (const zeile of miss(id, { repo, protokolle, commit: sha })) {
        appendFileSync(join(repo, '.graphcode', 'cr-messung.jsonl'), JSON.stringify(zeile) + '\n');
        console.log(zeile.sitzung
          ? `[cr-messung] ${id}: KPI 1 = ${zeile.kpi1} · ${zeile.graphReads} Graph-Lesen · ${zeile.grepGlobDocReads} Suchen · ${zeile.volllaeufe} Volllaeufe`
          : `[cr-messung] ${id}: ${zeile.grund}`);
      }
    }
  } catch (e) {
    console.error(`[cr-messung] nicht gemessen: ${e.message}`);
  }
  process.exit(0);
}
