#!/usr/bin/env node
// aenderungs-heatmap — wo sich Code wiederholt ändert, über mehrere Repos (CR-GC-1028).
//
// Liest `git log -p` der Repos aus scripts/aenderungs-heatmap.config.json und misst je Einheit
// (MOD oder Verzeichnis), je Datei und je Symbol:
//   Nacharbeit   — Anteil der geschriebenen Zeilen, die ein anderer CR binnen `nachfassTage`
//                  wieder entfernt oder umschreibt (Zeilen ohne CR-Nummer zählen nicht)
//   Fix-Anteil   — Anteil der Commits mit Typ fix:
//   Themenbreite — Anzahl verschiedener CRs, die den Ort ändern
//   Mitänderung  — Anteil der CRs des Orts, die zugleich eine andere Einheit ändern
// Dazu ein Pareto der meistgeänderten Symbole (Funktion, Klasse, Konstante, Typ), die es heute noch gibt.
// Ein CR ist die erste CR-Nummer im Commit-Betreff; Commits ohne Nummer zählen als eigene Gruppe.
//
// Usage: node scripts/aenderungs-heatmap.mjs [--config <json>] [--out <html>] [--json <json>]
// @author andreas@siglochconsulting
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TAG = 86_400_000;
/**
 * git xfuncname: Definitionen auf oberster Ebene (Spalte 0) — function, class, const/let/var,
 * type, interface, enum. Gruppe 1 = ganze Zeile; git zeigt sie im Hunk-Kopf.
 */
export const XFUNC =
  '^((export[ \t]+)?(default[ \t]+)?(declare[ \t]+)?(async[ \t]+)?(function[*]?|class|const|let|var|type|interface|enum|abstract[ \t]+class)[ \t]+[A-Za-z0-9_$]+.*)$';
const DEF = new RegExp(XFUNC);
const NAME = /^(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|type|interface|enum|abstract\s+class)\s+([\w$]+)/;
const CR = /\b(?:BOK-)?CR-[A-Z]{2,}-\d+\b/g;
export const MODULEBENE = '(Modulebene)';
export const DATEI = '(Datei)';

/** Name der Definition in einer Codezeile, sonst null. */
export function symbolName(line) {
  if (!DEF.test(line)) return null;
  const m = line.match(NAME);
  return m ? m[1] : null;
}

/** `git log -p -U0 --format=%x01%h%x09%aI%x09%s` → Commits mit Dateien und Hunks. */
export function parseLog(text) {
  const commits = [];
  let c = null, f = null, h = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('\x01')) {
      const [hash, date, subject] = line.slice(1).split('\t');
      c = { hash, date, subject: subject ?? '', files: [] };
      commits.push(c); f = null; h = null;
    } else if (line.startsWith('diff --git ')) {
      const m = line.match(/^diff --git a\/(.*) b\/(.*)$/);
      f = { path: m ? m[2] : '', oldPath: null, hunks: [] };
      c?.files.push(f); h = null;
    } else if (!f) continue;
    else if (!h && line.startsWith('rename from ')) f.oldPath = line.slice(12);
    else if (!h && line.startsWith('rename to ')) f.path = line.slice(10);
    else if (!h && (line.startsWith('+++ ') || line.startsWith('--- '))) continue;
    else if (line.startsWith('@@')) {
      const m = line.match(/^@@[^@]*@@ ?(.*)$/);
      h = { header: m ? m[1] : '', lines: [] };
      f.hunks.push(h);
    } else if (h && (line[0] === '+' || line[0] === '-')) h.lines.push(line);
  }
  return commits;
}

/** Symbol je geänderter Zeile: die letzte Definition davor im Hunk, sonst die umschließende aus dem Hunk-Kopf. */
export function lineSymbols(path, hunk) {
  if (path.endsWith('.md')) return hunk.lines.map(() => DATEI);
  let cur = symbolName(hunk.header) ?? MODULEBENE;
  return hunk.lines.map((l) => (cur = symbolName(l.slice(1)) ?? cur));
}

