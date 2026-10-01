/**
 * Werkzeugprofil je LLM-Art des Clients (CR-GC-723).
 *
 * Ein Client ohne Nachlade-Mechanik trägt die ganze `tools/list`-Antwort in jeder Anfrage. Für
 * ein Frontier-Modell ist das Rauschen, für ein lokales Modell mit 32k-Fenster ein Drittel des
 * Platzes. Dazu kommt der Entscheid vom 2026-09-28: ein lokales Modell verarbeitet die
 * Gate-Rückmeldungen nicht selbst — es gibt die Modellarbeit an den Executor im Host ab.
 *
 *   cloud — die volle Registry, unverändert.
 *   local — `graph_delegate` (der EINE Schreibweg) + drei Leser. Kein `graph_mutate`: zwei
 *           Schreibwege nebeneinander wären eine Wahl, die das lokale Modell falsch trifft.
 *
 * Der Server sieht den Client, nicht dessen Modell — deshalb sagt es ihm die Host-Config
 * (`GRAPHCODE_CLIENT_LLM`, vom Scaffold in `.mcp.json` / `opencode.json` geschrieben). Das Profil
 * ist eine SICHT auf die eine Registry: dieselben Handler, kein zweiter Bindungspfad.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import type { MCPToolRegistry } from '../kernel/tool-contract.js';
import { ersterSatz } from '../loop/executor-backend.js';

export const CLIENT_LLM_ENV = 'GRAPHCODE_CLIENT_LLM';

export const ClientLlmSchema = z.enum(['local', 'cloud']);
export type ClientLlm = z.infer<typeof ClientLlmSchema>;

/** Die Leser des lokalen Profils — ihre Beschreibung wird auf den ersten Satz gekürzt. */
export const LOCAL_READERS = ['graph_elements', 'graph_get_node', 'graph_context'] as const;

const OHNE_EXECUTOR =
  `${CLIENT_LLM_ENV}=local braucht den Abschnitt \`executor\` in graphcode.config.jsonc: ` +
  'das lokale Profil schreibt nur über graph_delegate, und das Werkzeug gibt es erst mit ' +
  'konfiguriertem lokalem Modell.';

/** Die LLM-Art aus der Umgebung. Nicht gesetzt = cloud; ein unbekannter Wert ist ein Fehler. */
export function clientLlmFromEnv(env: Record<string, string | undefined> = process.env): ClientLlm {
  const raw = env[CLIENT_LLM_ENV];
  if (raw === undefined || raw === '') return 'cloud';
  const parsed = ClientLlmSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`${CLIENT_LLM_ENV}="${raw}" ist ungültig — erlaubt: local | cloud`);
  return parsed.data;
}

/** Vor der Wahl geprüft, damit ein falsch konfigurierter Start keinen Store-Lock hinterlässt. */
export function assertProfileServable(kind: ClientLlm, hasDelegate: boolean): void {
  if (kind === 'local' && !hasDelegate) throw new Error(OHNE_EXECUTOR);
}

/** Die Sicht des Profils auf die gebundene Registry. */
export function applyToolProfile(registry: MCPToolRegistry, kind: ClientLlm): MCPToolRegistry {
  if (kind === 'cloud') return registry;
  const delegate = registry.graph_delegate;
  if (!delegate) throw new Error(OHNE_EXECUTOR);
  const sicht: MCPToolRegistry = { graph_delegate: delegate };
  for (const name of LOCAL_READERS) {
    const tool = registry[name];
    sicht[name] = { ...tool, description: ersterSatz(tool.description) };
  }
  return sicht;
}
