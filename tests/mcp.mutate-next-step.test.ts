/**
 * CR-GC-729 — der Vorschlag an den Nutzer faehrt mit der angewandten Mutation mit.
 *
 * Vorher (CR-GC-588) stand dort als `next` der Imperativ der naechsten Runde, mit Fix-Vorlagen und
 * Abnahme-Angebot; der Client las ihn als Auftrag (Probe todo E/F). Jetzt: ein Satz an den Nutzer,
 * den ein Client-Plugin ins Eingabefeld legt — gewaehlt wie der Schritt von `graph_generate`, aber
 * ohne Fix-Anleitung, Werkzeugaufrufe und Abnahme. Nur nach Anwendung. Echte Kuzu, echtes Gate.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness, type GraphCodeHarness } from '../src/index.js';
import { DEFAULT_METRIC_POLICY, RULE_HELP } from '@sigloch/contracts/se';
import { VORSCHLAG_SEED, vorschlagAusSchritt, vorschlagNachAnwendung, vorschlagOffeneAnalyse } from '../src/loop/next-step.js';
import { SEED_STAGES, generationStep, type GenerationStep } from '../src/loop/generate.js';
import { focusMemoryOf } from '../src/loop/stagnation.js';
import { alsFormatE } from './helpers/format-e.js';

type Antwort = Record<string, unknown>;
let repoRoot: string;
let harness: GraphCodeHarness;
let tools: ReturnType<typeof bindToolsToHarness>;

const knoten = (uid: string, type: string, name: string, description: string) =>
  ({ op: 'add-node', node: { uid, type, name, description, attributes: {} } });
const kante = (sourceId: string, edgeType: string, targetId: string) =>
  ({ op: 'add-edge', edge: { sourceId, targetId, edgeType, attributes: {} } });
const SYS = knoten('SYS-s', 'SYS', 'S', 'Ein System, das Bestellungen fuer Kunden annimmt und liefert.');
const mutiere = async (cmds: object[], dryRun = false): Promise<Antwort> =>
  (await tools.graph_mutate.handler({ formatE: alsFormatE(cmds, harness), consumerId: 'test', ...(dryRun ? { dryRun } : {}) })) as Antwort;

/** Was ein Vorschlag an den Nutzer nie enthaelt: Werkzeugaufrufe, Fix-Vorlagen, Abnahme, Regel-IDs. */
const KEIN_AUFTRAG = [/graph_\w+/, /Fix:/, /acceptedFindings/, /\b[A-Z]{1,3}-\d{2}\b/, /Gate/];

beforeEach(async () => {
  repoRoot = mkdtempSync(join(tmpdir(), 'gc-next-'));
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  harness = await createHarness({ repoRoot, scope: { workspaceId: 'w', systemId: 's' } });
  await harness.initialize();
  tools = bindToolsToHarness(harness);
});
afterEach(async () => {
  await harness.close();
  rmSync(repoRoot, { recursive: true, force: true });
});

