/**
 * CR-GC-569 — SCHEMA-executor-config bekommt einen prueflichen Vertrag.
 *
 * `ExecutorConfigSchema` ist die faktische SSOT dafuer, was ein Lauf IST: Backend,
 * Modell, Toolset, Kandidatenzahl, Richter, Injektion, Runden- und Turn-Budget. Bis
 * hierher hatte sie keinen Knoten und keinen Vertragstest — gemessen wurde zwoelf Laeufe
 * lang an einer Konfiguration, deren Grenzen niemand festgehalten hatte.
 *
 * Geprueft wird die GRENZE des Vertrags, nicht die Innenseite des Executors: welche
 * Eingabe angenommen wird, welche abgewiesen, und was ohne Angabe gilt. Kein Mock,
 * kein Netz — ein Zod-Schema ist an seiner Parse-Kante vollstaendig pruefbar.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { ExecutorConfigSchema } from '../src/loop/executor.js';

/** Das Minimum, das der Vertrag verlangt — alles andere hat einen Default. */
const MINIMAL = { baseUrl: 'http://127.0.0.1:1234', model: 'test-model' };

describe('SCHEMA-executor-config: was ein Lauf ist, steht an EINER Stelle (CR-GC-569)', () => {
  it('die Pflichtfelder sind baseUrl und model — fehlt eines, wird abgewiesen', () => {
    expect(ExecutorConfigSchema.safeParse({}).success).toBe(false);
    expect(ExecutorConfigSchema.safeParse({ baseUrl: 'http://x' }).success).toBe(false);
    expect(ExecutorConfigSchema.safeParse({ model: 'm' }).success).toBe(false);
    // Leerstring ist kein Wert: min(1) auf beiden Feldern.
    expect(ExecutorConfigSchema.safeParse({ baseUrl: '', model: 'm' }).success).toBe(false);
    expect(ExecutorConfigSchema.safeParse({ baseUrl: 'http://x', model: '' }).success).toBe(false);
    expect(ExecutorConfigSchema.safeParse(MINIMAL).success).toBe(true);
  });

  it('die Defaults sind der dokumentierte Lauf: openai, authoring, ein Kandidat, Gate-Richter', () => {
    const cfg = ExecutorConfigSchema.parse(MINIMAL);
    expect(cfg.backend).toBe('openai');
    expect(cfg.toolset).toBe('authoring');
    // candidates=1 ist das Regressions-Kriterium aus CR-GC-288: der Pfad, der nicht probt.
    expect(cfg.candidates).toBe(1);
    expect(cfg.judge).toBe('gate');
    expect(cfg.injection).toBe(true);
    expect(cfg.maxRounds).toBe(40);
    expect(cfg.maxStepTurns).toBe(6);
    // Ohne Angabe wird kein Denk-Budget gesendet — Backends ohne das Feld duerfen den
    // Request nicht wegen eines unbekannten Feldes abweisen.
    expect(cfg.reasoningEffort).toBeUndefined();
    // CR-GC-667: headless ist der Default — nur eine manuelle Session haelt bei einer Frage an.
    expect(cfg.interactive).toBe(false);
  });

  it('die drei Backends sind geschlossen — ein viertes wird abgewiesen', () => {
    for (const backend of ['openai', 'anthropic', 'sigllm']) {
      expect(ExecutorConfigSchema.safeParse({ ...MINIMAL, backend }).success).toBe(true);
    }
    expect(ExecutorConfigSchema.safeParse({ ...MINIMAL, backend: 'ollama' }).success).toBe(false);
  });

  it('die Kandidatenzahl ist auf 1..8 begrenzt, das Budget auf positive ganze Zahlen', () => {
    expect(ExecutorConfigSchema.safeParse({ ...MINIMAL, candidates: 0 }).success).toBe(false);
    expect(ExecutorConfigSchema.safeParse({ ...MINIMAL, candidates: 9 }).success).toBe(false);
    expect(ExecutorConfigSchema.safeParse({ ...MINIMAL, candidates: 1.5 }).success).toBe(false);
    expect(ExecutorConfigSchema.parse({ ...MINIMAL, candidates: 8 }).candidates).toBe(8);
    expect(ExecutorConfigSchema.safeParse({ ...MINIMAL, maxRounds: 0 }).success).toBe(false);
    expect(ExecutorConfigSchema.safeParse({ ...MINIMAL, maxStepTurns: -1 }).success).toBe(false);
    // Temperatur ist ein Sampling-Parameter, kein Freibrief.
    expect(ExecutorConfigSchema.safeParse({ ...MINIMAL, temperature: 2.5 }).success).toBe(false);
  });

  it('der TREIBER ist kein Feld — die Selektionsvariante folgt aus candidates (CR-GC-568)', () => {
    // Die Zusage von CR-GC-569: wer die Schleife treibt, ist eine Grenzfrage und steht
    // an den Akteuren (ACTOR-agent gegen ACTOR-llm), nicht in der Lauf-Konfiguration.
    // Waere `selection` oder `driver` hier ein Feld, gaebe es die Achse zweimal.
    const felder = Object.keys(ExecutorConfigSchema.shape);
    expect(felder).not.toContain('selection');
    expect(felder).not.toContain('driver');
    expect(felder).not.toContain('agent');
  });
});
