/**
 * CR-GC-596 — die Abbruchregel: zweimal dasselbe Feedback nach einem Zug → weiter; nur noch
 * Zurueckgestelltes → `stalled`, nie `done`.
 *
 * Gemessen in Lauf 11: R-04 stand sechsmal hintereinander im Fokus, kein Zug bewegte den Term,
 * sieben Zuege verbrannt. Ein MCP-Host hatte kein Gedaechtnis; der Executor zaehlte fuer sich.
 * Echte Kuzu, echtes Gate, der Zug ohne Wirkung ist eine echte Mutation (Beschreibung am SYS).
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { alsFormatE } from './helpers/format-e.js';
import { createHarness, bindToolsToHarness, type GraphCodeHarness } from '../src/index.js';
import { focusMemoryOf } from '../src/loop/stagnation.js';
import { TARGET_PROFILE_REL } from '../src/loop/target-profile.js';

type Antwort = { success: boolean; vorschlag?: string };
let repoRoot: string;
let harness: GraphCodeHarness;
let tools: ReturnType<typeof bindToolsToHarness>;

const knoten = (uid: string, type: string, name: string, description: string) =>
  ({ op: 'add-node', node: { uid, type, name, description, attributes: {} } });
const kante = (sourceId: string, targetId: string, edgeType: string) =>
  ({ op: 'add-edge', edge: { sourceId, targetId, edgeType, attributes: {} } });
let n = 0;
/** Ein Zug, der die Version hebt und keinen Fund loest. */
const zugOhneWirkung = async (): Promise<Antwort> =>
  (await tools.graph_mutate.handler({
    formatE: alsFormatE([{ op: 'update-node', node: { uid: 'SYS-s', description: `Ein System fuer Bestellungen, Fassung ${++n}.` } }], harness),
    consumerId: 'test',
  })) as Antwort;
/** Ein Zug ohne Wirkung, dann der Schritt — seit CR-GC-729 liest der Agent ihn nur aus graph_generate.
 * Derselbe Graph-Stand zaehlt im Gedaechtnis nur einmal, ob Mutation oder graph_generate ihn zuerst sieht. */
const zugDannSchritt = async (task?: 'anforderungsqualitaet') => {
  await zugOhneWirkung();
  return tools.graph_generate.handler(task ? { task } : {});
};

beforeEach(async () => {
  repoRoot = mkdtempSync(join(tmpdir(), 'gc-stag-'));
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  harness = await createHarness({ repoRoot, scope: { workspaceId: 'w', systemId: 's' } });
  await harness.initialize();
  tools = bindToolsToHarness(harness);
  // SYS + UC + ACTOR: die Saat ist durch, die Maschine steht in expand mit echten Funden.
  const r = (await tools.graph_mutate.handler({
    formatE: alsFormatE([
      knoten('SYS-s', 'SYS', 'S', 'Ein System fuer Bestellungen.'),
      knoten('UC-a', 'UC', 'Bestellen', 'Kunde bestellt ein Teil und erhaelt eine Bestaetigung.'),
      knoten('ACTOR-k', 'ACTOR', 'Kunde', 'Wer bestellt.'),
      kante('SYS-s', 'UC-a', 'compose'),
    ], harness),
    consumerId: 'test',
  })) as Antwort;
  expect(r.success).toBe(true);
});
afterEach(async () => {
  await harness.close();
  rmSync(repoRoot, { recursive: true, force: true });
});

describe('CR-GC-596/606: dreimal dasselbe Feedback → weiter', () => {
  it('nach einem Zug ohne Wirkung bleibt der Fokus (Folgezug ist kein Versuch), nach dem zweiten kommt ein anderer', async () => {
    const erst = await tools.graph_generate.handler({});
    expect(erst.phase).toBe('expand');
    const eins = await zugDannSchritt();
    expect(eins.focusKey).toBe(erst.focusKey);
    const zwei = await zugDannSchritt();
    expect(zwei.focusKey).not.toBe(erst.focusKey);
  });

  it('graph_generate ohne Zug dazwischen zaehlt nicht und setzt den Zaehler nicht zurueck', async () => {
    const erst = await tools.graph_generate.handler({});
    await zugOhneWirkung();
    expect((await tools.graph_generate.handler({})).focusKey).toBe(erst.focusKey);
    const zwei = await zugDannSchritt();
    expect(zwei.focusKey).not.toBe(erst.focusKey);
  });

  it('zweimal graph_generate OHNE Zug: gleiche Antwort — kein Zug, kein Abbruch (Determinismus)', async () => {
    const a = await tools.graph_generate.handler({});
    const b = await tools.graph_generate.handler({});
    expect(b.focusKey).toBe(a.focusKey);
  });

  it('der Treiber (selection driver) fuehrt vorerst selbst Buch — die Maschine stellt fuer ihn nichts zurueck', async () => {
    const a = await tools.graph_generate.handler({ selection: 'driver' });
    await zugOhneWirkung();
    const b = await tools.graph_generate.handler({ selection: 'driver' });
    expect(b.focusKey).toBe(a.focusKey);
  });
});