describe('CR-GC-729: Vorschlag an den Nutzer an der angewandten Mutation', () => {
  it('Kaltstart: nach dem System schlaegt er die Ablaeufe vor — als Satz, nicht als Imperativ der Runde', async () => {
    const antwort = await mutiere([SYS]);
    expect(antwort.success).toBe(true);
    expect(antwort).not.toHaveProperty('next');
    expect(antwort.vorschlag).toBe(VORSCHLAG_SEED['seed:uc']);
  });

  it('Ausbau: er nennt die Fund-Elemente mit Namen und traegt keinen Auftrag', async () => {
    await mutiere([SYS]);
    await mutiere([knoten('UC-a', 'UC', 'Bestellung annehmen', 'Der Kunde gibt eine Bestellung auf.'), kante('SYS-s', 'compose', 'UC-a')]);
    const antwort = await mutiere([knoten('ACTOR-k', 'ACTOR', 'Kunde', 'Eine Person, die bestellt.')]);
    expect(antwort.success).toBe(true);
    const vorschlag = String(antwort.vorschlag);
    expect(vorschlag).toContain('Bestellung annehmen');
    // CR-GC-730: der Satz gehoert zur Regel des Fund-Fensters — ein Schritt, nicht „alles Offene".
    const regel = String((await tools.graph_generate.handler({})).focusKey).split(':')[1];
    expect(vorschlag).toBe(RULE_HELP[regel].vorschlag!.replace('{n}', 'Bestellung annehmen'));
    for (const muster of KEIN_AUFTRAG) expect(vorschlag, String(muster)).not.toMatch(muster);
    // Derselbe Zustand liefert dem Agenten ueber graph_generate weiter den vollen Imperativ.
    const gen = await tools.graph_generate.handler({});
    expect(gen.prompt).toMatch(/Fix:|graph_/);
  });

  it('CR-GC-731: UC-02 nennt die fehlenden Funktionen, auch wenn der Nutzer schon an Datenfluesse angebunden ist', async () => {
    await mutiere([SYS]);
    await mutiere([knoten('UC-a', 'UC', 'Bestellung annehmen', 'Der Kunde gibt eine Bestellung auf.'), kante('SYS-s', 'compose', 'UC-a')]);
    await mutiere([knoten('ACTOR-k', 'ACTOR', 'Kunde', 'Eine Person, die bestellt.')]);
    const step = { phase: 'expand', focusKey: 'Anwendungsfall:UC-02:UC-a', focusStage: 'Anwendungsfall', focusElements: ['UC-a'] } as GenerationStep;
    const satz = vorschlagAusSchritt(step, harness.getGraph(), 'kern');
    expect(satz).toContain('Funktionen');
    expect(satz).toContain('Bestellung annehmen');
  });

  it('nicht auf der Probe und nicht auf der Ablehnung — dort ist das Urteil der Kanal', async () => {
    expect(await mutiere([SYS], true)).not.toHaveProperty('vorschlag');
    await mutiere([SYS]);
    // Eine illegale Kante (R-18) wird abgelehnt.
    const abgelehnt = await mutiere([knoten('MOD-m', 'MOD', 'M', 'Ein Modul.'), kante('SYS-s', 'verify', 'MOD-m')]);
    expect(abgelehnt.success).toBe(false);
    expect(abgelehnt).not.toHaveProperty('vorschlag');
  });

  it('Eintrittspunkt einer Analyse: der Nutzer bekommt die Analyse als Bitte, ohne Abnahme-Angebot', () => {
    const step = { phase: 'expand', focusKey: 'Anforderung:AF-01:SYS-s', focusStage: 'Anforderung', focusElements: ['SYS-s'] } as GenerationStep;
    expect(vorschlagAusSchritt(step, { nodes: [], edges: [] }, 'kern')).toBe('Führe das Einsatzkonzept (ConOps) durch.');
  });

  it('CR-GC-734: ein offener Eintrittspunkt — Auftrag, dann Frage nach dem Stand, dann der naechste Schritt', () => {
    // Handlauf todo-local v9: Kern fertig, AF-01..05 offen, kein Stempel. Vorher hiess es nach jedem Zug „ConOps".
    type Flat = { elements: { id: string; type: string; name?: string; description?: string; attributes?: Record<string, unknown>; [k: string]: unknown }[]; traces: { source: string; target: string; type: string; label?: string }[] };
    const flat: Flat = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/todo-local-v9.graph.json', import.meta.url)), 'utf8'));
    // CR-GC-749: der flache Export traegt Attribute (kinds, status …) auf der obersten Ebene. Ohne sie zu heben,
    // fehlen jeder REQ die kinds, und R-18 meldet an jeder satisfy-Kante — „Kern fertig" stimmte dann nicht. Bis
    // der Schritt nach Stufe waehlte, fiel das nicht auf: die Fehler standen in einer spaeteren Dimension.
    const KNOWN = new Set(['id', 'type', 'name', 'description', 'attributes']);
    const graph = {
      nodes: flat.elements.map((e) => ({
        uid: e.id, type: e.type, name: e.name ?? e.id, description: e.description ?? '',
        attributes: { ...(e.attributes ?? {}), ...Object.fromEntries(Object.entries(e).filter(([k]) => !KNOWN.has(k))) },
      })),
      edges: flat.traces.map((t) => ({ sourceId: t.source, targetId: t.target, edgeType: t.type, attributes: t.label ? { label: t.label } : {} })),
    } as never;
    const memory = focusMemoryOf({});
    const zug = (v: number) => vorschlagNachAnwendung(graph, DEFAULT_METRIC_POLICY, 0.8, repoRoot, memory, v);

    expect(zug(10)).toBe('Führe das Einsatzkonzept (ConOps) durch.');
    expect(zug(11)).toBe(vorschlagOffeneAnalyse('conops'));
    const weiter = zug(12);
    expect(weiter).not.toContain('Einsatzkonzept');
    for (const muster of KEIN_AUFTRAG) expect(weiter, String(muster)).not.toMatch(muster);
    // Der Autopilot bleibt am Eintrittspunkt (CR-GC-604): das Gedaechtnis hat nichts zurueckgestellt.
    const auto = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8, [...memory.deferred], null, 'kern');
    expect(auto.focusKey).toMatch(/:AF-01:/);
  });

  it('CR-GC-736: Satz 2 steht im Nominativ — „Der Variantenvergleich", nicht „Den"', () => {
    expect(vorschlagOffeneAnalyse('trade')).toBe('Der Variantenvergleich (Trade-off) ist noch nicht abgeschlossen — was fehlt dafür?');
    expect(vorschlagOffeneAnalyse('plan')).toBe('Der Bauplan ist noch nicht abgeschlossen — was fehlt dafür?');
    expect(vorschlagOffeneAnalyse('fmea')).toBe('Die Fehlerbetrachtung (FMEA) ist noch nicht abgeschlossen — was fehlt dafür?');
  });

  it('CR-GC-733: die Saetze je Regel kommen aus den contracts (Regelmatrix ist SSOT); hier nur Kaltstart-Stufen', () => {
    // Menge und Form der Regel-Saetze prueft der Smeagol-Check in contracts (CR-SM-384); graphcode faellt beim
    // Laden, wenn einer fehlt (OHNE_VORSCHLAG in next-step.ts).
    expect(Object.keys(VORSCHLAG_SEED).sort()).toEqual(Object.keys(SEED_STAGES).map((s) => `seed:${s}`).sort());
    for (const satz of Object.values(VORSCHLAG_SEED)) for (const muster of KEIN_AUFTRAG) expect(satz, String(muster)).not.toMatch(muster);
  });

  it('der Prompt des Schritts weist den Vorschlag dem Nutzer zu', async () => {
    await mutiere([SYS]);
    const host = await tools.graph_generate.handler({});
    expect(host.prompt).toContain('der `vorschlag` an der Mutationsantwort ist für den Nutzer');
  });
});
