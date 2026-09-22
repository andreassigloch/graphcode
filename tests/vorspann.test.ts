/**
 * CR-GC-612 — der feste Vorspann je Lauf: jede Frage hat genau EINEN Ort.
 *
 * Gemessen am 2026-09-22 (Lauf gefuehrt-1 des Code-Tests, Spec-Laeufe 14/15): `GRAPHCODE.md`
 * 15.150 Zeichen, die 24 Werkzeugbeschreibungen zusammen 25.232 — und die Ueberlappung war nicht
 * Text, sondern ZUSTAENDIGKEIT: alle 15 Werkzeug-/Regelmarker der Datei standen auch in den
 * Werkzeugbeschreibungen, 21 von 165 Zeilen erklaerten Werkzeuge, die sich selbst erklaeren. Die
 * zwei laengsten Beschreibungen trugen Regelsemantik statt Auswahlhilfe.
 *
 * Kein Copy-Paste: gemeinsame Saetze ab 50 Zeichen waren 0. Doppelte Zustaendigkeit ist schlimmer
 * als Copy-Paste, weil beide Orte getrennt driften.
 *
 * Dieser Test haelt die Aufteilung fest, damit sie nicht zurueckwaechst:
 *   GRAPHCODE.md — Hausregeln. Keine Werkzeugnamen, keine Regel-IDs.
 *   Werkzeugbeschreibung — WANN nehme ich es. Hoechstens 800 Zeichen.
 *   graph_help — was es bedeutet, auf Abruf.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ALL_RULE_DEFS } from '@sigloch/contracts/se';
import { guardrailsContent } from '../src/surface/scaffold-docs.js';
import { createHarness } from '../src/surface/create-harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { helpEntry } from '../src/projections/help.js';

async function werkzeuge(): Promise<{ name: string; description: string }[]> {
  const dir = mkdtempSync(join(tmpdir(), 'gc-612-'));
  const h = await createHarness({ repoRoot: dir, scope: { workspaceId: 'v', systemId: 'v' } });
  await h.initialize();
  const liste = Object.values(bindToolsToHarness(h)).map((t) => ({ name: t.name, description: t.description }));
  await h.close();
  rmSync(dir, { recursive: true, force: true });
  return liste;
}

describe('CR-GC-612: GRAPHCODE.md traegt Hausregeln, nicht den Werkzeugkatalog', () => {
  it('bleibt unter 6.000 Zeichen — vorher 15.150', () => {
    const g = guardrailsContent();
    expect(g.length, `GRAPHCODE.md: ${g.length} Zeichen`).toBeLessThan(6_000);
    // Gegenprobe: der Text ist nicht leer geraeumt, die Hausregeln stehen noch drin.
    expect(g).toContain('Ask the graph');
    expect(g).toContain('Writing to the model');
    expect(g).toContain('Format-E v2');
  });

  it('nennt KEIN Werkzeug beim Namen — die Marker-Ueberlappung ist 0, vorher 15', async () => {
    const g = guardrailsContent();
    const genannt = (await werkzeuge()).map((t) => t.name).filter((n) => g.includes(n));
    expect(genannt, 'Werkzeugnamen in GRAPHCODE.md — sie erklaeren sich selbst').toEqual([]);
  }, 60_000);

  it('traegt KEINE Regelsemantik — keine einzige Regel-ID', () => {
    const g = guardrailsContent();
    const genannt = ALL_RULE_DEFS.map((r) => r.id).filter((id) => new RegExp(`\\b${id}\\b`).test(g));
    expect(genannt, 'Regel-IDs in GRAPHCODE.md — die Semantik gehoert in graph_help').toEqual([]);
  });
});

describe('CR-GC-612: eine Werkzeugbeschreibung sagt WANN, nicht WAS ES BEDEUTET', () => {
  it('keine Beschreibung ueber 800 Zeichen — vorher 12 von 24, Spitze 3.556', async () => {
    const zuLang = (await werkzeuge())
      .filter((t) => t.description.length > 800)
      .map((t) => `${t.name}: ${t.description.length}`);
    expect(zuLang, 'was darueber hinausgeht, gehoert in graph_help').toEqual([]);
  }, 60_000);

  it('die vier Umgezogenen sind ueber graph_help erreichbar — verschoben, nicht geloescht', () => {
    // Ohne diese Gegenprobe waere "kuerzer" einfach "weniger". Die Hilfe muss die Genauigkeit
    // tragen, die aus der Beschreibung verschwunden ist.
    for (const id of ['graph_readiness', 'graph_metrics', 'rules_evaluate', 'graph_suggest']) {
      const e = helpEntry(id);
      expect(e, `${id} hat keinen Hilfe-Eintrag`).toBeDefined();
      expect(e!.kind).toBe('tool');
      expect(e!.se.length, `${id}: der Hilfe-Eintrag ist zu duenn fuer das, was er ersetzt`).toBeGreaterThan(400);
    }
  });

  it('die Summe ist messbar gefallen — die Grundlast des Executors', async () => {
    const summe = (await werkzeuge()).reduce((a, t) => a + t.description.length, 0);
    expect(summe, `Beschreibungen zusammen: ${summe} Zeichen (vorher 25.232)`).toBeLessThan(13_000);
  }, 60_000);
});
