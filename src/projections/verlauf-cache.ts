/**
 * verlauf-cache.ts — der Zwischenspeicher des Verlaufs auf Platte (CR-GC-946).
 *
 * Eine Datei im Store-Verzeichnis (`harness.getStoreDir()`, nicht fest `.graphcode`). Ein Stand ist
 * unveraenderlich; sein Messergebnis haengt an Commit, Regelversion und Policy — das steht im
 * Schluessel (`verlaufSchluessel`). Beim Speichern bleiben nur Eintraege der laufenden Regelversion
 * und Policy: die Datei waechst nicht mit jeder Schwellenaenderung.
 *
 * @author andreas@siglochconsulting
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod/v4';
import { VerlaufStandSchema, VERLAUF_SCHEMA, type VerlaufCache, type VerlaufStand } from './verlauf.js';

export const VERLAUF_CACHE_DATEI = 'verlauf-cache.json';

const DateiSchema = z.object({ schema: z.number().int(), entries: z.record(z.string(), VerlaufStandSchema) });

/** Ein Zwischenspeicher, der beim Anlegen liest und mit `speichere` schreibt. Eine unlesbare Datei zaehlt als leer. */
export class PlattenCache implements VerlaufCache {
  private readonly entries = new Map<string, VerlaufStand>();
  private readonly pfad: string;

  constructor(storeDir: string) {
    this.pfad = join(storeDir, VERLAUF_CACHE_DATEI);
    if (!existsSync(this.pfad)) return;
    try {
      const datei = DateiSchema.parse(JSON.parse(readFileSync(this.pfad, 'utf8')));
      if (datei.schema === VERLAUF_SCHEMA) for (const [k, v] of Object.entries(datei.entries)) this.entries.set(k, v);
    } catch {
      // unlesbar: neu messen, nicht abbrechen
    }
  }

  get(key: string): VerlaufStand | undefined {
    return this.entries.get(key);
  }

  set(key: string, stand: VerlaufStand): void {
    this.entries.set(key, stand);
  }

  /** Schreibt die Eintraege mit diesem Schluesselpraefix (Schema, Regelversion, Policy) — alles andere ist ueberholt. */
  speichere(praefix: string): void {
    const behalten = Object.fromEntries([...this.entries].filter(([k]) => k.startsWith(praefix)));
    mkdirSync(dirname(this.pfad), { recursive: true });
    const tmp = `${this.pfad}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ schema: VERLAUF_SCHEMA, entries: behalten }));
    renameSync(tmp, this.pfad);
  }
}
