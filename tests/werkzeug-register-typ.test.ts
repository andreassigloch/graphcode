/**
 * TEST-werkzeug-register-typ — jede Werkzeug-Fabrik behält den Typ ihrer Werkzeuge (CR-GC-867).
 *
 * Die Fabriken gaben `MCPToolRegistry = Record<string, MCPTool<any, any>>` zurück und löschten
 * damit den Typ jedes Werkzeugs: `handler()` lieferte `any`, und was ein Aufrufer aus dem
 * Ergebnis las, prüfte kein Compiler. Seit CR-GC-867 trägt `MCPTool` sein Eingabe-Schema, und
 * die Fabrik gibt ihre Werkzeuge mit Namen und Typ zurück. Diese Aussagen prüft `tsc`
 * (`tsconfig.tests.json`); zur Laufzeit belegt der Test nur, dass die Datei lädt.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import type { z } from 'zod/v4';
import type { bindMetricsTools, GraphMetricsAnswer } from '../src/projections/metrics.js';
import type { bindReadTools } from '../src/surface/read.js';

type Metrics = ReturnType<typeof bindMetricsTools>['graph_metrics'];
type Elements = ReturnType<typeof bindReadTools>['graph_elements'];

describe('TEST-werkzeug-register-typ', () => {
  it('ein Werkzeug der Fabrik hat sein Ergebnis, nicht any', () => {
    type Ergebnis = Awaited<ReturnType<Metrics['handler']>>;
    expectTypeOf<Ergebnis>().not.toBeAny();
    expectTypeOf<Ergebnis>().toEqualTypeOf<GraphMetricsAnswer>();
    expect(true).toBe(true);
  });

  it('das Schema bleibt am Werkzeug: Eingabe vor dem Parsen hat Felder mit Default optional', () => {
    type VorDemParsen = z.input<Elements['inputSchema']>;
    expectTypeOf<VorDemParsen>().not.toBeAny();
    expectTypeOf<{}>().toExtend<VorDemParsen>();
    expectTypeOf<{ limit: string }>().not.toExtend<VorDemParsen>();
    // Der Handler sieht die Eingabe NACH dem Parsen: die Default-Grenze ist gesetzt.
    expectTypeOf<Parameters<Elements['handler']>[0]['limit']>().toEqualTypeOf<number>();
    expect(true).toBe(true);
  });

  it('ein Werkzeug, das die Fabrik nicht baut, ist kein Schlüssel ihres Ergebnisses', () => {
    expectTypeOf<'graph_gibtsnicht'>().not.toExtend<keyof ReturnType<typeof bindReadTools>>();
    expectTypeOf<'graph_elements'>().toExtend<keyof ReturnType<typeof bindReadTools>>();
    expect(true).toBe(true);
  });
});
