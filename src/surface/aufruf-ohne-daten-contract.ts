/**
 * aufruf-ohne-daten-contract.ts — SCHEMA-aufruf-ohne-daten, der Aufruf, der nichts überträgt
 * (CR-GC-989).
 *
 * `gve.stop()` meldet die Sitzung ab, ohne einen Wert. Der Vertrag sagt das aus: Ein Argument
 * wäre ein Fehler des Aufrufers, kein stiller Zusatz.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';

/** Ein Aufruf ohne Daten: kein Argument. */
export const AufrufOhneDatenSchema = z.void();