/** Alle Eintrittspunkte abnehmen — sonst bleibt immer einer offen (CR-GC-604) und stalled ist unerreichbar. */
const eintritteAbnehmen = async () => {
  const acceptedFindings = ['AF-01', 'AF-02', 'AF-03', 'AF-04', 'AF-05'].map((ruleId) => ({ ruleId, reason: 'schlanker Umfang' }));
  const r = (await tools.graph_mutate.handler({
    formatE: alsFormatE([{ op: 'update-node', node: { uid: 'SYS-s', attributes: { acceptedFindings } } }], harness),
    consumerId: 'test',
  })) as Antwort;
  expect(r.success).toBe(true);
};

describe('CR-GC-604: Eintrittspunkte stellt die Abbruchregel nie zurueck', () => {
  it('bleibt ein Eintrittspunkt nach Zuegen ohne Wirkung stehen, nennt der Schritt weiter ihn — mit dem Skill des Tasks', async () => {
    let r: Awaited<ReturnType<typeof zugDannSchritt>> | undefined;
    for (let i = 0; i < 60; i++) {
      r = await zugDannSchritt();
      if (/:AF-0\d:/.test(r.focusKey ?? '')) break;
    }
    const eintritt = r!.focusKey!;
    expect(eintritt).toMatch(/:AF-0\d:/);
    const danach = await zugDannSchritt();
    expect(danach.focusKey).toBe(eintritt);
    expect(danach.skill).toMatch(/^se-(conops|trade|irr|fmea|plan)$/);
  });

  // CR-GC-748: bis contracts 10 fuehrte der Bauplan ein eigenes Regelset (MS-01 als Fund im Task). Die
  // Analysen tragen keines mehr; der eine Arbeitsschritt mit eigenen Regeln ist die Textqualitaet der
  // Anforderungen. An ihm steht die Aussage jetzt.
  it('festgefahren im Task heisst: zurueck in den Kern, nicht "uebergib an den Menschen"', async () => {
    const r = (await tools.graph_mutate.handler({
      formatE: alsFormatE([
        knoten('REQ-vage', 'REQ', 'Schnell', 'Das System soll moeglichst schnell und benutzerfreundlich sein.'),
        knoten('TEST-vage', 'TEST', 'Schnell pruefen', 'Prueft, ob es schnell ist.'),
        kante('UC-a', 'REQ-vage', 'compose'),
        kante('TEST-vage', 'REQ-vage', 'verify'),
      ], harness),
      consumerId: 'test',
    })) as Antwort;
    expect(r.success).toBe(true);
    const s = await tools.graph_generate.handler({ task: 'anforderungsqualitaet' });
    expect(s.phase).toBe('expand');
    expect(s.focusKey).toMatch(/:BQ-\d+:/);
    let letzte: Awaited<ReturnType<typeof zugDannSchritt>> | undefined;
    for (let i = 0; i < 30; i++) {
      letzte = await zugDannSchritt('anforderungsqualitaet');
      if (letzte.phase === 'stalled') break;
    }
    expect(letzte!.phase).toBe('stalled');
    expect(letzte!.prompt).toMatch(/Task anforderungsqualitaet festgefahren/);
    expect(letzte!.prompt).toMatch(/graph_generate ohne task/);
    expect(letzte!.prompt).not.toMatch(/Menschen/);
  });
});

