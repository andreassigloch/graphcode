/**
 * contract.ts — die EINE feste Grenze des Code-Tests (CR-GC-610). Beide Arme bekommen diese Datei
 * wortgleich; alles dahinter (Module, Zerlegung, Persistenzformat, eigene Tests) ist ihre Arbeit.
 *
 * Fest ist nur, was die verdeckte Abnahme braucht, um beide Implementierungen gleich zu pruefen:
 * die Ports nach aussen (Uhr, Netz, Ausfuehrung, Pruefung, Meldung) und die Fabrik. Das Modell und
 * seine Werkzeuge liegen hinter `Runner` — sie gehoeren nicht zur Scheibe.
 *
 * @author andreas@siglochconsulting
 */

/** Nachholregel je Aufgabe, wenn mehr als ein Termin seit dem letzten Tick faellig wurde. */
export type CatchUp = 'all' | 'latest' | 'none';

/** Eine deklarierte Aufgabe — Daten, kein Code. */
export interface TaskDecl {
  id: string;
  /** Takt in Minuten. Termine liegen auf ganzzahligen Vielfachen ab der Unix-Epoche (UTC). */
  everyMinutes: number;
  catchUp: CatchUp;
  /** Laeuft nur am Netz; offline faellige Termine bleiben offen und laufen beim ersten Tick am Netz. */
  requiresNetwork?: boolean;
  /** Fassung der Anweisung — steht in jedem Nachweis. */
  instructionVersion: string;
  /** Versuche je Termin inklusive des ersten (>= 1). */
  maxAttempts: number;
}

export interface Clock { now(): Date }
export interface Network { online(): boolean }

export interface RunInput { taskId: string; /** Termin als ISO-Zeit (UTC) */ slot: string; /** 1-basiert */ attempt: number }
export interface RunOutput { /** welches Modell die Ausgabe erzeugt hat */ model: string; output: unknown }
/** Fuehrt einen Termin aus (Daten holen, Modell, Werkzeuge). Wirft bei Fehlern. */
export interface Runner { run(input: RunInput): Promise<RunOutput> }
/** Prueft eine Ausgabe gegen die vereinbarte Form. */
export interface Validator { validate(taskId: string, output: unknown): boolean }
export interface Notifier { notify(event: { taskId: string; slot: string; reason: 'dead-letter' }): void }

export type RunStatus = 'succeeded' | 'failed' | 'invalid' | 'dead-letter' | 'skipped';

/** Ein Nachweis. Jeder Versuch ergibt einen; `skipped` steht fuer einen bewusst nicht nachgeholten Termin. */
export interface RunRecord {
  taskId: string;
  slot: string;
  /** 0 bei `skipped`, sonst 1-basiert */
  attempt: number;
  status: RunStatus;
  /** gesetzt, sobald der Runner geantwortet hat */
  model?: string;
  instructionVersion: string;
}

export interface SchedulerDeps {
  tasks: TaskDecl[];
  clock: Clock;
  network: Network;
  runner: Runner;
  validator: Validator;
  notifier: Notifier;
  /** Einziger Ort fuer dauerhaften Zustand. Neustart = neue Instanz mit demselben Verzeichnis;
   * Umzug = Verzeichnis kopieren. */
  stateDir: string;
}

export interface Scheduler {
  /** Alles jetzt Faellige abarbeiten; liefert die in diesem Tick entstandenen Nachweise in Reihenfolge. */
  tick(): Promise<RunRecord[]>;
  /** Alle Nachweise dieses Zustandsverzeichnisses, auch aus frueheren Instanzen, in Reihenfolge. */
  history(): RunRecord[];
}

/** Die Implementierung exportiert aus `src/index.ts`: `export const createScheduler: CreateScheduler`. */
export type CreateScheduler = (deps: SchedulerDeps) => Scheduler;
