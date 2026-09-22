/**
 * working-set.ts — die Arbeitsmenge der Sitzung (CR-GC-613).
 *
 * Gemessen an Lauf `gefuehrt-1` des Code-Tests (2026-09-22): `rules_get_violations` antwortete
 * mit 32.630 Zeichen (alle Warnungen des Systems, vor allem R-19/R-20 der SECHS nicht
 * beauftragten Module), `graph_test_report` mit 25.602 (81 REQ mit Testlage, 70 davon nie
 * gelaufen — die Scheibe hatte ~10). Zusammen mit drei `graph_context`-Aufrufen waren das
 * ~90.000 der 144.000 Zeichen, die graphcode in dem Lauf lieferte: **62 %**.
 *
 * Der Beleg, dass es nicht abgearbeitet wurde: nach den 32.630 Zeichen schrieb der Agent EINEN
 * Satz ("RC-01/02/03/05/06/07 are clean. Only RC-04 fires (5x)") und exportierte.
 *
 * Die Antwort war sachlich richtig und beantwortete eine WEITERE Frage als die gestellte. Der
 * Umfang fehlte an der Abfrage, nicht die Kürze an der Antwort — andere Ursache als die feste
 * Grundlast (CR-GC-612).
 *
 * **Warum kein `scope`-Argument:** jedes Argument steht im Werkzeugkatalog und damit im Executor
 * in JEDER Runde (200–400 Zeichen × alle Aufrufe). Der Umfang wird deshalb ABGELEITET — aus den
 * eigenen Schreibzügen der Sitzung, die das Audit-Log ohnehin führt.
 *
 * **Warum eine reine Funktion:** sie ist die einzige Stelle, an der "was habe ich angefasst"
 * definiert wird, und ein Test kann sie festnageln, ohne einen Store zu bauen.
 *
 * @author andreas@siglochconsulting
 */
import type { AuditEntry } from '@sigloch/graph-api-core';
import type { MutateCommand } from '@sigloch/contracts/harness';

/** Was die Sitzung selbst angefasst hat — die abgeleitete Vorgabe-Scheibe der Lesewerkzeuge. */
export interface Arbeitsmenge {
  /** Die uids, sortiert. Leer heisst: noch kein Schreibzug — dann antwortet das Werkzeug ueber das ganze Modell. */
  uids: string[];
  /** Wie viele ANGEWANDTE Stapel dazu beigetragen haben (0 bei leerer Menge). */
  zuege: number;
}

/** Die uids, die ein einzelnes Kommando anfasst. */
function beruehrt(cmd: MutateCommand): string[] {
  switch (cmd.op) {
    case 'add-node':
    case 'update-node':
      return [cmd.node.uid];
    case 'delete-node':
      return [cmd.uid];
    case 'add-edge':
    case 'delete-edge':
    case 'update-edge':
      // BEIDE Enden: eine Kante zu legen heisst, ueber beide Knoten etwas auszusagen.
      return [cmd.edge.sourceId, cmd.edge.targetId];
    case 'merge-nodes':
      return [cmd.sourceUid, cmd.targetUid];
  }
}

/**
 * Die Arbeitsmenge aus den Audit-Einträgen einer Sitzung.
 *
 * Gezählt wird NUR, was wirklich geschrieben wurde: `operation: 'mutate'` mit
 * `result: 'applied'`. Ein `validate`-Eintrag (dryRun-Preview, CR-GC-276) ist ein Vorschlag, kein
 * Zug — er darf den Umfang einer späteren Leseantwort nicht bestimmen, sonst könnte ein
 * verworfener Kandidat die Scheibe aufziehen. Ein abgewiesener Stapel ebenso wenig: was das Gate
 * zurückwies, steht nicht im Graphen.
 *
 * Ein Eintrag ohne `commands` (ein älterer Log, oder ein über `formatE` gelaufener Stapel, dessen
 * Kommandos nicht mitgeschrieben wurden) trägt nichts bei und wird auch nicht als Zug gezählt —
 * lieber eine Scheibe, die zu klein ist und sich als leer zu erkennen gibt, als eine, die still
 * so tut, als wüsste sie mehr.
 *
 * Rein: keine Uhr, kein Store, kein Graph. Die Grenze "seit Sitzungsstart" zieht der Aufrufer
 * über `auditLog.query({ since })`.
 */
