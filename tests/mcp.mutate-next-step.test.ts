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
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness, type GraphCodeHarness } from '../src/index.js';
import { RULE_HELP } from '@sigloch/contracts/se';
import { VORSCHLAG_SEED, vorschlagAusSchritt } from '../src/loop/next-step.js';
import { SEED_STAGES, type GenerationStep } from '../src/loop/generate.js';
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
    const step = { phase: 'expand', focusKey: 'uc:UC-02:UC-a', focusDimension: 'uc', focusElements: ['UC-a'] } as GenerationStep;
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
    const step = { phase: 'expand', focusKey: 'req:AF-01:SYS-s', focusDimension: 'req', focusElements: ['SYS-s'] } as GenerationStep;
    expect(vorschlagAusSchritt(step, { nodes: [], edges: [] }, 'kern')).toBe('Führe das Einsatzkonzept (ConOps) durch.');
  });

  it('CR-GC-733: die Saetze je Regel kommen aus den contracts (Regelmatrix ist SSOT); hier nur Kaltstart-Stufen', () => {
    // Menge und Form der Regel-Saetze prueft der Smeagol-Check in contracts (CR-SM-384); graphcode faellt beim
    // Laden, wenn einer fehlt (OHNE_VORSCHLAG in next-step.ts).
    expect(Object.keys(VORSCHLAG_SEED).sort()).toEqual(Object.keys(SEED_STAGES).map((s) => `seed:${s}`).sort());
    for (const satz of Object.values(VORSCHLAG_SEED)) for (const muster of KEIN_AUFTRAG) expect(satz, String(muster)).not.toMatch(muster);
  });

  it('der Host-Prompt weist den Vorschlag dem Nutzer zu, der Treiber-Prompt kennt ihn nicht', async () => {
    await mutiere([SYS]);
    const host = await tools.graph_generate.handler({});
    expect(host.prompt).toContain('der `vorschlag` an der Mutationsantwort ist für den Nutzer');
    const driver = await tools.graph_generate.handler({ selection: 'driver' });
    expect(driver.prompt, 'CR-GC-648: der Treiber ruft graph_generate, nicht das Modell').not.toContain('graph_generate');
    expect(driver.prompt).not.toContain('vorschlag');
  });
});
