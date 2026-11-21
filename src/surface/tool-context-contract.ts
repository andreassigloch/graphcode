/**
 * tool-context-contract.ts — SCHEMA-tool-context, der Vertrag des Werkzeug-Kontexts
 * (FLOW-tool-context, CR-GC-523, ITEM-2026-064; ohne z.custom und superRefine CR-GC-991).
 *
 * `createToolContext` baut den Kontext, `bindToolsToHarness` reicht ihn an jede
 * Tool-Gruppe (auch der Host-Shim, fuer seine Vorlage mit gesperrtem Stand-in-Harness).
 * Strikt, weil der Kontext ein Objektliteral ist und ein unbekannter Schluessel in jede
 * Registry-Enumeration lecken wuerde (mcp.symmetry).
 *
 * Der Vertrag ist die Form: jedes Mitglied eine Funktion (`z.function()`), die Traeger
 * Objekte. Die genaue Signatur jedes Mitglieds steht an der Schnittstelle `ToolContext`
 * (sie erweitert `ToolPort`), nicht im Schema; `satisfies Record<keyof ToolContext, …>`
 * haelt beide Listen gleich. Was die Zugriffe zurueckgeben (Graphversion, Sitzungskennung,
 * Besitzer-PID), ist Verhalten und steht im Test der Funktionen, nicht im Schema.
 *
 * `parse` liefert eine Kopie. Der Erzeuger prueft und gibt das ORIGINAL zurueck.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import type { MutateCommand, MutateResult } from '@sigloch/contracts/harness';
import type { ToolPort } from '../kernel/tool-contract.js';
import type { EditSource, TrajectoryStamps } from '../projections/trajectory.js';
import type { AuditOrigin } from './tool-context.js';

/** Everything a tool group needs; the state behind it exists once per bound registry. */
export interface ToolContext extends ToolPort {
  /**
   * The ONLY writer of the version + the audit log (no audit bypass, CR-GC-232).
   * `stamps` (CR-GC-434) carries what only the GATE PATH can determine.
   */
  recordAudit(
    consumerId: string,
    result: MutateResult,
    commands?: MutateCommand[],
    stamps?: Pick<TrajectoryStamps, 'respondsTo' | 'editSource' | 'skill'>,
  ): Promise<void>;
  /** Audit a dryRun preview as `operation:'validate'` (CR-GC-276) — the version does NOT move. */
  recordPreview(consumerId: string, result: MutateResult, commands: MutateCommand[], skill?: string): Promise<void>;
  /** Note a READ tool that completed (CR-GC-434) — drained onto the next recorded mutation. */
  noteConsulted(toolName: string): void;
  /** Note the template batches graph_suggest DELIVERED, as commands (CR-GC-434, CR-GC-696C). */
  noteTemplateEdits(commands: MutateCommand[]): void;
  /** 'suggestion-template' iff the whole batch is delivered template edits; else 'authored'. */
  classifyEditSource(commands: MutateCommand[]): EditSource;
  /** Set the provenance stamped onto every SUBSEQUENT record (CR-GC-354); replaces wholesale. */
  setOrigin(origin: AuditOrigin): void;
  /** The session id stamped on this context's records — one per host process. */
  sessionId(): string;
  /** The client process this one belongs to (CR-GC-357), or null when the ancestry is unknown. */
  ownerPid(): string | null;
  /** Stale-base rejection with staleDelta, or null when the base is fresh (CR-GC-233). */
  occReject(
    consumerId: string,
    baseVersion: number | undefined,
    commands: MutateCommand[] | undefined,
    skill?: string,
  ): Promise<(MutateResult & { graphVersion: number }) | null>;
}

/**
 * Die Mitglieder des Vertrags. `harness` ist ein Objekt, kein Griff: der Griff wird an SEINER
 * Grenze geprueft (`HarnessHandle.parse` in `createHarness`, FLOW-harness-handle). Der Host-Shim
 * bindet die Werkzeug-Vorlage bewusst an einen zugriffsgesperrten Stand-in (`buildProxyRegistry`:
 * „the template must stay unbound"); ein Vertrag, der die Mitglieder des Griffs liest, wuerde
 * genau diesen Zugriff ausloesen.
 */
const Mitglieder = {
  harness: z.looseObject({}),
  auditLog: z.looseObject({ record: z.function(), query: z.function() }),
  graphVersion: z.function(),
  recordAudit: z.function(),
  recordPreview: z.function(),
  noteConsulted: z.function(),
  noteTemplateEdits: z.function(),
  classifyEditSource: z.function(),
  setOrigin: z.function(),
  sessionId: z.function(),
  ownerPid: z.function(),
  serializeToolWrite: z.function(),
  arbeitsmenge: z.function(),
  occReject: z.function(),
} satisfies Record<keyof ToolContext, z.ZodType>;

export const ToolContext = z.strictObject(Mitglieder);
