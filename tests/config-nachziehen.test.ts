/**
 * CR-GC-915 — eine Config, die vor einem neuen Pflichtfeld der Metrik-Policy entstand, wird von
 * `graphcode upgrade` (Schritt `--refresh-only`, intern `scaffold(update)`) nachgezogen, statt den Host am Start
 * zu brechen.
 *
 * Der gemessene Mangel: contracts 12.12 macht `needNameTerms` zum Pflichtfeld (CR-SM-434). Alle
 * 14 `graphcode.config.jsonc` der Familie trugen es nicht; `loadGraphcodeConfig` warf
 * `ConfigError`, der Host startete nicht. Echte Dateien im tmp-Verzeichnis, keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import { CONFIG_FILENAME, ConfigError, loadGraphcodeConfig } from '../src/kernel/config.js';
import { policyNachziehen } from '../src/surface/config-nachziehen.js';
import { scaffold } from '../src/surface/scaffold.js';

const roots: string[] = [];
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

/** Eine Config wie vor CR-SM-434: vollstaendig bis auf `needNameTerms`, mit Kommentar. */
function alteConfig(): { root: string; text: string } {
  const root = mkdtempSync(join(tmpdir(), 'graphcode-nachziehen-'));
  roots.push(root);
  const { needNameTerms: _weg, ...alt } = DEFAULT_METRIC_POLICY;
  const policy = { ...alt, instability: null };
  const text = [
    '// Repo-Config',
    '{',
    '  "metricPolicy": {',
    '    // MT-01 still: gesetzt, nicht gemessen',
    ...Object.entries(policy).map(([k, v]) => `    "${k}": ${JSON.stringify(v)},`),
    '  },',
    '  "focusThreshold": 0.8',
    '}',
    '',
  ].join('\n');
  writeFileSync(join(root, CONFIG_FILENAME), text);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'probe', version: '0.0.0' }));
  return { root, text };
}

describe('CR-GC-915: fehlende Policy-Felder nachziehen', () => {
  it('Ausgangslage: die alte Config bricht das Laden', () => {
    const { root } = alteConfig();
    expect(() => loadGraphcodeConfig(root)).toThrow(ConfigError);
  });

  it('traegt needNameTerms mit dem Startwert ein, alles andere bleibt zeichengleich', () => {
    const { root, text } = alteConfig();
    expect(policyNachziehen(root)).toEqual(['needNameTerms']);

    const neu = readFileSync(join(root, CONFIG_FILENAME), 'utf8');
    for (const zeile of text.split('\n')) expect(neu).toContain(zeile);
    expect(neu).toMatch(/\/\/ needNameTerms: Startwert aus @sigloch\/contracts/);

    const geladen = loadGraphcodeConfig(root).config.metricPolicy;
    expect(geladen.needNameTerms).toEqual(DEFAULT_METRIC_POLICY.needNameTerms);
    expect(geladen.instability).toBeNull();
  });

  it('dry schreibt nichts, meldet aber das fehlende Feld', () => {
    const { root, text } = alteConfig();
    expect(policyNachziehen(root, { dry: true })).toEqual(['needNameTerms']);
    expect(readFileSync(join(root, CONFIG_FILENAME), 'utf8')).toBe(text);
  });

  it('ein gesetztes Feld wird nie ueberschrieben, auch nicht null', () => {
    const { root } = alteConfig();
    const pfad = join(root, CONFIG_FILENAME);
    writeFileSync(pfad, readFileSync(pfad, 'utf8').replace('"metricPolicy": {', '"metricPolicy": {\n    "needNameTerms": null,'));
    const vorher = readFileSync(pfad, 'utf8');
    expect(policyNachziehen(root)).toEqual([]);
    expect(readFileSync(pfad, 'utf8')).toBe(vorher);
  });

  it('ohne Config gibt es nichts nachzuziehen', () => {
    const root = mkdtempSync(join(tmpdir(), 'graphcode-nachziehen-'));
    roots.push(root);
    expect(policyNachziehen(root)).toEqual([]);
  });

  it('upgrade --refresh-only (scaffold update) zieht die Config nach und meldet es', async () => {
    const { root } = alteConfig();
    const res = await scaffold('update', { repoRoot: root });
    expect(res.updated).toContain(`${CONFIG_FILENAME}#metricPolicy.needNameTerms`);
    expect(() => loadGraphcodeConfig(root)).not.toThrow();
  });
});
