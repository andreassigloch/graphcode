// Von Hand ergänzt: Wertregeln und Grenzfälle, die der Generator nicht ableitet (er prüft Pflichtfeld, Typ, Enum und Zusatzfeld auf jeder Ebene, CR-GC-980) — SCHEMA-mutate-answer → src/surface/mutate-answer.ts#GraphMutateAnswerSchema.
// TEST-vertrag-mutate-answer
import { describe, it, expect } from 'vitest';
import { GraphMutateAnswerSchema as S } from '../../src/surface/mutate-answer.js';

const gefaltet = { ruleId: 'R-04', severity: 'warning', message: '{el} zeigt zu viele Verträge', fixHint: 'Verträge zusammenlegen', elements: ['MOD-a'] };
const jeElement = { ruleId: 'R-04', severity: 'warning', message: 'MOD-a zeigt zu viele Verträge', elementId: 'MOD-a' };
const antwort = { success: true, appliedCommands: 3, mutations: 3, violations: [gefaltet], tier: 'suggest', graphVersion: 7 };
const stand = { before: 1, after: 2, delta: -1 };

describe('Vertrag SCHEMA-mutate-answer: Wertregeln', () => {
  it('nimmt die gefaltete und die je Element geführte Liste an, beide auch leer', () => {
    expect(S.safeParse(antwort).success).toBe(true);
    expect(S.safeParse({ ...antwort, violations: [jeElement] }).success).toBe(true);
    expect(S.safeParse({ ...antwort, violations: [] }).success).toBe(true);
  });
  it('nimmt einen gefalteten Befund ohne Element und ohne fixHint an', () => {
    expect(S.safeParse({ ...antwort, violations: [{ ruleId: 'X', severity: 'info', message: 'm', elements: [] }] }).success).toBe(true);
  });
  it('lehnt einen Befund ohne Meldung und eine unbekannte Schwere ab', () => {
    expect(S.safeParse({ ...antwort, violations: [{ ruleId: 'X', severity: 'info', elements: [] }] }).success).toBe(false);
    expect(S.safeParse({ ...antwort, violations: [{ ...gefaltet, severity: 'fatal' }] }).success).toBe(false);
  });
  it('lehnt einen gefalteten Befund mit einem Element, das keine Zeichenkette ist, ab', () => {
    expect(S.safeParse({ ...antwort, violations: [{ ...gefaltet, elements: [1] }] }).success).toBe(false);
  });
  it('lehnt eine Liste ab, die gefaltete und je Element geführte Einträge mischt, wenn ein Eintrag kein gültiger Befund ist', () => {
    expect(S.safeParse({ ...antwort, violations: [gefaltet, { ruleId: 'X' }] }).success).toBe(false);
  });
  it('lehnt negative, gebrochene und nicht endliche Zähler ab', () => {
    expect(S.safeParse({ ...antwort, appliedCommands: -1 }).success).toBe(false);
    expect(S.safeParse({ ...antwort, appliedCommands: 1.5 }).success).toBe(false);
    expect(S.safeParse({ ...antwort, mutations: -1 }).success).toBe(false);
    expect(S.safeParse({ ...antwort, mutations: Number.NaN }).success).toBe(false);
  });
  it('lehnt eine negative oder gebrochene graphVersion ab', () => {
    expect(S.safeParse({ ...antwort, graphVersion: -1 }).success).toBe(false);
    expect(S.safeParse({ ...antwort, graphVersion: 1.5 }).success).toBe(false);
  });
  it('lehnt confidence außerhalb von 0 bis 1 und ein unbekanntes tier ab; confidence 0 und 1 gelten', () => {
    expect(S.safeParse({ ...antwort, confidence: 1.1 }).success).toBe(false);
    expect(S.safeParse({ ...antwort, confidence: -0.1 }).success).toBe(false);
    expect(S.safeParse({ ...antwort, confidence: 0 }).success).toBe(true);
    expect(S.safeParse({ ...antwort, confidence: 1 }).success).toBe(true);
    expect(S.safeParse({ ...antwort, tier: 'maybe' }).success).toBe(false);
  });
  it('nimmt eine Antwort ohne tier und ohne Berichte an', () => {
    const { tier: _t, ...ohne } = antwort;
    expect(S.safeParse(ohne).success).toBe(true);
  });
  it('lehnt einen Bindungsreport mit negativer oder gebrochener Zahl ab; leere Listen gelten', () => {
    expect(S.safeParse({ ...antwort, refs: { resolved: [], introduced: [], openRefs: 0 } }).success).toBe(true);
    expect(S.safeParse({ ...antwort, refs: { resolved: ['SCHEMA-a'], introduced: [], openRefs: -1 } }).success).toBe(false);
    expect(S.safeParse({ ...antwort, refs: { resolved: [], introduced: [], openRefs: 1.5 } }).success).toBe(false);
    expect(S.safeParse({ ...antwort, refs: { resolved: [1], introduced: [], openRefs: 0 } }).success).toBe(false);
  });
  it('lehnt ein Steuerungsdelta mit fehlendem Feld in einer Stufe ab; keine Stufen gelten', () => {
    const delta = { blockingErrors: { before: 0, after: 0 }, stages: { Modul: stand } };
    expect(S.safeParse({ ...antwort, steeringDelta: delta }).success).toBe(true);
    expect(S.safeParse({ ...antwort, steeringDelta: { ...delta, stages: {} } }).success).toBe(true);
    expect(S.safeParse({ ...antwort, steeringDelta: { ...delta, stages: { Modul: { before: 1, after: 2 } } } }).success).toBe(false);
    expect(S.safeParse({ ...antwort, steeringDelta: { stages: {} } }).success).toBe(false);
  });
  it('lehnt eine OCC-Ablehnung ab, deren staleDelta einen Eintrag ohne Zeitstempel trägt; leere entries gelten', () => {
    const abgelehnt = { success: false, appliedCommands: 0, mutations: 0, violations: [jeElement], confidence: 0, tier: 'block', stale: true, graphVersion: 9 };
    const delta = { sinceVersion: 3, currentVersion: 9, entries: [], changedUids: [] };
    expect(S.safeParse({ ...abgelehnt, staleDelta: delta }).success).toBe(true);
    expect(S.safeParse({ ...abgelehnt, staleDelta: { ...delta, entries: [{ graphVersion: 4, changedUids: ['A'] }] } }).success).toBe(false);
    expect(S.safeParse({ ...abgelehnt, staleDelta: { ...delta, sinceVersion: -1 } }).success).toBe(false);
  });
  it('lehnt einen Bericht ab, der nicht dem Vertrag der Berichte folgt; fitAdvisory fehlt auf der Leitung und darf fehlen', () => {
    expect(S.safeParse({ ...antwort, steerAdvisory: { rules: 'R-04' } }).success).toBe(false);
    expect(S.safeParse({ ...antwort, workOrder: 'viel' }).success).toBe(false);
    expect(S.safeParse({ ...antwort, metricsAfter: { chains: [] } }).success).toBe(false);
    expect(S.safeParse({ ...antwort, berichtFehlt: 1 }).success).toBe(false);
    expect(S.safeParse({ ...antwort, berichtFehlt: 'Bericht zum Zug nicht berechenbar: x' }).success).toBe(true);
  });
});
