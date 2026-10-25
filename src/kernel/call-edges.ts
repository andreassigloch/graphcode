/**
 * Die Aufrufkanten des Codes für RC-12 und RC-13 (CR-GC-846, Regeln CR-SM-415 in contracts).
 *
 * graphcode liefert, contracts urteilt: hier entstehen `callEdges` (wer ruft wen) und `callScope` (die Dateien,
 * deren Aufrufe vollständig darin stehen). Ob hinter einem synchronen Fluss ein Aufruf steht, entscheidet RC-12,
 * nicht dieses Modul. Bis CR-GC-846 stand die Suche als Skript `scripts/fluss-aufruf.mjs` (CR-GC-843) und lief
 * nur, wenn jemand es startete.
 *
 * Die Aufrufe liefert TypeScripts eigener LanguageService (Call Hierarchy, dieselbe Maschine hinter dem
 * Sprachserver). Er löst Methoden, Werkzeug-Handler in Objektliteralen und Rückrufe auf. Der tree-sitter-Extraktor
 * von graphify kann das nicht: er liest keine Funktionsrümpfe (FM-11), gemessen sah er 52 von 298 Paaren.
 *
 * Ein Knoten ist `{ file, symbol }`. `symbol` ist der PFAD der Deklaration, Glieder mit `.` getrennt, äußeres
 * zuerst (`GraphStore.open`, `bindReadTools.handler`) — daraus liest contracts, welche FUNC für einen Aufrufort
 * steht. Zwei Deklarationen mit demselben Pfad in einer Datei werden ein Knoten.
 *
 * `callScope` sind die TS-Dateien der `tsconfig.json` im Repo-Wurzelverzeichnis. Skills, Skripte und
 * Nachbarpakete stehen nicht darin und zählen in `callCoverage` als nicht geprüft. Ohne `tsconfig.json` liefert
 * das Modul nichts: dann ist nicht gesucht worden, und RC-12/RC-13 schweigen.
 *
 * @author andreas@siglochconsulting
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import type { CallEdge } from '@sigloch/contracts/se';

/** Ein Aufrufziel: ein Eintrag der Call Hierarchy, oder eine Signatur ohne Aufrufziel (`ersatz`). */
interface Target {
  name: string;
  file: string;
  selectionSpan: { start: number };
  ersatz?: boolean;
}

export interface CallFacts {
  callEdges: CallEdge[];
  callScope: string[];
}

/** Die tsconfig des Repos, gelesen wie `tsc` sie liest. */
function readConfig(repoRoot: string): ts.ParsedCommandLine {
  const config = ts.getParsedCommandLineOfConfigFile(join(repoRoot, 'tsconfig.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    },
  });
  if (!config) throw new Error(`${repoRoot}/tsconfig.json: nicht lesbar`);
  return config;
}

