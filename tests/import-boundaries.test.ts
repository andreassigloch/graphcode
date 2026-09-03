/**
 * CR-GC-467 — Abhängigkeitsrichtung: erzwungen, nicht dokumentiert.
 *
 * Der Lock (CLAUDE.md, „Locked constraints"): die Schichten bilden einen DAG
 *
 *     kernel ← loop ← projections ← surface ← index/cli
 *
 * Ein Import darf nur nach UNTEN oder in die eigene Schicht zeigen. Der Kern
 * (Speicher · Messung · Gate) kennt keine Klienten; Messung liegt UNTER dem
 * Gate, weil das Gate mit ihr urteilt (Entscheidung 2026-09-03, Herleitung
 * CR-DRAFT-GC-466). Type-only-Importe zählen mit: ein `import type` aus
 * `surface` ist dieselbe Richtung, nur ohne Laufzeitkosten — die Schicht
 * kennt dann trotzdem das Werkzeug-Interface ihrer Oberfläche.
 *
 * RATCHET, nicht Verbot: am Tag des Locks zeigten 40 Importe nach oben (14
 * gerichtete Kopplungen, 14 davon in Zyklen). Sie stehen unten als DEBT.
 * Zwei Zusicherungen, gegenläufig:
 *   1. kein NEUER Import nach oben (frisch ⊄ DEBT ⇒ rot),
 *   2. jeder DEBT-Eintrag existiert noch (getilgt ⇒ aus der Liste streichen,
 *      sonst rot) — die Liste kann nur schrumpfen, nie veralten.
 *
 * Rot gesehen: mit leerer DEBT-Liste meldet Test 1 exakt die 40 Einträge.
 *
 * Statische ESM-Importe/Re-Exports mit relativem Pfad; `node:`-, Paket- und
 * dynamische Importe sind hier nicht Gegenstand (Paketgrenzen prüft der
 * Compiler, dynamische Importe gibt es in src/ nicht).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

/** Schichten von unten nach oben. `(root)` = src/index.ts, src/cli.ts. */
const RANK: Record<string, number> = { kernel: 0, loop: 1, projections: 2, surface: 3, '(root)': 4 };

/** Bekannte Altlast (Stand 2026-09-03). Nur streichen, nie ergänzen. */
const DEBT: string[] = [
  'loop/executor-prompt.ts → surface/mcp-tools [type]',
  'loop/executor.ts → surface/mcp-tools [type]',
  'loop/suggest.ts → surface/mcp-tools [type]',
  'loop/suggest.ts → surface/tool-context [type]',
  'projections/auto-export.ts → surface/mcp-tools [type]',
  'projections/export.ts → surface/mcp-tools [type]',
  'projections/export.ts → surface/tool-context [type]',
  'projections/metrics.ts → surface/mcp-tools [type]',
  'projections/metrics.ts → surface/tool-context [type]',
  'projections/report.ts → surface/mcp-tools [type]',
  'projections/report.ts → surface/tool-context [type]',
  'projections/testreport.ts → surface/mcp-tools [type]',
  'projections/testreport.ts → surface/tool-context [type]',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.ts$/.test(p) && !/\.d\.ts$/.test(p)) out.push(p);
  }
  return out;
}

function layerOf(file: string): string {
  const rel = relative(SRC, file);
  return rel.includes('/') ? rel.split('/')[0] : '(root)';
}

const IMPORT = /^\s*(?:import|export)\s+(type\s+)?[^'"]*from\s*['"](\.[^'"]+)['"]/gm;

/** Alle nach oben zeigenden Importe als `von → nach [type]`, sortiert. */
function upwardImports(): string[] {
  const out: string[] = [];
  for (const file of walk(SRC)) {
    const from = layerOf(file);
    for (const m of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const target = resolve(dirname(file), m[2]);
      const to = layerOf(target.startsWith(SRC) ? target : SRC);
      if (RANK[to] > RANK[from]) {
        out.push(`${relative(SRC, file)} → ${relative(SRC, target).replace(/\.js$/, '')}${m[1] ? ' [type]' : ''}`);
      }
    }
  }
  return out.sort();
}

describe('Abhängigkeitsrichtung kernel ← loop ← projections ← surface ← root (CR-GC-467)', () => {
  it('jede Quelldatei liegt in einer bekannten Schicht', () => {
    const unknown = walk(SRC).map(layerOf).filter((l) => !(l in RANK));
    expect([...new Set(unknown)]).toEqual([]);
  });

  it('kein NEUER Import zeigt nach oben — die Altlast ist die Obergrenze', () => {
    const fresh = upwardImports().filter((v) => !DEBT.includes(v));
    expect(fresh).toEqual([]);
  });

  it('die Altlast schrumpft nur — ein getilgter Eintrag verlässt die Liste', () => {
    const present = new Set(upwardImports());
    const stale = DEBT.filter((d) => !present.has(d));
    expect(stale).toEqual([]);
  });
});
