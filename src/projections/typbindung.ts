/**
 * typbindung.ts — je Blatt-FUNC eine Zeile Typbindung gegen Anfrage- und Antwort-SCHEMA (CR-GC-1026).
 *
 * Die Zeile bindet die Funktion des Codes an die Signatur, die das Modell beschreibt:
 * `export const _FUNC_x: (p1: z.infer<typeof Anfrage>) => (Antwort) | Promise<Antwort> = fn;`
 * Der Typprüfer meldet jede Abweichung. Keine Regel prüft das sonst (CR-GC-1024).
 *
 * Regeln (gemessen in CR-GC-1026, Lauf 5):
 * 1. Nur `io`-FLOW mit `sync`.
 * 2. Je FLOW zwischen f und Partner p: Ruft im Code genau eine Seite die andere (`rufe`, aus `funcCalls` in
 *    contracts, Bedeutung von RC-13), gilt das. Sonst das Glied mit dem kleineren Abstand vom Auslöser
 *    (`tiefen`, je Kette `ChainRoles.depth`), wenn alle Ketten mit beiden Gliedern einig sind. Sonst offen.
 *    Ruft p, gehört der FLOW zur Signatur von f; ruft f, ist er ein Aufruf von f. FLOW von oder an
 *    einen ACTOR gehören zur Signatur. Offen → die FUNC ist nicht prüfbar.
 * 3. Parameter: je IN-FLOW der Signatur einer, gleiches SCHEMA = ein Parameter, Reihenfolge nach uid.
 *    3a: Tragen die IN-FLOW der Signatur mehr als ein SCHEMA, hat die FUNC mehrere Operationen.
 * 4. Rückgabe: Vereinigung der SCHEMA der OUT-FLOW der Signatur, sonst `void`; verglichen mit `R | Promise<R>`.
 * 5. Typ eines SCHEMA: `z.infer<typeof <symbol>>` aus seinem `realRef`.
 * 6. Ein Symbol, das seine Datei nicht exportiert, wird nicht gebunden; `<symbol>: MCPTool<` heißt MCP-Werkzeug.
 *
 * Rein: Graph, Aufrufe, Abstände, Quelltexte und Altlast rein (`TypbindungEingabeSchema`), Text der
 * Bindungsdatei und Befunde raus (`TypbindungErgebnisSchema`).
 * Eine FUNC der Altlast bekommt `@ts-expect-error`: Ist sie behoben, ist die Markierung unbenutzt, und
 * der Typprüfer zwingt sie aus der Liste.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import { OntologyGraph, readFlowSync, readRealRef } from '@sigloch/contracts/se';

/** Wer ruft zwischen f und p: die uid des Aufrufers, oder null, wenn nichts entscheidet. */
export type Aufrufer = (f: string, p: string) => string | null;

/** Aufrufvertrag von `typbindungen` (CR-GC-1027). */
export const TypbindungEingabeSchema = z.strictObject({
  graph: OntologyGraph,
  /** Gerichtete Aufrufe zwischen FUNC aus dem Code (`funcCalls`). */
  rufe: z.array(z.strictObject({ from: z.string(), to: z.string() })),
  /** Je Wirkkette der Abstand jedes Glieds vom Auslöser (`ChainRoles.depth`). */
  tiefen: z.array(z.record(z.string(), z.number().int().min(0))),
  /** Text jeder `realRef`-Datei im Repo, die eine Kandidaten-FUNC nennt (Regel 6). */
  quellen: z.record(z.string(), z.string()),
  /** FUNC, deren Bindung heute rot ist (Ratsche, darf nur schrumpfen). */
  altlast: z.array(z.string()),
  /** Pfad der Bindungsdatei relativ zum Repo, z. B. `tests/typbindung/bindungen.ts`. */
  ziel: z.string(),
});
export type TypbindungEingabe = z.input<typeof TypbindungEingabeSchema>;

/** Regel 2: Code vor Kette. */
export function aufruferAus(rufe: TypbindungEingabe['rufe'], tiefen: TypbindungEingabe['tiefen']): Aufrufer {
  const ruft = new Set(rufe.map((c) => `${c.from}|${c.to}`));
  return (f, p) => {
    const hin = ruft.has(`${f}|${p}`);
    const her = ruft.has(`${p}|${f}`);
    if (hin !== her) return hin ? f : p;
    const urteile = new Set(tiefen.filter((t) => f in t && p in t).map((t) => (t[f] === t[p] ? null : t[f] < t[p] ? f : p)));
    return urteile.size === 1 ? [...urteile][0] : null;
  };
}

