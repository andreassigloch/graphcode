# CR-GC-980: Vertragstest-Generator prüft nur die erste Feldebene

**Typ:** aus Item ITEM-2026-1531 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1531.json (Lane: code)

---

## Befund

CR-GC-973 maß es: `graphcode vertragstest` erzeugt Ablehnungsfälle nur für die Felder der ersten Ebene. Eine Mutante an einem Feld in einem Listenelement (`bindings[].tool`) blieb grün. Drei Handdateien `tests/vertrag/*.elemente.test.ts` schlossen die Lücke von Hand.

Stand graphVersion 1393: R-32 18, R-26 8, RC-04 23.

## Änderung

- `src/projections/vertragstest.ts`: Die Fälle „Pflichtfeld fehlt“, „falscher Typ“, „Enum außerhalb“ und „unbekanntes Zusatzfeld“ gelten auf jeder Ebene. Der Erzeuger läuft entlang des angenommenen Beispiels und setzt jede Mutation an ihre Stelle ein (`einsetzen`).
  - Objekt in Objekt: Pfad `a.b`, Name `a.b: lehnt ab ohne c`.
  - Liste: Pfad `a[]`, das erste Element wird verändert, die übrigen bleiben gültig; das Beispiel hat mindestens ein Element.
  - Tupel: Pfad `t[i]`, dazu „Tupel zu kurz“. Record: Pfad `r{}`, der Wert wird geprüft.
  - Union: je Variante „nimmt das Beispiel an“ und die Fälle der Variante, Pfad `u (Variante n)`.
  - `optional`, `nullable`, `default`, `pipe`, `lazy`: der Erzeuger geht hindurch.
  - Jede Regel gilt allgemein; keine kennt ein Schema.
- Tiefe und Rekursion: Unter `MAX_EBENE` (8) bildet der Erzeuger keine Fälle und meldet die Stelle. Ein `z.lazy`, das sich selbst enthält, liefert das Beispiel ohne optionale Felder und ohne Listenelemente (`beispiel(…, minimal)`) und meldet es; hat es auch so kein endliches Beispiel, wirft `RekursionsFehler`, der Bericht nennt es als Fehler des SCHEMA. Vorher lief das Beispiel in einen Stapelüberlauf.
- `VertragstestBerichtSchema`: neues Feld `begrenzt` (Liste der Meldungen, leer bei Vertragsdatei). Das SCHEMA und `SCHEMA-vertragstest-bericht` im Modell ziehen im selben CR nach.
- Handdateien: Die drei `*.elemente.test.ts` behalten nur Wertregeln und Grenzfälle (siehe Nachweis). Ihre testRefs bleiben unverändert, die Dateien bleiben am selben TEST.

## Nachweis rot-zuerst

**Unit-Tests des Erzeugers** (`tests/vertragstest.test.ts`, 10 neue Fälle, je ein kleines Schema je Konstrukt): mit dem alten Erzeuger 12 von 28 rot, mit dem neuen 28 grün.

**Mutanten** (Messung `docs/messung/vertragstest-mutanten-cr-gc-980.md`): je Mutante eine Änderung am Quell-Schema, einzeln eingespielt, zurückgenommen. Regeln vor der ersten Zahl: je erste verschachtelte Stelle und je Listenelement Pflichtfeld optional, Feld entfernt, Typ getauscht, Enum geweitet, Elementschema ersetzt (Strukturregeln, 17); dazu 12 Wertregeln (Min, Nonnegative, Int, Positive, leere Liste).

| Art | Mutanten | alter Test rot | neuer Test rot | Handdatei nach dem Kürzen rot |
|---|---|---|---|---|
| Struktur (N, L) | 17 | 8 | 17 | 0 von 17 nötig |
| Wertregel (W) | 12 | 0 | 0 | 12 |

Die Handdateien vorher (24 Fälle, 3 Dateien) fingen 15 von 17 Strukturmutanten; E-N1 (`graphJson.path` optional) und E-L5 (`stubs` als Liste von Zahlen) fingen sie nicht. Die neu erzeugten Tests fangen alle 17, ohne Handdatei.

**Was von Hand bleibt:** Wertregeln, die kein Typ- und Feldfall ableitet: `unfedMutations` 0 abgelehnt, negative Bytes, leerer Pfad und leerer Stub-Pfad, leere Listen angenommen (export-answer, 6 Fälle); leerer Grund bei `unresolved`, negative graphVersion und negatives applied, leere Listen angenommen (test-ingest-answer, 3 Fälle); leere Menge angenommen, negative und gebrochene Zugzahl, leere uid (work-set, 4 Fälle). 13 Fälle, vorher 24. Gelöscht sind die Fälle, die eine Strukturmutante schon im neuen Test fängt.

## Mechanischer Fan-out (Ausnahme zur Dateigrenze, FAQ cr-dateigrenze-ausnahme)

Eigene Dateien: `src/projections/vertragstest.ts`, `tests/vertragstest.test.ts`, drei Handdateien = 5. Dazu die zehn neu erzeugten `tests/vertrag/*.vertrag.test.ts` (Kopf „Nicht von Hand ändern, neu erzeugen“): Ausgabe des Verbs, kein eigener Entwurf, aus derselben Änderung folgend. Ein Teilen ließe den Generator und seine Ausgabe auseinanderlaufen.

Der Lauf `graphcode vertragstest` ohne uids erzeugt auch für 23 weitere SCHEMA mit Zod-Symbol im Repo eine Datei; diese Dateien sind nicht Teil dieses CR (kein TEST-Knoten, kein verify) und wurden verworfen.

## Akzeptanz

- [x] Unit-Tests des Erzeugers: mit dem alten Erzeuger 12 von 28 rot, mit dem neuen 28 grün; `npm run type-check` grün.
- [x] Mutanten: 17 von 17 Strukturmutanten rot mit dem neu erzeugten Test (alt 8 von 17), 12 von 12 Wertmutanten rot mit der gekürzten Handdatei (`docs/messung/vertragstest-mutanten-cr-gc-980.md`).
- [x] Alle zehn `tests/vertrag/*.vertrag.test.ts` neu erzeugt und grün (350 Tests in 16 Dateien). Verworfen: die Fälle „unbekanntes Zusatzfeld“ bei nicht strikten Objekten und „ohne optionales Feld“; `begrenzt` blieb bei allen zehn leer.
- [x] Handdateien auf 13 Wertfälle gekürzt (vorher 24), testRefs unverändert.
- [x] Regeln: R-32 18, R-26 8, RC-04 23 (unverändert; der CR bindet kein SCHEMA).
- [x] `verify:code` grün (70 Dateien, 802 Tests). `verify:full CR-GC-980` grün (255 Dateien, 2368 Tests, rot 0), Schlupf 0, Link-Modus nein.
- [x] Smoke: `node dist/cli.js vertragstest --ziel <temp>` läuft durch und nennt je SCHEMA Ergebnis; `node dist/cli.js status` startet.

---

## Entscheidungen

keine

---

## Umfang laut `graph_impact`

`FUNC-erzeuge-vertragstests` (realRef `erzeugeVertragstests`), `SCHEMA-vertragstest-bericht`; Tests `TEST-vertragstest-generator` und `TEST-vertrag-*` der zehn regenerierten Dateien.
