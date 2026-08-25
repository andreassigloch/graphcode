/**
 * schema-fingerprint-contract.ts — SCHEMA-schema-fingerprint, der Datenvertrag der
 * Marker-Datei `ontology.schema` neben dem Kuzu-Store (FLOW-schema-fingerprint,
 * CR-GC-421).
 *
 * Warum das geprüft gehört und nicht nur gelesen: der Marker entscheidet, ob der
 * Store WEGGEWORFEN und neu befüllt wird. Ein abgeschnittener oder halb
 * geschriebener Marker verglich sich bisher schlicht als „anders" — und damit
 * wischte ein kaputtes Byte den Store. Ein fehlender Marker führt ausdrücklich
 * NICHT dazu (er wird beim aktuellen Fingerabdruck adoptiert); ein unlesbarer
 * verhält sich seit jeher wie ein fehlender. Ein formfremder muss dasselbe tun.
 *
 * Eigene Datei, weil der Marker eine Prozessgrenze quert (geschrieben beim
 * Anlegen, gelesen beim nächsten Start — oft von einem anderen Build) und weil
 * RC-04 Import UND `parse` am modellierten Interface verlangt.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';

/**
 * Der Fingerabdruck der generierten DDL: die ersten 16 Hex-Zeichen eines
 * SHA-256. Die Länge ist Teil des Vertrags — sie ist der Unterschied zwischen
 * „anderer Schemastand" und „kaputte Datei".
 */
export const SchemaFingerprintSchema = z.string().regex(/^[0-9a-f]{16}$/);

/** Ein Schema-Fingerabdruck, aus seinem Vertrag abgeleitet. */
export type SchemaFingerprint = z.infer<typeof SchemaFingerprintSchema>;
