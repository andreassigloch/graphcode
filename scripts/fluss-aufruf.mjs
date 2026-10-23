#!/usr/bin/env node
/**
 * fluss-aufruf.mjs — `npm run abgleich:fluss` (CR-GC-843): steht hinter jedem synchronen Fluss ein Aufruf?
 *
 * Keine Regel vergleicht einen Fluss mit dem Code. Das Gate prüft die Grammatik, RC-* prüfen, dass eine `realRef`
 * existiert. Ein Fluss zwischen dem falschen Paar Funktionen besteht beide. In CR-GC-832..838 nannten etwa 4 von 10
 * Flüssen einen Weg, den kein Code geht; gefunden haben sie Agenten, die den Code hinter jedem Fluss lasen.
 *
 * Je Fluss mit `sync: sync` und je Paar (Erzeuger-FUNC, Abnehmer-FUNC) sucht das Skript einen Aufruf in einer der
 * beiden Richtungen: der Erzeuger ruft den Abnehmer (Anfrage), oder der Abnehmer ruft den Erzeuger und bekommt den
 * Inhalt zurück (Antwort). Die Aufrufe liefert TypeScripts eigener LanguageService (Call Hierarchy, dieselbe Maschine
 * hinter dem Sprachserver) — er löst Methoden, Werkzeug-Handler in Objektliteralen und Rückrufe auf. Der
 * tree-sitter-Extraktor von graphify kann das nicht: er liest keine Funktionsrümpfe (FM-11), gemessen sah er 52 von
 * 298 Paaren.
 *
 * Ein `async`-Fluss geht über Speicher, Datei, Ereignis oder Socket. Das Skript prüft ihn nicht und zählt ihn getrennt.
 * Es liest die committete SSOT und den Quellbaum, schreibt nichts, braucht keinen Host und kein LLM.
 *
 * Ergebnisse je Paar: `aufruf` (direkt), `ueber` (über höchstens `tiefe` Schritte, mit Weg), `kein-aufruf`,
 * `ungeprueft` (mit Grund). „kein-aufruf" ist ein Prüfauftrag an den Autor, kein Urteil: ein registrierter Rückruf,
 * eine übergebene Fabrik, ein Socket zwischen zwei Prozessen oder ein Aufruf über die Werkzeug-Registry hat keinen
 * Aufruf, den eine Typanalyse sieht (`se-vorbereitung`, Schritt 4). Hat der Autor die Übergabe geprüft, trägt der
 * FLOW sie als `realRef` (Datei und Symbol der Stelle): dann `belegt`, solange das Symbol existiert, sonst
 * `beleg-kaputt`. Gesucht wird der Aufruf trotzdem zuerst — eine Bindung ersetzt keinen Weg, den der Code zeigt.
 *
 * Aufruf: node scripts/fluss-aufruf.mjs [--json] [--tiefe=3]
 * @author andreas@siglochconsulting
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SSOT = 'docs/graph/graphcode.graph.json';

/** Ein LanguageService über die Dateien der tsconfig des Repos. */
export function sprachdienst(repoRoot) {
  const config = ts.getParsedCommandLineOfConfigFile(join(repoRoot, 'tsconfig.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    },
  });
  const host = {
    getScriptFileNames: () => config.fileNames,
    getScriptVersion: () => '0',
    getScriptSnapshot: (f) => (existsSync(f) ? ts.ScriptSnapshot.fromString(readFileSync(f, 'utf8')) : undefined),
    getCurrentDirectory: () => repoRoot,
    getCompilationSettings: () => config.options,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };
  return ts.createLanguageService(host, ts.createDocumentRegistry());
}

/** Der innerste Knoten, der an `pos` beginnt — der Name einer Deklaration. */
function findeKnoten(sf, pos) {
  let treffer;
  const besuche = (n) => {
    if (n.getStart(sf) <= pos && pos < n.getEnd()) {
      if (n.getStart(sf) === pos) treffer = n;
      ts.forEachChild(n, besuche);
    }
  };
  besuche(sf);
  return treffer;
}

const istFunktion = (n) => n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n));

/** Ein Knoten, den die Call Hierarchy als Aufrufer oder Ziel fasst — die Stelle ist sein Name. */
function aufrufbar(n) {
  if (!n.name || !ts.isIdentifier(n.name)) return false;
  if (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isClassDeclaration(n)) return true;
  if (ts.isPropertyDeclaration(n) || ts.isPropertyAssignment(n) || ts.isVariableDeclaration(n)) return istFunktion(n.initializer);
  return false;
}

