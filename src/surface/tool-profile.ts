/**
 * Werkzeugprofil je Schreibweg des Clients (CR-GC-723, CR-GC-772).
 *
 * Ein Client ohne Nachlade-Mechanik trägt die ganze `tools/list`-Antwort in jeder Anfrage. Für
 * ein Frontier-Modell ist das Rauschen, für ein lokales Modell mit 32k-Fenster ein Drittel des
 * Platzes. Dazu kam der Entscheid vom 2026-09-28: ein lokales Modell verarbeitet die
 * Gate-Rückmeldungen nicht selbst — es gibt die Modellarbeit an den Executor im Host ab.
 *
 *   direct   — die volle Registry, unverändert. Der Client schreibt selbst durchs Gate.
 *   delegate — `graph_delegate` (der EINE Schreibweg) + drei Leser. Kein `graph_mutate`: zwei
 *              Schreibwege nebeneinander wären eine Wahl, die das lokale Modell falsch trifft.
 *
 * GEPARKT seit 2026-10-03 (Entscheid des Autors, CR-GC-769): das Profil `delegate` und mit ihm der
 * Executor im Host. Ein lokales Modell mit Denkstufe (qwen3.8) schreibt selbst durchs Gate, gefuehrt
 * vom `vorschlag` nach jedem Zug; das Scaffold setzt deshalb fuer beide Hosts `direct`. Der Weg bleibt
 * waehlbar und getestet, wird aber nicht mehr gemessen und nicht weiterentwickelt.
 *
 * CR-GC-772: der Schalter hiess `GRAPHCODE_CLIENT_LLM=local|cloud` — er fragte nach der Art des
 * Modells und waehlte den Schreibweg. Er heisst jetzt nach dem, was er tut. Er bleibt je Client
 * (Entscheid des Autors 2026-10-09): Claude Code und OpenCode am selben Repo behalten je ihre Sicht.
 * Die alte Variable wird NICHT weitergelesen; `graphcode update` schreibt sie in der Host-Datei um.
 *
 * Der Server sieht den Client, nicht dessen Modell — deshalb sagt es ihm die Host-Config
 * (`GRAPHCODE_WRITE_PATH`, vom Scaffold in `.mcp.json` / `opencode.json` geschrieben). Das Profil
 * ist eine SICHT auf die eine Registry: dieselben Handler, kein zweiter Bindungspfad.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import type { MCPToolRegistry } from '../kernel/tool-contract.js';
import { ersterSatz } from '../loop/executor-backend.js';

export const WRITE_PATH_ENV = 'GRAPHCODE_WRITE_PATH';
/** Der Name bis CR-GC-772. Nur noch, um ihn abzuweisen und im Scaffold umzuschreiben. */
export const ALTER_SCHALTER = 'GRAPHCODE_CLIENT_LLM';

export const WritePathSchema = z.enum(['direct', 'delegate']);
export type WritePath = z.infer<typeof WritePathSchema>;

/** Was der alte Schalter hiess, im neuen Wort — fuer `graphcode update`. */
export const ALTER_WERT: Record<string, WritePath> = { cloud: 'direct', local: 'delegate' };

/** Die Leser des Profils delegate — ihre Beschreibung wird auf den ersten Satz gekürzt. */
export const LOCAL_READERS = ['graph_elements', 'graph_get_node', 'graph_context'] as const;

const OHNE_EXECUTOR =
  `${WRITE_PATH_ENV}=delegate braucht den Abschnitt \`executor\` in graphcode.config.jsonc: ` +
  'dieses Profil schreibt nur über graph_delegate, und das Werkzeug gibt es erst mit ' +
  'konfiguriertem lokalem Modell.';

/** Der Schreibweg aus der Umgebung. Nicht gesetzt = direct; ein unbekannter Wert ist ein Fehler. */
export function writePathFromEnv(env: Record<string, string | undefined> = process.env): WritePath {
  if (env[ALTER_SCHALTER] !== undefined) {
    throw new Error(
      `${ALTER_SCHALTER} heißt jetzt ${WRITE_PATH_ENV} (direct | delegate) — ` +
        '`graphcode update` schreibt .mcp.json und opencode.json um.',
    );
  }
  const raw = env[WRITE_PATH_ENV];
  if (raw === undefined || raw === '') return 'direct';
  const parsed = WritePathSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`${WRITE_PATH_ENV}="${raw}" ist ungültig — erlaubt: direct | delegate`);
  return parsed.data;
}

/** Vor der Wahl geprüft, damit ein falsch konfigurierter Start keinen Store-Lock hinterlässt. */
export function assertProfileServable(kind: WritePath, hasDelegate: boolean): void {
  if (kind === 'delegate' && !hasDelegate) throw new Error(OHNE_EXECUTOR);
}

/** Die Sicht des Profils auf die gebundene Registry. */
export function applyToolProfile(registry: MCPToolRegistry, kind: WritePath): MCPToolRegistry {
  if (kind === 'direct') return registry;
  const delegate = registry.graph_delegate;
  if (!delegate) throw new Error(OHNE_EXECUTOR);
  const sicht: MCPToolRegistry = { graph_delegate: delegate };
  for (const name of LOCAL_READERS) {
    const tool = registry[name];
    sicht[name] = { ...tool, description: ersterSatz(tool.description) };
  }
  return sicht;
}