export function arbeitsmengeAusAudit(entries: readonly AuditEntry[]): Arbeitsmenge {
  const uids = new Set<string>();
  let zuege = 0;
  for (const e of entries) {
    if (e.operation !== 'mutate' || e.result !== 'applied') continue;
    const cmds = e.commands as MutateCommand[] | undefined;
    if (!cmds?.length) continue;
    zuege += 1;
    for (const cmd of cmds) for (const uid of beruehrt(cmd)) uids.add(uid);
  }
  return { uids: [...uids].sort(), zuege };
}

/**
 * Der Umfang, den eine Leseantwort genommen hat — steht IN der Antwort, nie nur im Werkzeugtext.
 *
 * Ohne dieses Feld liefert dieselbe Abfrage je nach Sitzungsstand etwas anderes: nicht testbar,
 * nicht prüfbar, und der Agent kann nicht erkennen, ob er alles bekam. `ausserhalb` ist die
 * zweite Hälfte derselben Zusage — ein Gate, das ohne Abdeckung grün meldet, ist schlimmer als
 * keins (Leitlinie).
 */
export interface Umfang {
  /** 'arbeitsmenge' = auf die eigenen Schreibzüge geschnitten · 'ganzes-modell' = kein Schnitt. */
  art: 'arbeitsmenge' | 'ganzes-modell';
  /** Die uids, auf die geschnitten wurde (leer bei 'ganzes-modell'). */
  uids: string[];
  /** Wie viele Treffer AUSSERHALB der Scheibe liegen — die Zahl, nicht der Inhalt. */
  ausserhalb: number;
}

/**
 * Die Scheibe anwenden — oder eben nicht.
 *
 * **Der erste Aufruf einer Sitzung ohne Schreibzüge liefert das ganze Modell**, unverändertes
 * Verhalten: ohne Zug gibt es keine Arbeitsmenge, und eine leere Scheibe wäre eine leere Antwort
 * auf eine sinnvolle Frage.
 */
export function schneide<T>(
  alle: readonly T[],
  arbeitsmenge: Arbeitsmenge,
  elementVon: (x: T) => string | undefined,
): { genommen: T[]; umfang: Umfang } {
  if (arbeitsmenge.uids.length === 0) {
    return { genommen: [...alle], umfang: { art: 'ganzes-modell', uids: [], ausserhalb: 0 } };
  }
  const menge = new Set(arbeitsmenge.uids);
  const genommen = alle.filter((x) => {
    const id = elementVon(x);
    return id !== undefined && menge.has(id);
  });
  return {
    genommen,
    umfang: { art: 'arbeitsmenge', uids: arbeitsmenge.uids, ausserhalb: alle.length - genommen.length },
  };
}

/**
 * Die Arbeitsmenge um die REQ erweitern, an denen ein Element der Menge HAENGT (CR-GC-613).
 *
 * Warum ueberhaupt ein Schritt weiter: ein Agent fasst FUNCs und TESTs an, nicht REQ. Ohne diesen
 * Schritt waere die Test-Scheibe einer Bauphase leer, obwohl genau die REQ hinter den angefassten
 * Knoten gefragt sind — gemessen am Code-Test: 81 REQ im Bericht, ~10 in der Scheibe.
 *
 * Genau EIN Schritt, und nur ueber die beiden Kanten, die auf ein REQ ZEIGEN:
 *   `satisfy` — dieses Element loest die Anforderung ein (der Bau-Fall),
 *   `verify`  — dieser TEST weist sie nach (der Fall nach `graph_test_ingest`, das TEST-Knoten
 *               schreibt und danach ueber genau deren REQ berichten soll).
 * Zwei Schritte waeren wieder das halbe Modell, und jeder andere Kantentyp behauptete etwas
 * anderes. Rein ueber die Kantenliste — kein Store, kein Typregister.
 */
const REQ_KANTEN = new Set(['satisfy', 'verify']);

export function mitGetragenenReq(
  arbeitsmenge: Arbeitsmenge,
  edges: readonly { sourceId: string; targetId: string; edgeType: string }[],
): Arbeitsmenge {
  if (arbeitsmenge.uids.length === 0) return arbeitsmenge;
  const menge = new Set(arbeitsmenge.uids);
  for (const e of edges) {
    if (REQ_KANTEN.has(e.edgeType) && menge.has(e.sourceId)) menge.add(e.targetId);
  }
  return { uids: [...menge].sort(), zuege: arbeitsmenge.zuege };
}