describe('CR-GC-596: nur noch Zurueckgestelltes → stalled, nicht done', () => {
  beforeEach(eintritteAbnehmen);

  it('nach genug Zuegen ohne Wirkung endet die Maschine stalled — mit Liste, ohne Fokus, nie done', async () => {
    let letzte = await tools.graph_generate.handler({});
    for (let i = 0; i < 60 && letzte.phase !== 'stalled'; i++) letzte = await zugDannSchritt();
    expect(letzte!.phase).toBe('stalled');
    expect(letzte!.done).toBe(false);
    expect(letzte!.focusKey).toBeNull();
    expect(letzte!.prompt).toMatch(/Festgefahren/);
    expect(letzte!.prompt).toMatch(/Nicht weiter mutieren/);
  });

  it('stalled gilt auch fuer graph_generate — dasselbe Gedaechtnis wie der Vorschlag an den Nutzer', async () => {
    for (let i = 0; i < 60; i++) {
      const r = await zugOhneWirkung();
      if (r.vorschlag === 'Zeig mir die offenen Regelhinweise und was du je Hinweis vorschlägst.') break;
    }
    const s = await tools.graph_generate.handler({});
    expect(s.phase).toBe('stalled');
    expect(s.done).toBe(false);
  });
});

/**
 * CR-GC-758 — `graph_generate {peek:true}`: nachsehen heisst lesen. Der Schritt, den die Sitzung als
 * naechsten bekaeme (ihr Task, ihre zurueckgestellten Fund-Sets), ohne dass die Sitzung sich aendert:
 * kein Taskwechsel, kein Zaehlen, kein Zurueckstellen, kein Anker-Write. Fuer Anzeigen, die pollen.
 */
