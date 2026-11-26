/**
 * Lese-Protokoll einer Testdatei (CR-GC-1034) — als `--require` in JEDEN Node-Prozess des Laufs
 * geladen (NODE_OPTIONS erbt sich auf Worker und Kindprozesse).
 *
 * Schreibt je INHALTS-Zugriff auf eine Datei des Repos eine Zeile (repo-relativer Pfad) nach
 * TRACE_OUT. Gezaehlt wird, was den Inhalt liefert: lesen, oeffnen, kopieren, Verzeichnis listen,
 * Existenz pruefen. NICHT gezaehlt wird `stat`: `build-stamp.ts` fragt so das Aenderungsdatum jeder
 * Datei in `src/` ab, ohne einen Inhalt zu lesen — das waere Rauschen an rund 100 Tests.
 * git-Aufrufe im Repo selbst (`git show HEAD:docs/graph/...`) lesen am Dateisystem vorbei; sie
 * zaehlen mit den Pfaden ihrer Argumente.
 *
 * Welche Pfade die Modell-Spur ausloesen, entscheidet nicht diese Datei, sondern
 * `isModelLanePath` in model-test-set.mjs — hier wird nur protokolliert.
 *
 * @author andreas@siglochconsulting
 */
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const REPO = process.env.TRACE_REPO;
const OUT = process.env.TRACE_OUT;

if (REPO && OUT) {
  const seen = new Set();
  const append = fs.appendFileSync;
  const note = (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    try {
      append(OUT, rel + '\n');
    } catch {
      /* Ziel verschwunden: der Lauf ist vorbei */
    }
  };
  const noteAbs = (p) => {
    if (typeof p !== 'string' && !(p instanceof URL) && !Buffer.isBuffer(p)) return;
    const abs = path.resolve(p instanceof URL ? p.pathname : String(p));
    const rel = path.relative(REPO, abs);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) note(rel.split(path.sep).join('/'));
  };
  const wrap = (obj, name) => {
    const orig = obj[name];
    if (typeof orig !== 'function') return;
    obj[name] = function (p, ...rest) {
      noteAbs(p);
      return orig.call(this, p, ...rest);
    };
  };
  for (const n of ['readFileSync', 'readFile', 'openSync', 'open', 'createReadStream', 'readdirSync', 'readdir', 'opendirSync', 'copyFileSync', 'copyFile', 'cpSync', 'cp', 'existsSync']) wrap(fs, n);
  for (const n of ['readFile', 'open', 'readdir', 'opendir', 'copyFile', 'cp']) wrap(fs.promises, n);

  // git im Repo selbst: die Pfad-Argumente (auch `rev:pfad`) zaehlen als gelesen.
  const gitInRepo = (cmd, args, opts) => {
    if (String(cmd) !== 'git' || !Array.isArray(args) || args.includes('-C')) return;
    const cwd = path.resolve((opts && opts.cwd) || process.cwd());
    if (cwd !== path.resolve(REPO)) return;
    for (const a of args) {
      const p = String(a).replace(/^[^:]*:(?=[^/])/, '');
      if (/^[\w.-]+(\/[\w.*-]+)+$/.test(p)) note(p);
    }
  };
  for (const n of ['spawn', 'spawnSync', 'execFile', 'execFileSync']) {
    const orig = childProcess[n];
    childProcess[n] = function (cmd, args, opts, ...rest) {
      gitInRepo(cmd, args, Array.isArray(args) ? opts : args);
      return orig.call(this, cmd, args, opts, ...rest);
    };
  }
  require('module').syncBuiltinESMExports();
}