/** Ein LanguageService über die Dateien der tsconfig des Repos. */
function languageService(repoRoot: string, config: ts.ParsedCommandLine): ts.LanguageService {
  const host: ts.LanguageServiceHost = {
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

/**
 * Der Stand, aus dem die Kanten folgen: Inhalt der tsconfig und jeder ihrer Dateien. Gleicher Stand, gleiche
 * Kanten — der Host rechnet sie nur nach einer Änderung am Code neu. Ein Schreibzug am Modell ändert sie nie.
 */
function stampOf(repoRoot: string, config: ts.ParsedCommandLine): string {
  const h = createHash('sha256').update(readFileSync(join(repoRoot, 'tsconfig.json')));
  for (const f of config.fileNames) h.update(`\0${f}\0`).update(existsSync(f) ? readFileSync(f) : '');
  return h.digest('hex');
}

const lastRun = new Map<string, { stamp: string; facts: CallFacts }>();

/** Der innerste Knoten, der an `pos` beginnt — der Name einer Deklaration. */
function nodeAt(sf: ts.SourceFile, pos: number): ts.Node | undefined {
  let hit: ts.Node | undefined;
  const visit = (n: ts.Node): void => {
    if (n.getStart(sf) <= pos && pos < n.getEnd()) {
      if (n.getStart(sf) === pos) hit = n;
      ts.forEachChild(n, visit);
    }
  };
  visit(sf);
  return hit;
}

const isFunction = (n: ts.Node | undefined): boolean => n !== undefined && (ts.isArrowFunction(n) || ts.isFunctionExpression(n));

/** Ein Knoten, den die Call Hierarchy als Aufrufer oder Ziel fasst — die Stelle ist sein Name. */
function callable(n: ts.Node): n is ts.NamedDeclaration & { name: ts.Identifier } {
  const name = (n as ts.NamedDeclaration).name;
  if (!name || !ts.isIdentifier(name)) return false;
  if (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isClassDeclaration(n)) return true;
  if (ts.isPropertyDeclaration(n) || ts.isPropertyAssignment(n) || ts.isVariableDeclaration(n)) return isFunction(n.initializer);
  return false;
}

/** Der Name, den eine Deklaration zum Pfad beiträgt — oder keiner. */
function segment(n: ts.Node): string | undefined {
  const named =
    ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isClassDeclaration(n) || ts.isClassExpression(n) ||
    ts.isInterfaceDeclaration(n) || ts.isMethodDeclaration(n) || ts.isMethodSignature(n) ||
    ts.isPropertyDeclaration(n) || ts.isPropertySignature(n) || ts.isPropertyAssignment(n) ||
    ts.isVariableDeclaration(n) || ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n) ||
    ts.isModuleDeclaration(n);
  const name = named ? (n as ts.NamedDeclaration).name : undefined;
  return name && (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) ? name.text : undefined;
}

/**
 * Der Pfad der Deklaration, deren Name an `pos` steht: `GraphStore.open`. Leer, wenn an `pos` kein Name steht —
 * die Call Hierarchy fasst Aufrufe auf oberster Ebene als ganze Datei, deren Stelle der Dateianfang ist.
 */
function declarationPath(sf: ts.SourceFile, pos: number): string {
  const name = nodeAt(sf, pos);
  if (!name || !(ts.isIdentifier(name) || ts.isPrivateIdentifier(name))) return '';
  const parts: string[] = [];
  for (let n: ts.Node | undefined = name.parent; n && !ts.isSourceFile(n); n = n.parent) {
    const s = segment(n);
    if (s !== undefined) parts.unshift(s);
  }
  return parts.join('.');
}

/**
 * Die Aufrufkanten aller Dateien der tsconfig von `repoRoot`. `undefined` ohne `tsconfig.json`: nicht gesucht.
 */
export function extractCallFacts(repoRoot: string): CallFacts | undefined {
  if (!existsSync(join(repoRoot, 'tsconfig.json'))) return undefined;
  const config = readConfig(repoRoot);
  const stamp = stampOf(repoRoot, config);
  const last = lastRun.get(repoRoot);
  if (last?.stamp === stamp) return last.facts;
  const facts = searchCalls(repoRoot, config);
  lastRun.set(repoRoot, { stamp, facts });
  return facts;
}

function searchCalls(repoRoot: string, config: ts.ParsedCommandLine): CallFacts {
  const ls = languageService(repoRoot, config);
  const fileNames = config.fileNames;
  const program = ls.getProgram();
  if (!program) throw new Error(`${repoRoot}: kein TypeScript-Programm`);
  const checker = program.getTypeChecker();
  const inRepo = (f: string): boolean => !relative(repoRoot, f).startsWith('..') && !f.includes('/node_modules/');
  const keyOf = (t: Target): string => `${t.file}:${t.selectionSpan.start}`;
  const prepare = (file: string, pos: number): ts.CallHierarchyItem[] =>
    [ls.prepareCallHierarchy(file, pos)].flat().filter((i): i is ts.CallHierarchyItem => i !== undefined);

  /** Alles Aufrufbare im Repo je Name — für Signaturen, die eine Klasse nur strukturell erfüllt. */
  const byName = new Map<string, Array<{ file: string; pos: number }>>();
  for (const sf of program.getSourceFiles().filter((f) => inRepo(f.fileName) && !f.isDeclarationFile)) {
    const visit = (n: ts.Node): void => {
      if (callable(n)) {
        const list = byName.get(n.name.text) ?? [];
        list.push({ file: sf.fileName, pos: n.name.getStart(sf) });
        byName.set(n.name.text, list);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }

  /**
   * Ein Aufruf über einen Interface-Typ (`harness.evaluateRules()`) endet in der Call Hierarchy an der Signatur.
   * Weiter geht er an jeder Implementierung im Repo. Erfüllt eine Klasse das Interface nur strukturell (ohne
   * `implements`), findet TypeScript keine; dann geht er an die eine aufrufbare Deklaration dieses Namens, wenn es
   * genau eine gibt. Hat die Signatur mehr als eine Implementierung, ist der Aufruf ein Versand zur Laufzeit
   * (`tool.handler()` über die Werkzeug-Registry erreicht jedes Werkzeug): dann entsteht keine Kante. Sonst
   * bestätigte jeder Registry-Aufruf jeden Fluss; die Übergabe gehört dann als `realRef` an den FLOW.
   */
  const implementations = (to: Target): Target[] => {
    const sf = program.getSourceFile(to.file);
    const decl = sf && nodeAt(sf, to.selectionSpan.start)?.parent;
    if (!to.ersatz && !(decl && (ts.isMethodSignature(decl) || ts.isPropertySignature(decl)))) return [to];
    const targets = (ls.getImplementationAtPosition(to.file, to.selectionSpan.start) ?? [])
      .filter((i) => inRepo(i.fileName))
      .map((i) => ({ file: i.fileName, pos: i.textSpan.start }));
    const resolve = (zs: Array<{ file: string; pos: number }>): Target[] => zs.flatMap((z) => prepare(z.file, z.pos));
    let items = resolve(targets);
    // Die Implementierung ist oft eine Kurzschreibweise im zurückgegebenen Objekt (`{ recordAudit }`), kein Aufrufziel.
    const sameName = byName.get(to.name);
    if (!items.length && sameName?.length === 1) items = resolve(sameName);
    if (items.length > 1) return [];
    return items.length ? items : to.ersatz ? [] : [to];
  };

  /**
   * Aufrufe, die die Call Hierarchy still auslässt:
   * - der Aufruf eines Namens aus einer Destrukturierung (`const { recordAudit } = ctx; recordAudit(...)`): Ziel ist
   *   die Eigenschaft gleichen Namens am Typ des destrukturierten Objekts,
   * - ein Methodenaufruf über einen abgeleiteten Typ (`harness: Pick<ConformanceHarness, 'getGraph'>`): Ziel ist die
   *   Signatur, auf die das Symbol zeigt.
   * Von dort geht es wie bei jeder Signatur an die Implementierung.
   */
  const missed = (item: Target): Target[] => {
    const sf = program.getSourceFile(item.file);
    const decl = sf && nodeAt(sf, item.selectionSpan.start)?.parent;
    if (!sf || !decl) return [];
    const out: Target[] = [];
    const visit = (n: ts.Node): void => {
      if (n !== decl && callable(n)) return;
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        for (const d of checker.getSymbolAtLocation(n.expression.name)?.declarations ?? []) {
          const dsf = d.getSourceFile();
          if ((ts.isMethodSignature(d) || ts.isPropertySignature(d)) && inRepo(dsf.fileName))
            out.push({ name: d.name.getText(dsf), file: dsf.fileName, selectionSpan: { start: d.name.getStart(dsf) } });
        }
      }
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        const binding = checker.getSymbolAtLocation(n.expression)?.declarations?.find(ts.isBindingElement);
        const pattern = binding?.parent;
        const source = pattern && ts.isObjectBindingPattern(pattern) ? pattern.parent : undefined;
        if (binding && source && ts.isVariableDeclaration(source) && source.initializer) {
          const name = (binding.propertyName ?? binding.name).getText(sf);
          const prop = checker.getTypeAtLocation(source.initializer).getProperty(name);
          for (const d of prop?.declarations ?? []) {
            const dsf = d.getSourceFile();
            const dname = (d as ts.NamedDeclaration).name;
            if (!inRepo(dsf.fileName) || !dname) continue;
            const items = prepare(dsf.fileName, dname.getStart(dsf));
            // Kein Aufrufziel (die Eigenschaft eines Zod-Vertrags): als Ersatz weiter, wie eine Signatur.
            out.push(...(items.length ? items : [{ name, file: dsf.fileName, selectionSpan: { start: dname.getStart(dsf) }, ersatz: true }]));
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(decl);
    return out;
  };

  const outgoing = (item: Target): Target[] =>
    [
      ...ls.provideCallHierarchyOutgoingCalls(item.file, item.selectionSpan.start).map((c) => c.to).filter((to) => inRepo(to.file)),
      ...missed(item),
    ].flatMap(implementations);

  const site = (t: Target): { file: string; symbol: string } | undefined => {
    const sf = program.getSourceFile(t.file);
    const symbol = sf ? declarationPath(sf, t.selectionSpan.start) : '';
    return symbol ? { file: relative(repoRoot, t.file), symbol } : undefined;
  };

  const callScope = fileNames.filter((f) => inRepo(f) && !f.endsWith('.d.ts') && program.getSourceFile(f));
  // Jede aufrufbare Deklaration der tsconfig, und jedes Ziel im Repo, das von dort erreicht wird.
  const queue: Target[] = [];
  const queued = new Set<string>();
  const enqueue = (t: Target): void => {
    if (queued.has(keyOf(t))) return;
    queued.add(keyOf(t));
    queue.push(t);
  };
  for (const file of callScope) {
    const sf = program.getSourceFile(file)!;
    const visit = (n: ts.Node): void => {
      if (callable(n)) prepare(file, n.name.getStart(sf)).forEach(enqueue);
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  const edges = new Map<string, CallEdge>();
  for (let i = 0; i < queue.length; i++) {
    const from = site(queue[i]);
    for (const to of outgoing(queue[i])) {
      enqueue(to);
      const target = site(to);
      if (!from || !target) continue;
      const k = `${from.file}#${from.symbol}\n${target.file}#${target.symbol}`;
      if (from.file === target.file && from.symbol === target.symbol) continue;
      edges.set(k, { from, to: target });
    }
  }
  return {
    callEdges: [...edges.keys()].sort().map((k) => edges.get(k)!),
    callScope: callScope.map((f) => relative(repoRoot, f)).sort(),
  };
}
