/**
 * lock-owner-contract.ts — SCHEMA-lock-owner, der Datenvertrag von
 * `.graphcode/owner.lock` (FLOW-store-ownership, CR-GC-420).
 *
 * Warum das geprüft gehört und nicht nur gelesen: aus diesem Dokument leitet
 * `reclaimIfStale()` ab, ob ein gehaltener Lock zurückgeholt werden darf. Ein
 * blanker Typ-Cast hätte ein pid-loses Dokument als gültigen Owner durchgereicht —
 * `process.kill(undefined, 0)` wirft TypeError (`ERR_INVALID_ARG_TYPE`), nicht
 * `EPERM`, also las der Aufrufer „Prozess nachweislich weg" und löschte den Lock
 * eines möglicherweise LEBENDEN Owners. Genau die zwei Schreiber auf einem
 * Kuzu-Store, die REQ-single-kuzu-owner ausschließt.
 *
 * Eigene Datei, weil das Lockfile eine Prozessgrenze quert (geschrieben vom Owner,
 * gelesen von jedem anderen graphcode im selben Repo — oft von einem anderen Build)
 * und weil RC-04 Import UND `parse` am modellierten Interface verlangt.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';

/**
 * Die Identität, die im Lockfile steht, damit nur der wahre Owner ihn freigibt.
 *
 * `version` ist optional, weil ein Lock von einem Owner vor CR-GC-376 stammen kann
 * (der Build-Stempel kam erst dort dazu). Alles andere schreibt jeder Owner seit
 * CR-GC-218 — fehlt eines der Felder, ist das Dokument nicht auslegbar, und der
 * Leser muss den sicheren Weg nehmen statt zu raten.
 */
export const LockOwner = z.object({
  pid: z.number().int().positive(),
  hostname: z.string().min(1),
  startedAt: z.string().min(1),
  /**
   * Der Build, der den Store gerade besitzt (CR-GC-376).
   *
   * Ein Prozess lebt weiter mit dem Code, mit dem er gebootet hat: wer im Terminal
   * ein neueres `graphcode` tippt, sieht dessen Zahlen — der Host im selben Repo
   * kann ein älteres Paket fahren und damit eine andere Ontologie. Der Stempel ist
   * die EINZIGE lokale Quelle für „welcher Build besitzt den Store", ohne den Host
   * zu befragen (`status` ist read-only und darf nie an einem toten Port hängen).
   */
  version: z.string().optional(),
  /**
   * Womit der Owner gebootet hat (CR-GC-620) — und damit das, was die Nummer NICHT sagt.
   *
   * Eine Paketnummer identifiziert ein Release, keinen Build: `npm run build` macht
   * `rm -rf dist && tsc` und laesst sie stehen, `npm install` tauscht contracts darunter aus.
   * Beides ist fuer den laufenden Prozess unsichtbar, und `status` meldete deshalb
   * `Version OK` ueber einem Host, dessen geladene Dateien seit elf Stunden geloescht waren.
   *
   * OPTIONAL, und das ist keine Bequemlichkeit: `readLockOwner` gibt bei Vertragsbruch `null`
   * zurueck, und `null` heisst dort „kein benennbarer Eigentuemer". Ein Pflichtfeld haette
   * jeden Lock eines aelteren Builds als verwaist gemeldet — die schlimmere Luege als die,
   * die dieses Feld beseitigt.
   */
  boot: z
    .object({
      /** Das Verzeichnis, aus dem der Owner geladen hat (`…/dist`). */
      codeRoot: z.string().min(1),
      /** Neueste `mtimeMs` darunter, zum Zeitpunkt des Boots. */
      codeMtimeMs: z.number(),
      /** Die beim Boot installierte `@sigloch/contracts`-Version. */
      contracts: z.string().optional(),
    })
    .optional(),
});

/** Ein Lock-Owner, aus seinem Vertrag abgeleitet. */
export type LockOwner = z.infer<typeof LockOwner>;
