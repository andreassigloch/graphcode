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
 * @author andreas@siglochconsulting
 */
import type { ZodType } from 'zod/v4';
import type { AuditLog } from '@sigloch/graph-api-core';
import type { MutateCommand, MutateResult } from '@sigloch/contracts/harness';
import type { GraphCodeHarness } from './harness.js';

export interface MCPTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: ZodType<TInput>;
  handler: (input: TInput) => Promise<TOutput>;
}

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
}