export const TypbindungBefundSchema = z.strictObject({
  func: z.string(),
  klasse: z.enum(['gebunden', 'altlast', 'nicht prüfbar']),
  grund: z.string().optional(),
});
export type TypbindungBefund = z.infer<typeof TypbindungBefundSchema>;

export const TypbindungErgebnisSchema = z.strictObject({
  text: z.string(),
  befunde: z.array(TypbindungBefundSchema),
});
export type TypbindungErgebnis = z.infer<typeof TypbindungErgebnisSchema>;

interface Ref { file: string; symbol: string }

const ref = (attributes: unknown): Ref | null => {
  const r = readRealRef(attributes as Parameters<typeof readRealRef>[0]);
  return r.state === 'bound' && r.value.symbol ? { file: r.value.file, symbol: r.value.symbol } : null;
};

/** Importpfad eines `realRef` aus der Bindungsdatei heraus; Familienpakete über ihren Namen. */
function importPfad(file: string, ziel: string): string {
  const contracts = /^packages\/contracts\/src\/(.+)\/[^/]+\.ts$/.exec(file);
  if (contracts) return `@sigloch/contracts/${contracts[1]}`;
  const paket = /^packages\/([^/]+)\/src\/[^/]+\.ts$/.exec(file);
  if (paket) return `@sigloch/${paket[1]}`;
  const tiefe = ziel.split('/').length - 1;
  return `${'../'.repeat(tiefe)}${file.replace(/\.ts$/, '.js')}`;
}