describe('CR-GC-758: peek sieht nach, ohne die Sitzung zu aendern', () => {
  /** Der Sitzungsstand, wie die Abbruchregel ihn fuehrt — als Wert, zum Vergleichen. */
  const stand = () => {
    const m = focusMemoryOf(harness);
    return { task: m.task, last: m.last ? { ...m.last } : null, deferred: [...m.deferred].sort(), steerVerlauf: m.steerVerlauf.length, steerOptimum: m.steerOptimum };
  };

  it('(a) der Peek steht im Task der Sitzung und laesst ihn stehen — ein Aufruf ohne peek und ohne task setzt ihn zurueck', async () => {
    const fmea = await tools.graph_generate.handler({ task: 'fmea' });
    expect(fmea.skill).toBe('se-fmea');
    expect(focusMemoryOf(harness).task).toBe('fmea');
    const vorher = stand();

    const peek = await tools.graph_generate.handler({ peek: true });
    // Derselbe Schritt, den die Sitzung bekommt — nicht ein Schritt im Kern.
    expect(peek.skill).toBe('se-fmea');
    expect(peek.focusKey).toBe(fmea.focusKey);
    expect(peek.phase).toBe(fmea.phase);
    expect(peek.prompt).toBe(fmea.prompt);
    // Ein zweiter Peek aendert nichts: gleiche Antwort, gleicher Sitzungsstand, Task weiter fmea.
    const nochmal = await tools.graph_generate.handler({ peek: true });
    expect(nochmal).toEqual(peek);
    expect(stand()).toEqual(vorher);
    // `task` am Peek wird nicht uebernommen: weder im Schritt noch in der Sitzung.
    const mitTask = await tools.graph_generate.handler({ peek: true, task: 'plan' });
    expect(mitTask.skill).toBe('se-fmea');
    expect(mitTask.focusKey).toBe(fmea.focusKey);
    expect(focusMemoryOf(harness).task).toBe('fmea');
    expect(stand()).toEqual(vorher);

    // Gegenprobe (bestehendes Verhalten, CR-GC-601): OHNE peek und ohne task geht es zurueck in den Kern —
    // und der Peek folgt der Sitzung dorthin.
    const kern = await tools.graph_generate.handler({});
    expect(focusMemoryOf(harness).task).toBe('kern');
    expect(kern.skill).not.toBe('se-fmea');
    const danach = await tools.graph_generate.handler({ peek: true });
    expect(danach.skill).toBe(kern.skill);
    expect(danach.focusKey).toBe(kern.focusKey);
  });

  it('(b) Peeks zwischen zwei Zuegen zaehlen keine Wiederholung — allein durch Peeks wird der Fokus nie zurueckgestellt', async () => {
    const erst = await tools.graph_generate.handler({});
    expect(erst.phase).toBe('expand');
    const s0 = stand();
    expect(s0.last).toMatchObject({ key: erst.focusKey, repeats: 0 });
    const zehnPeeks = async (wo: string) => {
      for (let i = 0; i < 10; i++) {
        const peek = await tools.graph_generate.handler({ peek: true });
        expect(peek.focusKey, `${wo}, Peek ${i + 1}`).toBe(erst.focusKey);
      }
    };

    // Ohne Zug: zehn Peeks, Sitzungsstand unveraendert.
    await zehnPeeks('vor dem ersten Zug');
    expect(stand()).toEqual(s0);

    // Ein Zug ohne Wirkung zaehlt EINE Wiederholung (der Zug selbst meldet sich im Gedaechtnis, CR-GC-729).
    await zugOhneWirkung();
    const s1 = stand();
    expect(s1.last).toMatchObject({ key: erst.focusKey, repeats: 1 });
    // Zehn Peeks danach: weiter derselbe Fokus, weiter EINE Wiederholung — gezaehlt haette schon der
    // zweite die Schwelle (2) erreicht und das Fund-Set zurueckgestellt.
    await zehnPeeks('zwischen den Zuegen');
    expect(stand()).toEqual(s1);
    expect(focusMemoryOf(harness).deferred.size).toBe(0);
    // Auch der echte Aufruf sieht den Fokus noch (kein Zug dazwischen: nichts zaehlen).
    expect((await tools.graph_generate.handler({})).focusKey).toBe(erst.focusKey);

    // Gegenprobe: zurueckgestellt wird erst mit dem ZWEITEN Zug — genau wie ohne jeden Peek (Fall oben).
    const zwei = await zugDannSchritt();
    expect(zwei.focusKey).not.toBe(erst.focusKey);
    expect([...focusMemoryOf(harness).deferred]).toEqual([erst.focusKey]);
    // Und der Peek folgt der Sitzung: derselbe neue Fokus, wieder ohne etwas zu aendern.
    const s2 = stand();
    expect((await tools.graph_generate.handler({ peek: true })).focusKey).toBe(zwei.focusKey);
    expect(stand()).toEqual(s2);
  });

  it('(c) ein in der Sitzung zurueckgestelltes Fund-Set fehlt auch im Peek — `defer` und `intent` am Peek wirken nicht', async () => {
    const erst = await tools.graph_generate.handler({});
    const key = erst.focusKey!;
    expect(key).toBeTruthy();

    // `defer` am Peek wird nicht uebernommen: der Fokus bleibt, die Sitzung stellt nichts zurueck.
    const peekMitDefer = await tools.graph_generate.handler({ peek: true, defer: [key] });
    expect(peekMitDefer.focusKey).toBe(key);
    expect(focusMemoryOf(harness).deferred.size).toBe(0);
    // `intent` am Peek schreibt keine Anker (der Datei-Write ist ein Effekt des echten Aufrufs).
    const intent = 'Ein Bestellsystem fuer Ersatzteile: Kunden bestellen Teile, das Lager bestaetigt die Lieferung, die Buchhaltung stellt die Rechnung.';
    await tools.graph_generate.handler({ peek: true, intent });
    expect(existsSync(join(repoRoot, TARGET_PROFILE_REL))).toBe(false);

    // Ein NORMALER Aufruf stellt zurueck — fuer die Sitzung (CR-GC-598).
    const weiter = await tools.graph_generate.handler({ defer: [key] });
    expect(weiter.focusKey).not.toBe(key);
    expect([...focusMemoryOf(harness).deferred]).toEqual([key]);
    // Der Peek liefert denselben Folgeschritt, nicht das zurueckgestellte Fund-Set.
    const peek = await tools.graph_generate.handler({ peek: true });
    expect(peek.focusKey).toBe(weiter.focusKey);
    expect(peek.focusKey).not.toBe(key);
    expect(peek.prompt).toBe(weiter.prompt);

    // Positivkontrolle zum Anker-Write: derselbe `intent` OHNE peek schreibt die Datei.
    await tools.graph_generate.handler({ intent, defer: [key] });
    expect(existsSync(join(repoRoot, TARGET_PROFILE_REL))).toBe(true);
  });
});
