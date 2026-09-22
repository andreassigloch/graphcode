/**
 * tool-contract.ts — was ein Werkzeug IST und was es vom Host BRAUCHT (CR-GC-480).
 *
 * `MCPTool` / `MCPToolRegistry` lagen in `surface/mcp-tools.ts`; jede Schicht, die ihre
 * eigenen Tools baut (`loop`, `projections`), importierte sie von dort — die Schicht
 * kannte das Werkzeug-Interface ihrer Oberfläche (13 Typ-Importe nach oben, CR-GC-467).
 * Der Vertrag liegt jetzt unten; die Oberfläche erfüllt ihn.
 *
 * `ToolPort` ist die Interface-Segregation dazu: die fünf Member, die eine Tool-Fabrik
 * tatsächlich destrukturiert. Den vollen Host-Kontext (`ToolContext` — Codec, Audit-
 * Origin, Session, OCC …) kennt nur die Oberfläche; `ToolContext extends ToolPort`.
 * `recordAudit` steht hier OHNE den optionalen `stamps`-Parameter — den kennt nur der
 * Gate-Pfad der Oberfläche, und keine Fabrik übergibt ihn. Ein Kontext mit dem
 * zusätzlichen optionalen Parameter bleibt dem Port zuweisbar.
 *
 * CR-GC-547: die drei Vertraege sind **Zod-first**. Vorher standen sie nur als TS-Typen da —
 * zur Laufzeit hielt sie nichts, und R-32/RC-04 hatten recht: ein realisierter SCHEMA ohne
 * Vertrags-TEST und ohne `parse`-Stelle ist eine Behauptung. Die Vorgabe „Zod plus Test" gilt
 * auch fuer Vertraege mit Funktionsmitgliedern; `z.custom` prueft dort, was pruefbar ist —
 * dass die Funktion da und eine Funktion ist. Das faengt genau den Fehler, der an dieser
 * Grenze vorkommt: eine Fabrik, die ein Member vergisst oder falsch benennt.
 *
 * KEIN paralleler Pfad: die generische TS-Sicht `MCPTool<TInput, TOutput>` bleibt, weil ein
 * Laufzeit-Schema keine Typparameter traegt. Der Test bindet beide Seiten aneinander — er
 * parst ein ECHTES Werkzeug aus der echten Registry, nicht eine Attrappe.
 *
 * `ToolPort` bekommt bewusst KEIN eigenes Schema. Ein erster Anlauf hat eins gebaut und war
 * sofort ein Duplikat: `tool-context-contract.ts` prueft `harness`, `auditLog` und die
 * Funktions-Member laengst (`ToolContext.parse` in `createToolContext`), und `_portCheck`
 * erzwingt beim Kompilieren, dass der Kontext den Port erfuellt. Zwei Schemata fuer eine
 * Teilmenge waeren genau der parallele Pfad, den dieser Zug beseitigen soll.
 *
 * @author andreas@siglochconsulting
 */
import { z, type ZodType } from 'zod/v4';
import type { AuditLog } from '@sigloch/graph-api-core';
import type { MutateCommand, MutateResult } from '@sigloch/contracts/harness';
import type { GraphCodeHarness } from './harness.js';
import type { Arbeitsmenge } from './measure/working-set.js';

/** Der Laufzeit-Vertrag eines Werkzeugs (CR-GC-547). Die generische Sicht steht darunter. */
export const MCPToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  inputSchema: z.custom<ZodType>(
    (v) => typeof (v as { safeParse?: unknown } | null)?.safeParse === 'function',
    { message: 'inputSchema ist kein Zod-Schema' },
  ),
  handler: z.custom<(input: never) => Promise<unknown>>((v) => typeof v === 'function', {
    message: 'handler fehlt oder ist keine Funktion',
  }),
});

export interface MCPTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: ZodType<TInput>;
  handler: (input: TInput) => Promise<TOutput>;
}

/** Der Laufzeit-Vertrag des Registers: jeder Wert ist ein Werkzeug (CR-GC-547). */
export const MCPToolRegistrySchema = z.record(z.string(), MCPToolSchema);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MCPToolRegistry = Record<string, MCPTool<any, any>>;

/** Was eine Tool-Fabrik vom Host braucht — nicht mehr. Die Oberfläche erfüllt ihn (`ToolContext`). */
export interface ToolPort {
  readonly harness: GraphCodeHarness;
  readonly auditLog: AuditLog;
  /** Read accessor for the applied-batch counter (never a settable field). */
  graphVersion(): number;
  /** Der EINE Schreiber von Version und Audit-Log (kein Audit-Bypass, CR-GC-232). */
  recordAudit(consumerId: string, result: MutateResult, commands?: MutateCommand[]): Promise<void>;
  /** Serialisiert Tool-Schreibpfade (OCC, CR-GC-3xx) — eine Schreibkette, nie zwei. */
  serializeToolWrite<T>(body: () => Promise<T>): Promise<T>;
  /**
   * CR-GC-613 — die eigene Arbeitsmenge der Sitzung (jede uid, die ein angewandter Schreibzug seit
   * dem Binden angefasst hat). Die Lesewerkzeuge schneiden darauf und nennen den Umfang; leer
   * heisst "noch kein Zug" und damit ganzes Modell.
   */
  arbeitsmenge(): Promise<Arbeitsmenge>;
}