/**
 * Die Stellen, für die eine FUNC steht: die Deklaration ihres Symbols und alles Aufrufbare darin. Eine Klasse steht
 * für ihre Methoden; eine Funktion, die Werkzeuge baut (`bindReadTools`), für die Handler, die sie baut; eine
 * Variable mit Objektliteral (ein Werkzeug `{ name, handler }`) für ihren `handler`.
 */
export function deklaration(sourceFile, symbol) {
  let wurzel = null;
  const suche = (n) => {
    if (wurzel) return;
    const name = n.name && ts.isIdentifier(n.name) ? n.name.text : undefined;
    if (name === symbol && (aufrufbar(n) || (ts.isVariableDeclaration(n) && n.initializer && ts.isObjectLiteralExpression(n.initializer)))) {
      wurzel = n;
      return;
    }
    ts.forEachChild(n, suche);
  };
  suche(sourceFile);
  if (!wurzel) return { grund: 'Symbol nicht gefunden' };
  const pos = [];
  const sammle = (n) => {
    if (aufrufbar(n)) pos.push(n.name.getStart(sourceFile));
    ts.forEachChild(n, sammle);
  };
  sammle(wurzel);
  return pos.length ? { pos } : { grund: 'nichts Aufrufbares' };
}

/** Rein: die Paare (Fluss, Erzeuger, Abnehmer) der synchronen Flüsse zwischen zwei FUNCs, und die Zahl der asynchronen. */
export function paare(graph) {
  const el = new Map(graph.elements.map((e) => [e.id, e]));
  const istFunc = (id) => el.get(id)?.type === 'FUNC';
  const io = graph.traces.filter((t) => t.type === 'io');
  const out = [];
  let asynchron = 0;
  for (const f of graph.elements.filter((e) => e.type === 'FLOW').sort((a, b) => a.id.localeCompare(b.id))) {
    const von = io.filter((t) => t.target === f.id && istFunc(t.source)).map((t) => t.source).sort();
    const nach = io.filter((t) => t.source === f.id && istFunc(t.target)).map((t) => t.target).sort();
    if (!von.length || !nach.length) continue;
    if ((f.sync ?? f.attributes?.sync) !== 'sync') {
      asynchron += von.length * nach.length;
      continue;
    }
    for (const v of von) for (const n of nach) out.push({ flow: f.id, von: v, nach: n });
  }
  return { paare: out, asynchron };
}

/**
 * Prüft jeden synchronen Fluss des Graphen gegen die Aufrufe im Quellbaum von `repoRoot`.
 * @param {{ repoRoot?: string, graph?: { elements: any[], traces: any[] }, tiefe?: number }} [opts]
 */
