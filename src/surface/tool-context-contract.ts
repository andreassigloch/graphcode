/**
 * tool-context-contract.ts — SCHEMA-tool-context, der Vertrag des Werkzeug-Kontexts
 * (FLOW-tool-context, CR-GC-523, ITEM-2026-064).
 *
 * `createToolContext` baut den Kontext, `bindToolsToHarness` reicht ihn an jede
 * Tool-Gruppe (auch der Host-Shim, fuer seine Vorlage mit gesperrtem Stand-in-Harness).
 * Bis hierher war er ein TS-Interface; jetzt ist der Typ aus dem Schema abgeleitet und
 * die Uebergabe wird geparst. Strikt, weil der Kontext ein Objektliteral
 * ist und ein unbekannter Schluessel in jede Registry-Enumeration lecken wuerde
 * (mcp.symmetry). Funktionen prueft z.custom auf Aufrufbarkeit; die Datenanteile
 * hinter den Zugriffen (Graphversion, Sitzungskennung, Besitzer-PID) prueft der
 * Refine — Zustand, der in Closures lebt, ist nur so erreichbar.
 *
 * Der Kontext erfuellt `ToolPort` (den Ausschnitt, den eine Tool-Fabrik braucht) —
 * unten erzwungen, nicht kommentiert.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import { FormatECodec } from '@sigloch/graph-api-core';
import type { AuditLog } from '@sigloch/graph-api-core';
import type { MutateCommand, MutateResult } from '@sigloch/contracts/harness';
import type { GraphCodeHarness } from '../kernel/harness.js';
import { forwardIssues } from '../kernel/harness-handle-contract.js';
import type { ToolPort } from '../kernel/tool-contract.js';
import { GraphCodeCodec } from '../projections/codec.js';
import type { EditSource, TrajectoryStamps } from '../projections/trajectory.js';
import type { AuditOrigin, TemplateEdit } from './tool-context.js';

/** Ein aufrufbares Mitglied mit seiner Signatur — die Abweisung nennt es beim Namen. */
const member = <F extends (...args: never[]) => unknown>(name: string) =>
  z.custom<F>((v) => typeof v === 'function', { message: `${name} muss eine Funktion sein` });

const GraphVersion = z.number().int().min(0);
const SessionId = z.string().min(1);
const OwnerPid = z.string().min(1).nullable();

export const ToolContext = z
  .strictObject({
    /**
     * Der Griff wird an SEINER Grenze geprueft — `HarnessHandle.parse` in `createHarness`
     * (FLOW-harness-handle), nicht hier ein zweites Mal. Der Host-Shim bindet die
     * Werkzeug-Vorlage bewusst an einen zugriffsgesperrten Stand-in (`buildProxyRegistry`:
     * „the template must stay unbound"); eine strukturelle Pruefung hier wuerde genau
     * diesen Zugriff ausloesen. Hier gilt: ein Objekt liegt vor, kein null/Primitiv.
     */
    harness: z.custom<GraphCodeHarness>((v) => typeof v === 'object' && v !== null, {
      message: 'harness muss ein Objekt sein (Griff geprueft in createHarness)',
    }),
    auditLog: z.custom<AuditLog>(
      (v) => typeof (v as AuditLog | null)?.record === 'function' && typeof (v as AuditLog | null)?.query === 'function',
      { message: 'auditLog muss record() und query() tragen' },
    ),
    /** Format-E serializer for the slice tools. */
    codec: z.instanceof(FormatECodec),
    /** Format-E v2 wrapper for the opt-in read-tool slices (CR-GC-210, CR-GC-269). */
    gcCodec: z.instanceof(GraphCodeCodec),
    /** Read accessor for the applied-batch counter (never a settable field). */
    graphVersion: member<() => number>('graphVersion'),
    /**
     * CR-GC-363: genau EINE Format-E-Kopfzeile (`//`-Kommentar, ohne '\n'), wenn ein
     * VORHANDENER AF-Freshness-Stamp hinter dem Live-graphVersion liegt; sonst ''.
     */
    staleAnalysisBanner: member<() => string>('staleAnalysisBanner'),
    /**
     * The ONLY writer of the version + the audit log (no audit bypass, CR-GC-232).
     * `stamps` (CR-GC-434) carries what only the GATE PATH can determine.
     */
    recordAudit:
      member<
        (
          consumerId: string,
          result: MutateResult,
          commands?: MutateCommand[],
          stamps?: Pick<TrajectoryStamps, 'respondsTo' | 'editSource'>,
        ) => Promise<void>
      >('recordAudit'),
    /** Audit a dryRun preview as `operation:'validate'` (CR-GC-276) — the version does NOT move. */
    recordPreview:
      member<(consumerId: string, result: MutateResult, commands: MutateCommand[]) => Promise<void>>('recordPreview'),
    /** Note a READ tool that completed (CR-GC-434) — drained onto the next recorded mutation. */
    noteConsulted: member<(toolName: string) => void>('noteConsulted'),
    /** Note the template edits graph_suggest DELIVERED (CR-GC-434). */
    noteTemplateEdits: member<(edits: TemplateEdit[]) => void>('noteTemplateEdits'),
    /** 'suggestion-template' iff the whole batch is delivered template edits; else 'authored'. */
    classifyEditSource: member<(commands: MutateCommand[]) => EditSource>('classifyEditSource'),
    /** Set the provenance stamped onto every SUBSEQUENT record (CR-GC-354); replaces wholesale. */
    setOrigin: member<(origin: AuditOrigin) => void>('setOrigin'),
    /** The session id stamped on this context's records — one per host process. */
    sessionId: member<() => string>('sessionId'),
    /** The client process this one belongs to (CR-GC-357), or null when the ancestry is unknown. */
    ownerPid: member<() => string | null>('ownerPid'),
    /** Run a write body on the single tool-write chain (check+gate+record atomic). */
    serializeToolWrite: member<<T>(body: () => Promise<T>) => Promise<T>>('serializeToolWrite'),
    /** Stale-base rejection with staleDelta, or null when the base is fresh (CR-GC-233). */
    occReject:
      member<
        (
          consumerId: string,
          baseVersion: number | undefined,
          commands: MutateCommand[] | undefined,
        ) => Promise<(MutateResult & { graphVersion: number }) | null>
      >('occReject'),
  })
  .superRefine((ctx, ref) => {
    // Nur erreicht, wenn die Form stimmt (zod ueberspringt Refines nach Formfehlern).
    forwardIssues(ref, ['graphVersion'], GraphVersion.safeParse(ctx.graphVersion()));
    forwardIssues(ref, ['sessionId'], SessionId.safeParse(ctx.sessionId()));
    forwardIssues(ref, ['ownerPid'], OwnerPid.safeParse(ctx.ownerPid()));
  });

/** Everything a tool group needs; the state behind it exists once per bound registry. */
export type ToolContext = z.infer<typeof ToolContext>;

/** Der Kontext erfuellt den Port der Tool-Fabriken — erzwungen beim Kompilieren. */
const _portCheck: ToolPort = null as unknown as ToolContext;
