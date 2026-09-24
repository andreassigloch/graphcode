/**
 * fund-kontext.ts — die Element-Liste einer Runde aus dem KONTEXT des Funds statt aus dem Typfilter
 * (CR-GC-652).
 *
 * Ein Fund ist fast immer eine FEHLENDE Kante: RD-01 sagt „dieser REQ fehlt der Erfueller". Die
 * Liste soll deshalb nicht zeigen, wer am Fund HAENGT (das ist der Blast-Radius, `graph_impact`),
 * sondern wer daran haengen SOLLTE. Gemessen an fuenf RD-01-Funden des eigenen Modells:
 *
 *   | Zuschnitt                                   | Knoten | Zeichen |
 *   |---------------------------------------------|-------:|--------:|
 *   | Typfilter, erste 100 je Typ (bis CR-GC-652) |   ~100 |   6.244 |
 *   | Nachbarschaft Tiefe 2, ungerichtet          |     90 |   5.837 | 77 davon REQ — Hub-Fan-out ueber SYS/UC
 *   | Nachbarschaft Tiefe 3, ungerichtet          |    284 |  17.146 |
 *   | gerichtet entlang der Ontologie             |     39 |   1.986 |
 *
 * Der gerichtete Weg: vom Fund ueber `compose` HINAUF bis zum Besitzer (UC oder SYS), von dort den
 * Realisierungsbaum HINUNTER (FCHAIN → FUNC → MOD bzw. SYS → MOD). Das sind die Elemente, die das
 * Szenario oder das System des Funds umsetzen — die natuerlichen Kandidaten fuer die fehlende Kante.
 *
 * Hat ein Fund keinen Besitzer, gibt es KEINE Rueckfall-Liste (Entscheidung Auftraggeber
 * 2026-09-24): der fehlende Besitzer ist selbst ein Befund und wird als solcher genannt.
 *
 * Rein: Knoten und Kanten rein, Auswahl raus. Kein Registry-, kein Store-Zugriff.
 *
 * @author andreas@siglochconsulting
 */

export interface KontextKnoten {
  uid: string;
  type: string;
  name: string;
}

export interface KontextKante {
  sourceId: string;
  targetId: string;
  edgeType: string;
}

export interface FundKontext {
  /** Die Auswahl, gefiltert auf die Fokus-Typen, uid-sortiert. Der Fund selbst gehoert dazu. */
  knoten: KontextKnoten[];
  /** Fund-Knoten, deren Weg hinauf weder einen UC noch ein SYS erreicht. */
  ohneBesitzer: string[];
}

/** Besitzer: hier endet der Weg hinauf, hier beginnt der Weg hinunter. */
const BESITZER = new Set(['UC', 'SYS']);

/** Der Realisierungsbaum: nur diese Zieltypen, nur ueber compose/allocate. Kein UC, kein REQ —
 * SYS compose→UC/REQ fuehrte sonst ueber das halbe Modell (genau der Hub-Fan-out oben). */
const REALISIERUNG = new Set(['FCHAIN', 'FUNC', 'MOD', 'SYS']);
const ABWAERTS = new Set(['compose', 'allocate']);

export function fundKontext(
  graph: { nodes: KontextKnoten[]; edges: KontextKante[] },
  fund: readonly string[],
  fokusTypen: readonly string[],
): FundKontext {
  const knotenVon = new Map(graph.nodes.map((n) => [n.uid, n]));
  const typ = (uid: string): string | undefined => knotenVon.get(uid)?.type;
  const eltern = new Map<string, string[]>();
  const kinder = new Map<string, string[]>();
  const anhaengen = (m: Map<string, string[]>, von: string, zu: string): void => {
    const liste = m.get(von);
    if (liste) liste.push(zu);
    else m.set(von, [zu]);
  };
  for (const e of graph.edges) {
    if (e.edgeType === 'compose') anhaengen(eltern, e.targetId, e.sourceId);
    if (ABWAERTS.has(e.edgeType) && REALISIERUNG.has(typ(e.targetId) ?? '')) anhaengen(kinder, e.sourceId, e.targetId);
  }

  const gesehen = new Set<string>();
  const besitzer = new Set<string>();
  const ohneBesitzer: string[] = [];
  for (const start of fund) {
    if (!knotenVon.has(start)) continue;
    gesehen.add(start);
    // Ist der Fund selbst ein Besitzer (UC-01: ein UC ohne REQ), ist er der Ausgangspunkt nach
    // unten — hinauf zum SYS ginge es sonst in den ganzen Modulbaum.
    if (BESITZER.has(typ(start) ?? '')) {
      besitzer.add(start);
      continue;
    }
    // Hinauf: ueber compose, bis ein Besitzer erreicht ist — dort nicht weiter.
    let gefunden = false;
    const offen = [start];
    const hinauf = new Set([start]);
    while (offen.length > 0) {
      const u = offen.pop()!;
      for (const p of eltern.get(u) ?? []) {
        if (hinauf.has(p)) continue;
        hinauf.add(p);
        gesehen.add(p);
        if (BESITZER.has(typ(p) ?? '')) {
          besitzer.add(p);
          gefunden = true;
        } else {
          offen.push(p);
        }
      }
    }
    if (!gefunden) ohneBesitzer.push(start);
  }

  // Hinunter: vom Besitzer durch den Realisierungsbaum.
  const offen = [...besitzer];
  while (offen.length > 0) {
    const u = offen.pop()!;
    for (const k of kinder.get(u) ?? []) {
      if (gesehen.has(k)) continue;
      gesehen.add(k);
      offen.push(k);
    }
  }

  const fokus = new Set(fokusTypen);
  const knoten = [...gesehen]
    .map((u) => knotenVon.get(u)!)
    .filter((n) => fokus.size === 0 || fokus.has(n.type))
    .sort((a, b) => a.uid.localeCompare(b.uid));
  return { knoten, ohneBesitzer };
}
