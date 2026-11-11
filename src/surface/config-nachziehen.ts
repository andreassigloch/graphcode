/**
 * config-nachziehen.ts — fehlende Pflichtfelder der Metrik-Policy in eine bestehende
 * `graphcode.config.jsonc` eintragen (CR-GC-915).
 *
 * WARUM: contracts fuehrt neue Felder an `MetricPolicy` als Pflichtfeld ein (zuletzt
 * `needNameTerms`, CR-SM-434). Eine Config, die vor dem Feld entstand, ist danach
 * schemawidrig, und der Host bricht beim Start ab (`ConfigError`, kein Fallback). Der Abbruch
 * bleibt richtig; das Nachtragen gehoert in den Schritt, der das Repo ohnehin auf die neue
 * Version hebt: `update` bzw. `upgrade --refresh-only`, ausgefuehrt vom NEU installierten Build.
 *
 * WAS: jedes Feld aus `DEFAULT_METRIC_POLICY`, das in `metricPolicy` der Datei fehlt, wird mit
 * dem Startwert eingetragen, direkt hinter `"metricPolicy": {`, mit einer Kommentarzeile, die
 * Herkunft und Anlass nennt. Bestehende Werte und Kommentare bleiben zeichengleich. Ein Feld,
 * das schon da ist, wird nie ueberschrieben, auch nicht mit `null`.
 *
 * @author andreas@siglochconsulting
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import { CONFIG_FILENAME, ConfigError, GraphcodeConfigSchema, stripJsonComments } from '../kernel/config.js';

const OEFFNUNG = /"metricPolicy"\s*:\s*\{/;

/**
 * Traegt die fehlenden Policy-Felder ein und gibt ihre Namen zurueck. Leer heisst: Datei fehlt
 * (dann gilt der Startwert ohnehin) oder sie ist vollstaendig. `dry` schreibt nichts.
 * Wirft `ConfigError`, wenn die Datei kein lesbares JSONC ist oder nach dem Eintragen nicht
 * gegen das Schema laedt — geprueft wird vor dem Schreiben, ein halber Stand entsteht nie.
 */
export function policyNachziehen(repoRoot: string, options: { dry?: boolean } = {}): string[] {
  const path = join(repoRoot, CONFIG_FILENAME);
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8');

  let parsed: { metricPolicy?: Record<string, unknown> };
  try {
    parsed = JSON.parse(stripJsonComments(raw));
  } catch (err) {
    throw new ConfigError(path, `invalid JSONC — ${(err as Error).message}`);
  }
  const vorhanden = parsed.metricPolicy;
  if (!vorhanden || typeof vorhanden !== 'object') {
    throw new ConfigError(path, '`metricPolicy` fehlt — nichts nachzutragen, die Datei ist von Hand zu pruefen');
  }

  const fehlend = Object.keys(DEFAULT_METRIC_POLICY).filter((k) => !(k in vorhanden));
  if (fehlend.length === 0 || options.dry) return fehlend;

  const treffer = OEFFNUNG.exec(raw);
  if (!treffer) throw new ConfigError(path, '`"metricPolicy": {` nicht gefunden — nichts eingetragen');
  const einzug = '    ';
  const zeilen = fehlend.map((k) => {
    const wert = JSON.stringify((DEFAULT_METRIC_POLICY as Record<string, unknown>)[k]);
    return `\n${einzug}// ${k}: Startwert aus @sigloch/contracts, von graphcode upgrade eingetragen (CR-GC-915).\n${einzug}"${k}": ${wert},\n`;
  });
  const ende = treffer.index + treffer[0].length;
  const neu = raw.slice(0, ende) + zeilen.join('') + raw.slice(ende);
  const pruefung = GraphcodeConfigSchema.safeParse(JSON.parse(stripJsonComments(neu)));
  if (!pruefung.success) {
    const felder = pruefung.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ConfigError(path, `auch nach dem Eintragen schemawidrig, nichts geschrieben — ${felder}`);
  }
  writeFileSync(path, neu);
  return fehlend;
}