const kennung = (uid: string): string => uid.replace(/\W/g, '_');
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function typbindungen(eingabe: TypbindungEingabe): TypbindungErgebnis {
  const { graph, rufe, tiefen, quellen, altlast, ziel } = TypbindungEingabeSchema.parse(eingabe);
  const aufrufer = aufruferAus(rufe, tiefen);
  const byId = new Map(graph.elements.map((e) => [e.id, e]));
  const typeOf = (id: string): string | undefined => byId.get(id)?.type;
  const io = graph.traces.filter((t) => t.type === 'io');
  const istSync = (flow: string): boolean => {
    const s = readFlowSync(byId.get(flow)?.attributes as Parameters<typeof readFlowSync>[0]);
    return s.state === 'bound' && s.value === 'sync';
  };
  const schemaVon = (flow: string): string | null => {
    const s = graph.traces.filter((t) => t.source === flow && typeOf(t.target) === 'SCHEMA').map((t) => t.target);
    return s.length === 1 ? s[0] : null;
  };
  const block = new Set(graph.traces.filter((t) => t.type === 'compose' && typeOf(t.source) === 'FUNC' && typeOf(t.target) === 'FUNC').map((t) => t.source));
  const kandidaten = graph.elements
    .filter((e) => e.type === 'FUNC' && !block.has(e.id))
    .map((e) => ({ id: e.id, real: ref(e.attributes) }))
    .filter((k): k is { id: string; real: Ref } => k.real !== null && k.real.file.endsWith('.ts') && (k.real.file in quellen || k.real.file.startsWith('packages/')))
    .sort((a, b) => a.id.localeCompare(b.id));

  const imports = new Map<string, Set<string>>();
  const importiere = (pfad: string, symbol: string, alias: string): void => {
    if (!imports.has(pfad)) imports.set(pfad, new Set());
    imports.get(pfad)!.add(symbol === alias ? symbol : `${symbol} as ${alias}`);
  };
  const zeilen: string[] = [];
  const befunde: TypbindungBefund[] = [];
  const nichtPruefbar = (func: string, grund: string): void => {
    befunde.push({ func, klasse: 'nicht prüfbar', grund });
    zeilen.push(`// ${func}: nicht prüfbar — ${grund}`);
  };

  for (const { id: f, real } of kandidaten) {
    // Regel 6
    const text = quellen[real.file];
    if (text !== undefined) {
      const sym = escape(real.symbol);
      const exportiert = new RegExp(`export\\s+(async\\s+)?(function|const|let|class)\\s+${sym}\\b|export\\s*\\{[^}]*\\b${sym}\\b`).test(text);
      if (!exportiert) {
        nichtPruefbar(f, new RegExp(`\\b${sym}\\s*:\\s*MCPTool<`).test(text) ? 'MCP-Werkzeug, MCPTool<…> bindet den Typ' : 'nicht exportiert');
        continue;
      }
    }
    // Regel 1 und 2
    const flows = io
      .filter((t) => t.source === f || t.target === f)
      .map((t) => ({ flow: t.source === f ? t.target : t.source, dir: t.source === f ? ('OUT' as const) : ('IN' as const) }))
      .filter((x) => typeOf(x.flow) === 'FLOW' && istSync(x.flow));
    const sig: typeof flows = [];
    const offen: string[] = [];
    for (const x of flows) {
      const partner = io.filter((t) => (x.dir === 'IN' ? t.target === x.flow : t.source === x.flow)).map((t) => (x.dir === 'IN' ? t.source : t.target)).filter((p) => p !== f);
      const funcs = partner.filter((p) => typeOf(p) === 'FUNC');
      if (funcs.length === 0) {
        if (partner.some((p) => typeOf(p) === 'ACTOR')) sig.push(x);
        else offen.push(`${x.flow} ohne Partner`);
        continue;
      }
      const rufer = new Set(funcs.map((p) => aufrufer(f, p)));
      if (rufer.size === 1 && rufer.has(f)) continue; // Aufruf von f
      if (![...rufer].some((r) => r === f || r === null)) sig.push(x);
      else offen.push(x.flow);
    }
    if (offen.length) { nichtPruefbar(f, `Richtung offen: ${offen.sort().join(', ')}`); continue; }
    // Regel 3a
    const anfrageSchemas = [...new Set(sig.filter((x) => x.dir === 'IN').map((x) => schemaVon(x.flow) ?? x.flow))].sort();
    if (anfrageSchemas.length > 1) { nichtPruefbar(f, `mehrere Operationen: ${anfrageSchemas.join(', ')}`); continue; }
    // Regel 3, 4, 5
    const typ = (flow: string): string | null => {
      const s = schemaVon(flow);
      const r = s ? ref(byId.get(s)?.attributes) : null;
      if (!s || !r) return null;
      const alias = `${r.symbol}_${kennung(s)}`;
      importiere(importPfad(r.file, ziel), r.symbol, alias);
      return `z.infer<typeof ${alias}>`;
    };
    const ohneSchema = sig.filter((x) => schemaVon(x.flow) === null || !ref(byId.get(schemaVon(x.flow)!)?.attributes)).map((x) => x.flow);
    if (ohneSchema.length) { nichtPruefbar(f, `SCHEMA ohne realRef: ${ohneSchema.sort().join(', ')}`); continue; }
    const params = anfrageSchemas.length ? [typ(sig.find((x) => x.dir === 'IN')!.flow)!] : [];
    const rueck = [...new Set(sig.filter((x) => x.dir === 'OUT').sort((a, b) => a.flow.localeCompare(b.flow)).map((x) => typ(x.flow)!))];
    const R = rueck.length ? rueck.join(' | ') : 'void';
    const fn = `fn_${kennung(f)}`;
    importiere(importPfad(real.file, ziel), real.symbol, fn);
    const istAltlast = altlast.includes(f);
    befunde.push({ func: f, klasse: istAltlast ? 'altlast' : 'gebunden' });
    zeilen.push(`// ${f} — ${real.file}#${real.symbol}`);
    if (istAltlast) zeilen.push('// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)');
    zeilen.push(`export const _${kennung(f)}: (${params.map((p, i) => `p${i + 1}: ${p}`).join(', ')}) => (${R}) | Promise<${R}> = ${fn};`);
  }

  const kopf = [
    '// erzeugt aus dem Modell (graphcode typbindung) — je Blatt-FUNC die Signatur gegen Anfrage- und Antwort-SCHEMA.',
    '// Nicht von Hand ändern, neu erzeugen. Der Typprüfer (npm run type-check) meldet jede Abweichung (CR-GC-1026).',
    "import { z } from 'zod/v4';",
    ...[...imports].sort(([a], [b]) => a.localeCompare(b)).map(([pfad, syms]) => `import { ${[...syms].sort().join(', ')} } from '${pfad}';`),
    '',
  ];
  return TypbindungErgebnisSchema.parse({ text: [...kopf, ...zeilen, ''].join('\n'), befunde });
}
