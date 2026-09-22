/**
 * Verdeckte Abnahme des Code-Tests (CR-GC-610) — prueft aufgabe.md Punkt 1–10 ueber den Vertrag.
 * Kein Arm sieht diese Datei. Aufruf: IMPL=<workspace> npx vitest run --config rig/code-test/vitest.config.ts
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CreateScheduler, RunRecord, TaskDecl, RunOutput } from '../vertrag/contract.js';

const IMPL = process.env.IMPL;
if (!IMPL) throw new Error('IMPL=<Pfad zur Implementierung> setzen');
const { createScheduler } = (await import(pathToFileURL(resolve(IMPL, 'src', 'index.ts')).href)) as { createScheduler: CreateScheduler };

const MIN = 60_000;
const T0 = Date.UTC(2026, 8, 22, 0, 0); // ein Termin fuer jedes n, das 1440 teilt

/** Steuerbare Welt: Uhr, Netz, Runner mit Drehbuch, Pruefer, Meldungen. */
function welt() {
  const w = {
    t: T0,
    online: true,
    stateDir: mkdtempSync(join(tmpdir(), 'abnahme-')),
    /** je Aufruf: 'ok' | 'wirft' | 'unsinn' — leer heisst 'ok' */
    drehbuch: [] as ('ok' | 'wirft' | 'unsinn')[],
    aufrufe: [] as { taskId: string; slot: string; attempt: number }[],
    meldungen: [] as { taskId: string; slot: string }[],
  };
  const deps = (tasks: TaskDecl[], stateDir = w.stateDir) => ({
    tasks,
    stateDir,
    clock: { now: () => new Date(w.t) },
    network: { online: () => w.online },
    runner: {
      async run(input: { taskId: string; slot: string; attempt: number }): Promise<RunOutput> {
        w.aufrufe.push(input);
        const art = w.drehbuch.shift() ?? 'ok';
        if (art === 'wirft') throw new Error('Modell nicht geladen');
        return { model: 'qwen-test', output: art === 'ok' ? { ok: true } : { unsinn: 1 } };
      },
    },
    validator: { validate: (_id: string, out: unknown) => (out as { ok?: boolean }).ok === true },
    notifier: { notify: (e: { taskId: string; slot: string }) => void w.meldungen.push(e) },
  });
  return { w, deps };
}

const task = (over: Partial<TaskDecl> = {}): TaskDecl => ({
  id: 'tagebuch', everyMinutes: 60, catchUp: 'all', instructionVersion: 'v3', maxAttempts: 2, ...over,
});
const iso = (ms: number) => new Date(ms).toISOString();
const kurz = (rs: RunRecord[]) => rs.map((r) => `${r.taskId}@${r.slot.slice(11, 16)}#${r.attempt}:${r.status}`);

let W: ReturnType<typeof welt>;
beforeEach(() => { W = welt(); });

describe('1–3 Termine, erster Start, Normalbetrieb', () => {
  it('der erste Tick fuehrt nur den juengsten faelligen Termin aus', async () => {
    W.w.t = T0 + 150 * MIN; // 02:30 — faellig waeren 00:00, 01:00, 02:00
    const s = createScheduler(W.deps([task()]));
    expect(kurz(await s.tick())).toEqual(['tagebuch@02:00#1:succeeded']);
  });

  it('ein Termin pro Takt laeuft normal, auch bei catchUp none', async () => {
    const s = createScheduler(W.deps([task({ catchUp: 'none' })]));
    await s.tick();
    W.w.t += 60 * MIN;
    expect(kurz(await s.tick())).toEqual(['tagebuch@01:00#1:succeeded']);
  });

  it('der Nachweis traegt Modell und Fassung der Anweisung', async () => {
    const s = createScheduler(W.deps([task()]));
    const [r] = await s.tick();
    expect(r).toMatchObject({ taskId: 'tagebuch', slot: iso(T0), attempt: 1, status: 'succeeded', model: 'qwen-test', instructionVersion: 'v3' });
  });
});

describe('4 Nachholen nach Schlaf', () => {
  const nachSchlaf = async (catchUp: TaskDecl['catchUp']) => {
    const s = createScheduler(W.deps([task({ catchUp })]));
    await s.tick(); // 00:00
    W.w.t += 3 * 60 * MIN; // zugeklappt bis 03:00 — faellig 01:00, 02:00, 03:00
    return kurz(await s.tick());
  };
  it('all: jeder Termin, aeltester zuerst', async () => {
    expect(await nachSchlaf('all')).toEqual(['tagebuch@01:00#1:succeeded', 'tagebuch@02:00#1:succeeded', 'tagebuch@03:00#1:succeeded']);
  });
  it('latest: nur der juengste, die aelteren als skipped', async () => {
    const r = await nachSchlaf('latest');
    expect(r.filter((x) => x.endsWith('succeeded'))).toEqual(['tagebuch@03:00#1:succeeded']);
    expect(r.filter((x) => x.endsWith('skipped')).sort()).toEqual(['tagebuch@01:00#0:skipped', 'tagebuch@02:00#0:skipped']);
  });
  it('none: keiner laeuft, alle skipped — der naechste Termin laeuft normal', async () => {
    const r = await nachSchlaf('none');
    expect(r.every((x) => x.endsWith('skipped'))).toBe(true);
    expect(r).toHaveLength(3);
    W.w.t += 60 * MIN;
    const s2 = createScheduler(W.deps([task({ catchUp: 'none' })]));
    expect(kurz(await s2.tick())).toEqual(['tagebuch@04:00#1:succeeded']);
  });
});