/** Einheit eines Pfads: Config-Präfix, dann längster MOD-Pfad im Modell, sonst Verzeichnis. */
export function unitOf(path, repo, mods) {
  for (const [prefix, unit] of Object.entries(repo.einheiten ?? {})) if (path.startsWith(prefix)) return unit;
  const mod = mods
    .filter((m) => m.path && (path === m.path || path.startsWith(m.path.replace(/\/$/, '') + '/')))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (mod) return mod.id;
  const segs = path.split('/');
  return segs.slice(0, Math.min(repo.tiefe, segs.length - 1)).join('/') || '(Wurzel)';
}

/** Zeile, die für Nacharbeit zählt: nicht leer, nicht nur Klammern oder Satzzeichen. */
const zaehlt = (t) => t.length >= 4 && /[A-Za-z0-9]/.test(t);

/** Commits (neu → alt) → Ereignisse je (Commit, Datei); Umbenennungen auf den heutigen Pfad gezogen. */
export function toEvents(commits, repo, mods, cfg) {
  const alias = {};
  const cur = (p) => alias[p] ?? p;
  const ausschluss = new RegExp(cfg.ausschluss);
  const events = [];
  for (const c of commits) {
    const crs = c.subject.match(CR) ?? [];
    const type = (c.subject.match(/^(\w+)[:(!]/) ?? [])[1] ?? 'other';
    for (const f of c.files) {
      if (f.oldPath) alias[f.oldPath] = cur(f.path);
      const path = cur(f.path);
      if (!cfg.endungen.some((e) => path.endsWith(e)) || ausschluss.test(path)) continue;
      const lines = f.hunks.flatMap((h) => {
        const syms = lineSymbols(path, h);
        return h.lines.map((l, i) => ({ s: l[0], t: l.slice(1).trim(), sym: syms[i] }));
      });
      events.push({
        repo: repo.name, hash: c.hash, date: Date.parse(c.date), type, cr: crs[0] ?? null,
        file: path, unit: unitOf(path, repo, mods), lines,
      });
    }
  }
  return events;
}

/**
 * Nacharbeit je Zeile: eine entfernte Zeile, deren Text ein anderer CR binnen `tage` geschrieben hat.
 * Setzt an jedem Ereignis `added` und `reworked` je Symbol ({sym: [added, reworked]}).
 */
export function markRework(events, tage) {
  const byFile = new Map();
  for (const e of events) { const k = `${e.repo}:${e.file}`; (byFile.get(k) ?? byFile.set(k, []).get(k)).push(e); }
  for (const list of byFile.values()) {
    list.sort((a, b) => a.date - b.date);
    const recent = new Map(); // Text → [{date, cr, hash}]
    for (const e of list) {
      e.bySym = {};
      const part = (sym) => (e.bySym[sym] ??= [0, 0]);
      for (const l of e.lines) {
        if (l.s !== '-' || !zaehlt(l.t)) continue;
        const cand = recent.get(l.t);
        const i = cand?.findIndex((a) => e.date - a.date <= tage * TAG && a.hash !== e.hash) ?? -1;
        if (i < 0) continue;
        const [a] = cand.splice(i, 1);
        if (a.cr && e.cr && a.cr !== e.cr) part(l.sym)[1]++;
      }
      for (const l of e.lines) {
        if (l.s !== '+' || !zaehlt(l.t)) continue;
        part(l.sym)[0]++;
        (recent.get(l.t) ?? recent.set(l.t, []).get(l.t)).push({ date: e.date, cr: e.cr, hash: e.hash });
      }
      e.added = Object.values(e.bySym).reduce((a, p) => a + p[0], 0);
      e.reworked = Object.values(e.bySym).reduce((a, p) => a + p[1], 0);
    }
  }
  return events;
}

/** Aggregiert je Schlüssel; ein Commit zählt je Schlüssel einmal. `keysOf(e)` → [[key, added, reworked]]. */
export function aggregate(events, keysOf) {
  const out = new Map();
  for (const e of events) for (const [k, added, reworked] of keysOf(e)) {
    const s = out.get(k) ?? { hashes: new Set(), fixes: new Set(), crs: new Set(), added: 0, reworked: 0 };
    s.hashes.add(e.hash);
    if (e.type === 'fix') s.fixes.add(e.hash);
    if (e.cr) s.crs.add(e.cr);
    s.added += added; s.reworked += reworked;
    out.set(k, s);
  }
  return new Map([...out].map(([k, s]) => [k, {
    changes: s.hashes.size, fix: s.fixes.size, crs: s.crs.size, added: s.added, reworked: s.reworked,
  }]));
}

/** Gruppen (CR, sonst Commit) → Einheiten; Paarzählung und Mitänderung je Einheit. */
export function coChange(events) {
  const groups = new Map();
  for (const e of events) {
    const g = e.cr ?? `${e.repo}:${e.hash}`;
    (groups.get(g) ?? groups.set(g, new Set()).get(g)).add(`${e.repo}:${e.unit}`);
  }
  const pairs = new Map(), own = new Map(), shared = new Map(), crossRepo = new Map();
  for (const units of groups.values()) {
    const list = [...units];
    const repos = new Set(list.map((u) => u.split(':')[0]));
    for (const u of list) {
      own.set(u, (own.get(u) ?? 0) + 1);
      if (list.length > 1) shared.set(u, (shared.get(u) ?? 0) + 1);
      if (repos.size > 1) crossRepo.set(u, (crossRepo.get(u) ?? 0) + 1);
    }
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const k = [list[i], list[j]].sort().join('|');
      pairs.set(k, (pairs.get(k) ?? 0) + 1);
    }
  }
  const pair = (a, b) => (a === b ? own.get(a) ?? 0 : pairs.get([a, b].sort().join('|')) ?? 0);
  const partners = (u) => [...pairs].filter(([k, n]) => n >= 2 && k.split('|').includes(u)).length;
  return { pair, own, shared, crossRepo, partners, groupCount: groups.size };
}

