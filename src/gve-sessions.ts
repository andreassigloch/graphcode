/**
 * gve-sessions.ts — wer im Repo noch ein Dashboard braucht (CR-GC-404).
 *
 * Der Befund, aus dem dieses Modul entstand: der Viewer gehoerte dem Gewinner der
 * Store-Wahl. Wer das Fenster schloss, das zufaellig als erstes gestartet war, nahm
 * allen anderen offenen Sessions das Dashboard mit — die blieben Proxys und merkten
 * nichts davon. Beobachtet in graphcodedemo am 2026-08-22: ein Host haelt den Viewer
 * von 14:05 bis 20:25, fuenf spaetere Sessions haengen als Proxy daran, und mit dem
 * Fenster des Ersten ist das Dashboard weg.
 *
 * Deshalb gehoert der Viewer dem REPO, nicht einer Session: jede Session traegt sich
 * hier ein, und erst die letzte macht das Licht aus. Der Eintrag ist eine Datei pro
 * PID — kein Zaehler, denn ein Zaehler ueberlebt keinen harten Kill; eine PID-Datei
 * laesst sich gegen die Prozesstabelle pruefen und damit aufraeumen.
 *
 * @author andreas@siglochconsulting
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { SessionEntrySchema, type SessionEntry } from './gve-session-contract.js';

/** Wo die Sessions eines Repos stehen — neben Store und Lock, also gitignored. */
export function sessionsDir(repoRoot: string): string {
  return join(repoRoot, '.graphcode', 'sessions');
}

/** Wo die PID des laufenden Viewers steht, damit ihn JEDE Session beenden kann. */
export function viewerPidFile(repoRoot: string): string {
  return join(repoRoot, '.graphcode', 'gve.pid');
}

/** Solange eine Spawn-Reservierung gilt — danach war der Reservierende offenbar weg. */
export const SPAWN_LOCK_TTL_MS = 20_000;

function spawnLockFile(repoRoot: string): string {
  return join(repoRoot, '.graphcode', 'gve.spawn.lock');
}

/**
 * Lebt der Prozess? `kill(pid, 0)` schickt kein Signal, sondern fragt nur.
 * EPERM heisst „lebt, gehoert aber jemand anderem" — also lebt.
 */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

// Der Eintrags-Vertrag wohnt seit CR-GC-416 in `./gve-session-contract.ts` —
// er quert eine Prozessgrenze und gehoert deshalb keiner der beiden Seiten.

/** Diese Session braucht ein Dashboard. Idempotent. */
export function registerSession(repoRoot: string, pid: number = process.pid): void {
  const dir = sessionsDir(repoRoot);
  mkdirSync(dir, { recursive: true });
  const entry: SessionEntry = { pid, hostname: hostname(), startedAt: new Date().toISOString() };
  writeFileSync(join(dir, `${pid}`), JSON.stringify(entry));
}

/** Diese Session ist fertig. Idempotent. */
export function unregisterSession(repoRoot: string, pid: number = process.pid): void {
  rmSync(join(sessionsDir(repoRoot), `${pid}`), { force: true });
}

/**
 * Die noch lebenden Sessions dieses Repos — tote Eintraege werden dabei entfernt.
 *
 * Eintraege eines ANDEREN Rechners zaehlen nicht und werden auch nicht geloescht:
 * ihre PID gegen die eigene Prozesstabelle zu pruefen waere geraten, nicht gewusst.
 * `.graphcode/` ist repo-lokal, der Fall ist damit theoretisch — aber ein falsch
 * geloeschter fremder Eintrag waere ein stiller Fehler, ein ignorierter nicht.
 */
export function liveSessions(repoRoot: string): number[] {
  const dir = sessionsDir(repoRoot);
  if (!existsSync(dir)) return [];
  const me = hostname();
  const alive: number[] = [];
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    // Geprueft, nicht gecastet (CR-GC-416): ein Eintrag ohne `hostname` waere sonst
    // als "anderer Rechner" durchgerutscht — die Sitzung zaehlte nicht mehr mit, und
    // der Viewer ging zu frueh aus. Formfremd ist genauso wertlos wie unlesbar.
    let entry: SessionEntry;
    try {
      entry = SessionEntrySchema.parse(JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      rmSync(file, { force: true }); // unlesbar oder formfremd = wertlos
      continue;
    }
    if (entry.hostname !== me) continue;
    if (isAlive(entry.pid)) alive.push(entry.pid);
    else rmSync(file, { force: true });
  }
  return alive;
}

/**
 * Reserviert das Starten des Viewers fuer diese Session.
 *
 * Ohne die Reservierung starten N Sessions, die gleichzeitig „kein Viewer da" sehen,
 * N Viewer — die Identitaets-Probe kommt zu spaet, weil noch keiner gebunden hat.
 * Die Reservierung wird NICHT freigegeben, sondern laeuft ab (`SPAWN_LOCK_TTL_MS`):
 * ein abgestuerzter Reservierender darf den Viewer nicht dauerhaft blockieren, und
 * eine Ablauffrist braucht keinen Freigabepfad, der selbst fehlschlagen kann.
 */
export function reserveSpawn(repoRoot: string, now: number = Date.now()): boolean {
  const file = spawnLockFile(repoRoot);
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(file, JSON.stringify({ pid: process.pid, at: now }), { flag: 'wx' });
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') return false;
      let at = 0;
      try {
        at = (JSON.parse(readFileSync(file, 'utf8')) as { at?: number }).at ?? 0;
      } catch {
        at = 0; // unlesbar = abgelaufen
      }
      if (now - at < SPAWN_LOCK_TTL_MS) return false;
      rmSync(file, { force: true });
    }
  }
  return false;
}

/** Merkt sich den gestarteten Viewer, damit spaeter JEDE Session ihn beenden kann. */
export function rememberViewer(repoRoot: string, pid: number): void {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  writeFileSync(viewerPidFile(repoRoot), JSON.stringify({ pid, startedAt: new Date().toISOString() }));
}

/** Die PID des von graphcode gestarteten Viewers — `null`, wenn keiner vermerkt ist. */
export function rememberedViewerPid(repoRoot: string): number | null {
  try {
    const pid = (JSON.parse(readFileSync(viewerPidFile(repoRoot), 'utf8')) as { pid?: number }).pid;
    return typeof pid === 'number' ? pid : null;
  } catch {
    return null;
  }
}

/** Vergisst den Viewer (er ist beendet oder gehoert uns nicht). */
export function forgetViewer(repoRoot: string): void {
  rmSync(viewerPidFile(repoRoot), { force: true });
}
