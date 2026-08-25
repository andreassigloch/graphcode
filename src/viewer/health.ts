/**
 * health.ts — SCHEMA-health-report, der Datenvertrag von `GET /health`
 * (FLOW-health-report, CR-GC-414).
 *
 * Warum eine eigene Datei und nicht ein `const` in `host.ts`: der Vertrag muss dort
 * IMPORTIERT werden, wo er geprüft wird. Eine Deklaration im selben File zählt als
 * Bindung nicht (RC-04 verlangt Import UND `parse`) — und sachlich ist das richtig
 * herum: `host.ts` ist ein Produzent dieser Antwort, nicht ihr Eigentümer. Der
 * Konsument ist der Viewer, also ein anderer Prozess; was zwischen beiden fließt,
 * gehört keinem von beiden allein.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';

/**
 * Live health payload for `GET /health` (REQ-real-health-check).
 *
 * Kein „Lichter an": `store` und `gate` sind das Ergebnis einer echten Abfrage bzw.
 * einer echten Regelauswertung, nicht ein gesetztes Flag.
 */
export const HealthPayloadSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  /** Store reachable — proven by a real query, not a flag. */
  store: z.enum(['reachable', 'unreachable']),
  /** Gate functional — proven by a real rule-eval, not a flag. */
  gate: z.enum(['functional', 'broken']),
  /** Node count returned by the live store query. */
  nodeCount: z.number().int().nonnegative(),
  /** SE schema versions the gate enforces (imported, never forked). */
  versions: z.object({
    ontology: z.string(),
    rules: z.string(),
    metaModel: z.string(),
    ruleCount: z.number().int().nonnegative(),
  }),
  /** Number of currently connected SSE clients. */
  sseClients: z.number().int().nonnegative(),
});

/** Die Antwortform von `GET /health`, aus ihrem Vertrag abgeleitet — eine Definition. */
export type HealthPayload = z.infer<typeof HealthPayloadSchema>;