/** FUNC-Zuordnung aus dem Modell: `repo:datei#symbol` (Skill-Dateien: `repo:datei#`) → FUNC-ids. */
export function funcIndex(repoName, elements) {
  const idx = new Map();
  for (const e of elements) {
    if (e.type !== 'FUNC' || !e.realRef?.file) continue;
    const md = e.realRef.file.endsWith('.md');
    const k = `${repoName}:${e.realRef.file}#${md ? '' : e.realRef.symbol ?? ''}`;
    idx.set(k, [...(idx.get(k) ?? []), e.id]);
  }
  return idx;
}

/** Liest die Repos aus der Config; liefert Ereignisse, heutige Dateien und FUNC-Index. */
export function readRepos(cfg, root, sinceIso) {
  const tmp = mkdtempSync(join(tmpdir(), 'aenderungs-heatmap-'));
  const attr = join(tmp, 'attributes');
  writeFileSync(attr, ['ts', 'tsx', 'mjs', 'js'].map((x) => `*.${x} diff=gcfn`).join('\n') + '\n');
  const events = [], repos = [], funcs = new Map(), existing = new Map();
  try {
    for (const repo of cfg.repos) {
      const dir = resolve(root, repo.pfad);
      const git = (...a) => execFileSync('git', ['-C', dir, ...a], { maxBuffer: 1 << 30 }).toString();
      const graphPath = join(dir, repo.graph);
      const elements = existsSync(graphPath) ? JSON.parse(readFileSync(graphPath, 'utf8')).elements : [];
      for (const [k, v] of funcIndex(repo.name, elements)) funcs.set(k, v);
      const log = git('-c', 'core.quotepath=off', '-c', `core.attributesFile=${attr}`, '-c', `diff.gcfn.xfuncname=${XFUNC}`,
        'log', '--no-merges', '-M', '-p', '-U0', '--no-color', `--since=${sinceIso}`,
        '--format=%x01%h%x09%aI%x09%s', '--', ...repo.quellen);
      const ev = toEvents(parseLog(log), repo, elements.filter((e) => e.type === 'MOD'), cfg);
      for (const f of git('ls-files', '--', ...repo.quellen).trim().split('\n').filter(Boolean))
        existing.set(`${repo.name}:${f}`, readFileSync(join(dir, f), 'utf8'));
      repos.push({ name: repo.name, head: git('rev-parse', '--short', 'HEAD').trim(), commits: new Set(ev.map((e) => e.hash)).size });
      events.push(...ev);
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  return { events, repos, funcs, existing };
}

/** Ganze Rechnung; liefert das Datenobjekt der Seite. */
export function analyse(cfg, root, now = new Date()) {
  const since = new Date(now); since.setMonth(since.getMonth() - cfg.monate);
  const seit = since.toISOString().slice(0, 10);
  const { events, repos, funcs, existing } = readRepos(cfg, root, seit);
  markRework(events, cfg.nachfassTage);

  const co = coChange(events);
  const loc = (k) => (existing.get(k) ?? '').split('\n').length;
  const fileUnit = new Map(events.map((e) => [`${e.repo}:${e.file}`, `${e.repo}:${e.unit}`]));
  const row = (k, s) => ({ key: k, ...s });

  const units = [...aggregate(events, (e) => [[`${e.repo}:${e.unit}`, e.added, e.reworked]])].map(([k, s]) => ({
    ...row(k, s),
    mit: co.shared.get(k) ?? 0, fremdRepo: co.crossRepo.get(k) ?? 0, gruppen: co.own.get(k) ?? 0, partner: co.partners(k),
    loc: [...fileUnit].filter(([f, u]) => u === k && existing.has(f)).reduce((a, [f]) => a + loc(f), 0),
  })).sort((a, b) => b.changes - a.changes);

  const funcsOfFile = (k) => [...funcs].filter(([fk]) => fk.startsWith(k + '#')).flatMap(([, v]) => v);
  const files = [...aggregate(events, (e) => [[`${e.repo}:${e.file}`, e.added, e.reworked]])]
    .filter(([k]) => existing.has(k))
    .map(([k, s]) => ({ ...row(k, s), unit: fileUnit.get(k), loc: loc(k), funcs: funcsOfFile(k) }))
    .sort((a, b) => b.changes - a.changes);

  const alive = (file, sym) => {
    const src = existing.get(file);
    if (src === undefined) return false;
    return sym === DATEI || src.split('\n').some((l) => symbolName(l) === sym);
  };
  const symAgg = aggregate(events, (e) => Object.entries(e.bySym).map(([sym, [a, r]]) => [`${e.repo}:${e.file}#${sym}`, a, r]));
  const symbols = [...symAgg].map(([k, s]) => {
    const file = k.slice(0, k.lastIndexOf('#')), symbol = k.slice(k.lastIndexOf('#') + 1);
    return { ...row(k, s), file, symbol, funcs: funcs.get(`${file}#${symbol === DATEI ? '' : symbol}`) ?? [] };
  }).filter((s) => s.symbol !== MODULEBENE && alive(s.file, s.symbol))
    .sort((a, b) => b.changes - a.changes || b.reworked - a.reworked);
  const total = symbols.reduce((a, s) => a + s.changes, 0);
  let kum = 0;
  const pareto = symbols.slice(0, cfg.paretoTop).map((s) => ({ ...s, kumAnteil: (kum += s.changes) / total }));

  const topUnits = [...units].sort((a, b) => b.mit - a.mit).slice(0, cfg.kopplungTop).map((u) => u.key);
  return {
    stand: now.toISOString().slice(0, 10), seit, repos,
    parameter: { monate: cfg.monate, nachfassTage: cfg.nachfassTage, paretoTop: cfg.paretoTop },
    units, files: files.slice(0, 40), pareto, symbolChanges: total, symbolCount: symbols.length,
    matrix: { units: topUnits, cells: topUnits.map((a) => topUnits.map((b) => co.pair(a, b))) },
    grenzen: {
      ereignisse: events.length, ohneCr: events.filter((e) => !e.cr).length, gruppen: co.groupCount,
      zeilen: events.reduce((a, e) => a + e.added, 0),
      modulebene: events.reduce((a, e) => a + (e.bySym[MODULEBENE]?.[0] ?? 0), 0),
    },
  };
}

/** Seite aus der Vorlage; die Daten stehen als JSON im Platzhalter. */
export function renderPage(data, template) {
  return template.replace('/*DATA*/null', () => JSON.stringify(data).replace(/</g, '\\u003c'));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, '..');
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const cfg = JSON.parse(readFileSync(arg('--config') ?? join(here, 'aenderungs-heatmap.config.json'), 'utf8'));
  const out = arg('--out') ?? join(root, 'docs/messung/aenderungs-heatmap.html');
  const data = analyse(cfg, root);
  if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify(data, null, 1));
  writeFileSync(out, renderPage(data, readFileSync(join(here, 'aenderungs-heatmap.html'), 'utf8')));
  console.log(`${data.repos.map((r) => `${r.name} ${r.commits} Commits`).join(', ')} seit ${data.seit} → ${out}`);
}