describe('5 + 9 nie zweimal — ueber Ticks, Neustart und Umzug', () => {
  it('zweimal Tick zur selben Zeit: ein Lauf', async () => {
    const s = createScheduler(W.deps([task()]));
    await s.tick();
    expect(await s.tick()).toEqual([]);
    expect(W.w.aufrufe).toHaveLength(1);
  });
  it('Neustart: neue Instanz, selbes Verzeichnis — kein zweiter Lauf, die Historie bleibt', async () => {
    await createScheduler(W.deps([task()])).tick();
    const neu = createScheduler(W.deps([task()]));
    expect(await neu.tick()).toEqual([]);
    expect(kurz(neu.history())).toEqual(['tagebuch@00:00#1:succeeded']);
  });
  it('Neustart nach Stromausfall: die versaeumten Termine werden nachgeholt, nicht wiederholt', async () => {
    await createScheduler(W.deps([task()])).tick();
    W.w.t += 2 * 60 * MIN;
    const neu = createScheduler(W.deps([task()]));
    expect(kurz(await neu.tick())).toEqual(['tagebuch@01:00#1:succeeded', 'tagebuch@02:00#1:succeeded']);
  });
  it('Umzug: kopiertes Verzeichnis setzt fort, ohne zu wiederholen', async () => {
    await createScheduler(W.deps([task()])).tick();
    const ziel = mkdtempSync(join(tmpdir(), 'umzug-'));
    cpSync(W.w.stateDir, ziel, { recursive: true });
    W.w.t += 60 * MIN;
    const drüben = createScheduler(W.deps([task()], ziel));
    expect(kurz(await drüben.tick())).toEqual(['tagebuch@01:00#1:succeeded']);
    expect(kurz(drüben.history())).toEqual(['tagebuch@00:00#1:succeeded', 'tagebuch@01:00#1:succeeded']);
  });
});

describe('6 Pruefen, Wiederholen, beiseitelegen', () => {
  it('Runner wirft einmal: failed, dann succeeded — im selben Tick', async () => {
    W.w.drehbuch = ['wirft', 'ok'];
    const s = createScheduler(W.deps([task()]));
    const r = await s.tick();
    expect(kurz(r)).toEqual(['tagebuch@00:00#1:failed', 'tagebuch@00:00#2:succeeded']);
    expect(r[0].model).toBeUndefined();
  });
  it('dauerhaft Unsinn: invalid bis maxAttempts, dann dead-letter, genau eine Meldung, nie wieder', async () => {
    W.w.drehbuch = ['unsinn', 'unsinn', 'unsinn', 'unsinn'];
    const s = createScheduler(W.deps([task({ maxAttempts: 2 })]));
    const r = await s.tick();
    expect(kurz(r)).toEqual(['tagebuch@00:00#1:invalid', 'tagebuch@00:00#2:invalid', 'tagebuch@00:00#2:dead-letter']);
    expect(r[0].model).toBe('qwen-test');
    expect(W.w.meldungen).toEqual([{ taskId: 'tagebuch', slot: iso(T0), reason: 'dead-letter' }]);
    expect(await createScheduler(W.deps([task({ maxAttempts: 2 })])).tick()).toEqual([]);
  });
});

describe('7 Netz', () => {
  const pruefung = task({ id: 'erreichbar', everyMinutes: 15, catchUp: 'latest', requiresNetwork: true });
  it('offline bleiben Termine offen; zurueck am Netz laeuft sofort der juengste', async () => {
    const s = createScheduler(W.deps([pruefung]));
    await s.tick(); // 00:00 am Netz
    W.w.online = false;
    W.w.t += 30 * MIN;
    expect(await s.tick()).toEqual([]); // 00:15, 00:30 offline — nichts
    W.w.t += 5 * MIN;
    W.w.online = true; // 00:35 zurueck
    const r = kurz(await s.tick());
    expect(r.filter((x) => x.endsWith('succeeded'))).toEqual(['erreichbar@00:30#1:succeeded']);
    expect(r.filter((x) => x.endsWith('skipped'))).toEqual(['erreichbar@00:15#0:skipped']);
  });
  it('eine Aufgabe ohne Netzbedarf laeuft offline weiter', async () => {
    W.w.online = false;
    const s = createScheduler(W.deps([task(), pruefung]));
    expect(kurz(await s.tick())).toEqual(['tagebuch@00:00#1:succeeded']);
  });
});

describe('10 Aufgaben sind Daten und unabhaengig', () => {
  it('zwei Aufgaben mit verschiedenem Takt und verschiedener Nachholregel', async () => {
    const a = task({ id: 'a', everyMinutes: 60, catchUp: 'all' });
    const b = task({ id: 'b', everyMinutes: 30, catchUp: 'none' });
    const s = createScheduler(W.deps([a, b]));
    await s.tick();
    W.w.t += 90 * MIN; // a: 01:00 ; b: 00:30, 01:00, 01:30
    const r = kurz(await s.tick());
    expect(r.filter((x) => x.startsWith('a@'))).toEqual(['a@01:00#1:succeeded']);
    expect(r.filter((x) => x.startsWith('b@')).every((x) => x.endsWith('skipped'))).toBe(true);
    expect(r.filter((x) => x.startsWith('b@'))).toHaveLength(3);
  });
});