export function pruefeFluesse({ repoRoot = REPO, graph, tiefe = 3 } = {}) {
  graph ??= JSON.parse(readFileSync(join(repoRoot, SSOT), 'utf8'));
  const ls = sprachdienst(repoRoot);
  const program = ls.getProgram();
  const el = new Map(graph.elements.map((e) => [e.id, e]));
  const imRepo = (f) => !relative(repoRoot, f).startsWith('..') && !f.includes('/node_modules/');
  const schluessel = (item) => `${item.file}:${item.selectionSpan.start}`;

  const orte = new Map();
  /** Der Call-Hierarchy-Eintrag einer FUNC, oder der Grund, warum es keinen gibt. */
  const ort = (uid) => {
    if (orte.has(uid)) return orte.get(uid);
    const ref = el.get(uid)?.realRef ?? el.get(uid)?.attributes?.realRef;
    let o;
    if (!ref?.file) o = { grund: 'ohne Bindung' };
    else if (!/\.tsx?$/.test(ref.file)) o = { grund: 'keine TS-Datei' };
    else if (!ref.symbol) o = { grund: 'ohne Symbol' };
    else {
      const abs = resolve(repoRoot, ref.file);
      const sf = program.getSourceFile(abs);
      if (!sf) o = { grund: existsSync(abs) ? 'nicht im Programm' : 'ausserhalb des Repos' };
      else {
        const d = deklaration(sf, ref.symbol);
        if (d.grund) o = d;
        else {
          const items = d.pos.flatMap((p) => [ls.prepareCallHierarchy(abs, p)].flat().filter(Boolean));
          o = items.length ? { items, keys: new Set(items.map(schluessel)) } : { grund: 'kein Aufrufziel' };
        }
      }
    }
    orte.set(uid, o);
    return o;
  };

  /** Alles Aufrufbare im Repo je Name — für Signaturen, die eine Klasse nur strukturell erfüllt. */
  const jeName = new Map();
  for (const sf of program.getSourceFiles().filter((f) => imRepo(f.fileName) && !f.isDeclarationFile)) {
    const besuche = (n) => {
      if (aufrufbar(n)) {
        const liste = jeName.get(n.name.text) ?? [];
        liste.push({ file: sf.fileName, pos: n.name.getStart(sf) });
        jeName.set(n.name.text, liste);
      }
      ts.forEachChild(n, besuche);
    };
    besuche(sf);
  }

  /**
   * Ein Aufruf über einen Interface-Typ (`harness.evaluateRules()`) endet in der Call Hierarchy an der Signatur. Weiter
   * geht er an jeder Implementierung im Repo. Erfüllt eine Klasse das Interface nur strukturell (ohne `implements`),
   * findet TypeScript keine; dann geht er an die eine aufrufbare Deklaration dieses Namens, wenn es genau eine gibt.
   */
  const implementierungen = (to) => {
    const sf = program.getSourceFile(to.file);
    const knoten = sf && findeKnoten(sf, to.selectionSpan.start);
    const decl = knoten?.parent;
    if (!to.ersatz && !(decl && (ts.isMethodSignature(decl) || ts.isPropertySignature(decl)))) return [to];
    const ziele = (ls.getImplementationAtPosition(to.file, to.selectionSpan.start) ?? [])
      .filter((i) => imRepo(i.fileName))
      .map((i) => ({ file: i.fileName, pos: i.textSpan.start }));
    const fassen = (zs) => zs.flatMap((z) => [ls.prepareCallHierarchy(z.file, z.pos)].flat().filter(Boolean));
    let items = fassen(ziele);
    // Die Implementierung ist oft eine Kurzschreibweise im zurückgegebenen Objekt (`{ recordAudit }`), kein Aufrufziel.
    if (!items.length && jeName.get(to.name)?.length === 1) items = fassen(jeName.get(to.name));
    return items.length ? items : to.ersatz ? [] : [to];
  };

  const checker = program.getTypeChecker();
  /**
   * Aufrufe, die die Call Hierarchy still auslässt: der Aufruf eines Namens aus einer Destrukturierung
   * (`const { recordAudit } = ctx; recordAudit(...)`). Das Ziel ist die Eigenschaft gleichen Namens am Typ des
   * destrukturierten Objekts, von dort wie jede Signatur an die Implementierung.
   */
  const destrukturiert = (item) => {
    const sf = program.getSourceFile(item.file);
    const decl = sf && findeKnoten(sf, item.selectionSpan.start)?.parent;
    if (!decl) return [];
    const ziele = [];
    const besuche = (n) => {
      if (n !== decl && aufrufbar(n)) return;
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        const binding = checker.getSymbolAtLocation(n.expression)?.declarations?.find(ts.isBindingElement);
        const muster = binding?.parent;
        const quelle = muster && ts.isObjectBindingPattern(muster) ? muster.parent : undefined;
        if (quelle && ts.isVariableDeclaration(quelle) && quelle.initializer) {
          const name = (binding.propertyName ?? binding.name).getText(sf);
          const prop = checker.getTypeAtLocation(quelle.initializer).getProperty(name);
          for (const d of prop?.declarations ?? []) {
            const dsf = d.getSourceFile();
            if (!imRepo(dsf.fileName) || !d.name) continue;
            const items = [ls.prepareCallHierarchy(dsf.fileName, d.name.getStart(dsf))].flat().filter(Boolean);
            // Kein Aufrufziel (die Eigenschaft eines Zod-Vertrags): als Ersatz weiter, wie eine Signatur.
            ziele.push(...(items.length ? items : [{ name, file: dsf.fileName, selectionSpan: { start: d.name.getStart(dsf) }, ersatz: true }]));
          }
        }
      }
      ts.forEachChild(n, besuche);
    };
    besuche(decl);
    return ziele;
  };

  const ausgehend = new Map();
  const aufrufe = (item) => {
    const k = schluessel(item);
    if (!ausgehend.has(k))
      ausgehend.set(
        k,
        [
          ...ls.provideCallHierarchyOutgoingCalls(item.file, item.selectionSpan.start).map((c) => c.to).filter((to) => imRepo(to.file)),
          ...destrukturiert(item),
        ].flatMap(implementierungen),
      );
    return ausgehend.get(k);
  };

  /** Der kürzeste Weg von `a` nach `b` über höchstens `tiefe` Aufrufe, als Namensliste — oder null. */
  const weg = (a, b) => {
    let rand = a.items.map((i) => [i]);
    const gesehen = new Set(a.keys);
    for (let d = 1; d <= tiefe; d++) {
      const naechste = [];
      for (const pfad of rand)
        for (const to of aufrufe(pfad[pfad.length - 1])) {
          const k = schluessel(to);
          if (b.keys.has(k)) return [...pfad, to].map((i) => i.name);
          if (!gesehen.has(k)) {
            gesehen.add(k);
            naechste.push([...pfad, to]);
          }
        }
      rand = naechste;
    }
    return null;
  };

  const { paare: liste, asynchron } = paare(graph);
  const zeilen = liste.map((p) => {
    const a = ort(p.von), b = ort(p.nach);
    const offen = [a, b].find((o) => o.grund);
    if (offen) return { ...p, ergebnis: 'ungeprueft', grund: `${offen === a ? p.von : p.nach}: ${offen.grund}` };
    if ([...a.keys].some((k) => b.keys.has(k))) return { ...p, ergebnis: 'aufruf', weg: [a.items[0].name] };
    const w = weg(a, b) ?? weg(b, a);
    if (!w) {
      const ref = el.get(p.flow)?.realRef ?? el.get(p.flow)?.attributes?.realRef;
      if (!ref?.file) return { ...p, ergebnis: 'kein-aufruf' };
      const stelle = `${ref.file}#${ref.symbol ?? ''}`;
      const sf = program.getSourceFile(resolve(repoRoot, ref.file));
      const fehler = !sf ? 'Datei nicht im Programm' : !ref.symbol ? 'ohne Symbol' : deklaration(sf, ref.symbol).grund;
      return fehler ? { ...p, ergebnis: 'beleg-kaputt', beleg: stelle, grund: fehler } : { ...p, ergebnis: 'belegt', beleg: stelle };
    }
    return { ...p, ergebnis: w.length === 2 ? 'aufruf' : 'ueber', weg: w };
  });
  const zahl = (e) => zeilen.filter((z) => z.ergebnis === e).length;
  return {
    zeilen,
    summe: {
      paare: zeilen.length, aufruf: zahl('aufruf'), ueber: zahl('ueber'), belegt: zahl('belegt'),
      belegKaputt: zahl('beleg-kaputt'), keinAufruf: zahl('kein-aufruf'), ungeprueft: zahl('ungeprueft'), asynchron,
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
  const r = pruefeFluesse({ tiefe: Number(arg('tiefe') ?? 3) });
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    const s = r.summe;
    console.log(`Fluss gegen Aufruf: ${s.paare} synchrone Paare — Aufruf ${s.aufruf}, über Zwischenschritte ${s.ueber}, belegt ${s.belegt}, Beleg kaputt ${s.belegKaputt}, kein Aufruf ${s.keinAufruf}, ungeprüft ${s.ungeprueft}; asynchron (nicht geprüft) ${s.asynchron}.`);
    for (const z of r.zeilen.filter((z) => z.ergebnis === 'beleg-kaputt')) console.log(`  Beleg kaputt ${z.flow}: ${z.beleg} — ${z.grund}`);
    for (const z of r.zeilen.filter((z) => z.ergebnis === 'kein-aufruf')) console.log(`  kein Aufruf  ${z.flow}: ${z.von} → ${z.nach}`);
    const gruende = new Map();
    for (const z of r.zeilen.filter((z) => z.ergebnis === 'ungeprueft')) {
      const g = z.grund.slice(z.grund.indexOf(': ') + 2);
      gruende.set(g, (gruende.get(g) ?? 0) + 1);
    }
    for (const [g, n] of [...gruende].sort((x, y) => y[1] - x[1])) console.log(`  ungeprüft    ${n}× ${g}`);
  }
}
