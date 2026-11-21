/**
 * session-end-contract.ts — SCHEMA-sitzungsende, die Ereignisse, die eine Host-Sitzung beenden
 * (CR-GC-989).
 *
 * Die Liste steht hier und nirgends sonst: `SessionLifecycle.installTriggers` bindet die Signale
 * daraus, `end` parst jeden Grund dagegen. Ein neues Ereignis ist ein Wert mehr in dieser Aufzählung.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';

/** Die Ereignisse, auf die der Host reagiert: drei Signale, das Ende des stdio-Clients, der Verlust des Store-Locks. */
export const SitzungsendeSchema = z.enum(['SIGINT', 'SIGTERM', 'SIGHUP', 'client disconnected', 'store lock lost']);

/** Ein Ereignis des Sitzungsendes, aus seinem Vertrag abgeleitet — eine Definition. */
export type Sitzungsende = z.infer<typeof SitzungsendeSchema>;

/** Die Signale unter den Ereignissen: ihr Wert ist der Signalname. */
export const SITZUNGSENDE_SIGNALE = SitzungsendeSchema.options.filter(
  (e): e is Extract<Sitzungsende, `SIG${string}`> => e.startsWith('SIG'),
);
