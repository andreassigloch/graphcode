/**
 * Referenz fuer die verdeckte Abnahme (CR-GC-610) — belegt nur, dass die Abnahme erfuellbar und
 * widerspruchsfrei ist. Bewusst ein einziges Modul: sie ist KEIN Architekturmassstab und wird keinem
 * Arm gezeigt.
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CreateScheduler, RunRecord, TaskDecl, SchedulerDeps } from '../../vertrag/contract.js';

interface State { records: RunRecord[]; /** je Aufgabe: bis wohin (ms) alles erledigt oder uebersprungen ist */ bis: Record<string, number> }

const lade = (dir: string): State => {
  const p = join(dir, 'state.json');
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as State) : { records: [], bis: {} };
};
const sichere = (dir: string, s: State) => {
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, 'state.json.tmp');
  writeFileSync(tmp, JSON.stringify(s));
  renameSync(tmp, join(dir, 'state.json'));
};

/** Termine (ms) in (nach, jetzt], aufsteigend. */
const termine = (t: TaskDecl, nach: number, jetzt: number): number[] => {
  const n = t.everyMinutes * 60_000;
  const out: number[] = [];
  for (let s = Math.floor(jetzt / n) * n; s > nach; s -= n) out.unshift(s);
  return out;
};

export const createScheduler: CreateScheduler = (deps: SchedulerDeps) => {
  const state = lade(deps.stateDir);
  const neu = (r: RunRecord, im: RunRecord[]) => { state.records.push(r); im.push(r); sichere(deps.stateDir, state); };

  async function fuehreAus(t: TaskDecl, slot: string, im: RunRecord[]) {
    for (let attempt = 1; attempt <= t.maxAttempts; attempt++) {
      const basis = { taskId: t.id, slot, attempt, instructionVersion: t.instructionVersion };
      let model: string | undefined;
      try {
        const out = await deps.runner.run({ taskId: t.id, slot, attempt });
        model = out.model;
        if (deps.validator.validate(t.id, out.output)) return neu({ ...basis, status: 'succeeded', model }, im);
        neu({ ...basis, status: 'invalid', model }, im);
      } catch {
        neu({ ...basis, status: 'failed' }, im);
      }
      if (attempt === t.maxAttempts) {
        neu({ ...basis, status: 'dead-letter', ...(model ? { model } : {}) }, im);
        deps.notifier.notify({ taskId: t.id, slot, reason: 'dead-letter' });
      }
    }
  }

  return {
    async tick() {
      const jetzt = deps.clock.now().getTime();
      const im: RunRecord[] = [];
      for (const t of deps.tasks) {
        if (t.requiresNetwork && !deps.network.online()) continue;
        // Erster Start: nur der juengste faellige Termin (aufgabe.md Punkt 2).
        const n = t.everyMinutes * 60_000;
        const faellig = termine(t, state.bis[t.id] ?? Math.floor(jetzt / n) * n - n, jetzt);
        if (faellig.length === 0) continue;
        const laufen = faellig.length === 1 || t.catchUp === 'all' ? faellig : t.catchUp === 'latest' ? faellig.slice(-1) : [];
        for (const s of faellig) {
          const slot = new Date(s).toISOString();
          if (laufen.includes(s)) await fuehreAus(t, slot, im);
          else neu({ taskId: t.id, slot, attempt: 0, status: 'skipped', instructionVersion: t.instructionVersion }, im);
          state.bis[t.id] = s;
          sichere(deps.stateDir, state);
        }
      }
      return im;
    },
    history: () => [...state.records],
  };
};
