/**
 * config.ts — die editierbare Betriebs-Config des Repos (CR-GC-329).
 *
 * WARUM eine Datei: seit CR-SM-233 sind die Urteilsschwellen der Architektur-Metriken
 * Eingabe und haben keinen Default mehr im Regelcode. Dieser Parameter braucht einen
 * Halter, den ein Mensch editieren kann — und der Wert muss **genau einmal** existieren:
 * dieselbe Zahl, gegen die geurteilt wird, geht mit der Kennzahl zum Konsumenten raus
 * (`graph_metrics.policy`), damit ein Dashboard „71 % / Ziel ≤ 70 %" beide Zahlen aus
 * einem Aufruf hat und keinen eigenen Zielwert kennt.
 *
 * WARUM JSONC und nicht JSON: der Anlass für die Datei ist gerade, dass ein stillgelegter
 * Wert seine Begründung neben sich trägt (`"instability": null, // MT-01 unvalidiert,
 * CR-SM-223`). In JSON wäre die Begründung nicht schreibbar, und ein Wert ohne Begründung
 * ist in einem Jahr nicht mehr überprüfbar.
 *
 * KEIN stiller Fallback: fehlt die Datei, gilt `DEFAULT_METRIC_POLICY` aus contracts —
 * aber die Antwort sagt das (`policySource: 'default'`). Ist die Datei da und
 * schemawidrig, bricht der Start mit Pfad und Feld ab; wer die Datei erkennbar gemeint
 * hat, bekommt keinen Default untergeschoben.
 *
 * KEINE Schwellenlogik hier: geurteilt wird in den contracts-Regeln. Diese Datei hält
 * den Wert und reicht ihn durch.
 *
 * @author andreas@siglochconsulting
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod/v4';
import { MetricPolicySchema, DEFAULT_METRIC_POLICY, type MetricPolicy } from '@sigloch/contracts/se';

/** Dateiname im `repoRoot` — eine Stelle, kein Suchpfad. */
export const CONFIG_FILENAME = 'graphcode.config.jsonc';

/**
 * „Ist diese Dimension zu schwach?" — EINE Zahl für Fokuswahl und `ready`-Flag.
 *
 * Bis CR-GC-329 hatte dieselbe Frage zwei Antworten: `threshold = 0.8` als
 * Default-Parameter in `generate.ts` (Fokuswahl) und `score >= 0.7` in se-steering
 * (`ready`). Der Wert steht ab hier in der Config; der Startwert ist die schärfere der
 * beiden (0.8), weil er die Fokuswahl steuert und ein zu niedriger Wert eine schwache
 * Dimension als „fertig" durchwinkt.
 */
export const DEFAULT_FOCUS_THRESHOLD = 0.8;

export const GraphcodeConfigSchema = z.object({
  /** Urteilsschwellen der Architektur-Metriken (contracts). `null` = messen, nicht urteilen. */
  metricPolicy: MetricPolicySchema,
  /** Schwelle, unter der eine Readiness-Dimension als zu schwach gilt. */
  focusThreshold: z.number().min(0).max(1),
});

export type GraphcodeConfig = z.infer<typeof GraphcodeConfigSchema>;

/** Woher die geltenden Werte stammen — geht mit den Kennzahlen an den Konsumenten. */
export type PolicySource = 'config' | 'default';

export interface LoadedConfig {
  config: GraphcodeConfig;
  source: PolicySource;
  /** Absoluter Pfad der Datei — auch wenn sie fehlt (dann: wo sie erwartet wurde). */
  path: string;
}

export const DEFAULT_CONFIG: GraphcodeConfig = {
  metricPolicy: DEFAULT_METRIC_POLICY,
  focusThreshold: DEFAULT_FOCUS_THRESHOLD,
};

/**
 * JSONC → JSON: Zeilen-/Blockkommentare und abschließende Kommas raus, Strings intakt.
 *
 * Bewusst kein Parser-Paket: die Datei ist unser eigenes Format an genau einer Stelle,
 * und ein String-Literal mit `//` darin (ein Pfad, eine URL) ist der einzige Fall, den
 * ein naives Regex zerstören würde — deshalb der Zeichen-Scanner statt eines Regex.
 */
export function stripJsonComments(text: string): string {
  let out = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inLine) {
      if (c === '\n') { inLine = false; out += c; }
      continue;
    }
    if (inBlock) {
      if (c === '*' && next === '/') { inBlock = false; i++; }
      else if (c === '\n') out += c; // Zeilenzählung für Fehlermeldungen erhalten
      continue;
    }
    if (inString) {
      out += c;
      if (c === '\\') { out += text[++i] ?? ''; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === '/' && next === '/') { inLine = true; i++; continue; }
    if (c === '/' && next === '*') { inBlock = true; i++; continue; }
    out += c;
  }

  // Abschließende Kommas (`, }` / `, ]`) — in JSONC erlaubt, in JSON.parse nicht.
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/** Fehler beim Laden der Config — trägt Pfad und Feld, damit der Start nicht rät. */
export class ConfigError extends Error {
  constructor(readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'ConfigError';
  }
}

/**
 * Config des Repos laden. Fehlt die Datei → `DEFAULT_CONFIG` mit `source: 'default'`.
 * Ist sie da und kaputt → `ConfigError` (kein Fallback).
 */
export function loadGraphcodeConfig(repoRoot: string): LoadedConfig {
  const path = join(repoRoot, CONFIG_FILENAME);

  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { config: DEFAULT_CONFIG, source: 'default', path };
    }
    throw new ConfigError(path, `not readable — ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonComments(raw));
  } catch (err) {
    throw new ConfigError(path, `invalid JSONC — ${(err as Error).message}`);
  }

  const result = GraphcodeConfigSchema.safeParse(parsed);
  if (!result.success) {
    const fields = result.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    throw new ConfigError(path, `does not match GraphcodeConfigSchema — ${fields}`);
  }

  return { config: result.data, source: 'config', path };
}

/** Die geltende Metrik-Policy — der Wert, der mit jeder Kennzahl herausgeht. */
export function metricPolicyOf(loaded: LoadedConfig): MetricPolicy {
  return loaded.config.metricPolicy;
}
