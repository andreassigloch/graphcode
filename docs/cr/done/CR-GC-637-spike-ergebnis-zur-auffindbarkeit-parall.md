# CR-GC-637: Spike — parallele Pfade sind nicht aehnlich, sie teilen einen Engpass

**Status:** ✅ Done (2026-09-23)
**Typ:** aus Item ITEM-2026-522 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-522.json (Lane: code)

---

## Frage

CR-GC-634 hat behauptet, man finde parallele Pfade nicht an der Aehnlichkeit, sondern am
gemeinsamen Engpass — belegt an **einem** Paar. Ein Paar ist eine Anekdote. Dieser Spike prueft
es an sieben belegten Paaren aus vier CR-Jahrgaengen und zwei Repos.

`scripts/spike-engpass-known-answer.mjs`, Bauart wie `spike-nd-known-answer.mjs` (CR-GC-542):
Known-Answer-Set, jedes Paar mit CR und Commit, gemessen am Stand **vor** dem Fix, Ergebnis sind
Zahlen.

## Das Set

| | CR | Art | A ↔ B |
|---|---|---|---|
| P1 | CR-SM-331 | Duplikat | contracts `serializeToFormatE` ↔ graph-api-core `serialize` |
| P2 | CR-GC-536 | Duplikat | graphcode `encode` ↔ graph-api-core `serialize` (Repo-Grenze) |
| P3 | CR-SM-335 | Duplikat | `functionCriticality` ↔ `fchainMustHaveIntegrationTest` |
| P4 | CR-GC-531 | zweite Pruefung | `codec.validate` ↔ contracts `traceRejection` |
| P5 | CR-SM-336 | zweite Tuer | Express `registerRoutes` ↔ `GraphService.mutate` |
| P6 | CR-GC-630 | zweiter Weg | `bootstrap` ↔ `formatEToCommands` |
| P7 | CR-GC-632 | zweiter Leser | Testhelfer `knotenAus` ↔ `formatEToCommands` |
| K1 | CR-GC-488 | Kontrolle, zeichengleich | `jaccard` ↔ `jaccard` |
| K2 | — | Kontrolle, fremd | `formatEToCommands` ↔ `impactedTests` |

## Ergebnis

### 1. Aehnlichkeit: 0 von 7

| | Name-Jaccard | Rumpf-Jaccard |
|---|---:|---:|
| P1…P7 | **0,000 in allen sieben** | 0,026 – 0,414 |
| K1 (zeichengleich) | 1,000 | 0,867 |

Kein einziges echtes Paar erreicht die ND-Schwelle 0,85. Die Kontrolle K1 tut es — das Mass ist
also intakt, es misst nur das Falsche. **Der Name traegt in keinem der sieben Faelle ein
gemeinsames Token.**

Das ist kein Schwellenproblem. Ein zweiter Pfad ist dem ersten nie aehnlich: er ist kuerzer
(16 gegen 183 Zeilen bei P7), anders benannt und kann weniger — das ist der Grund, warum ihn
jemand schreibt.

### 2. Gemeinsamer Engpass: 6 von 7 — aber auf DATEI-Ebene

| Ebene | Treffer |
|---|---:|
| Symbol (nur die beiden Rumpfe) | 2 von 7 |
| Datei (die beiden Dateien) | **6 von 7** |

Die Symbolebene ist blind, und P7 zeigt warum: `knotenAus` fasst den Engpass **nicht selbst** an
— es rief ein lokales `operationen()`, und erst das rief `FORMAT_E_CODEC.parse`. Eine
Indirektion genuegt. Der duplizierende Rumpf beruehrt die geteilte Ressource typischerweise
nicht direkt.

Die gefundenen Engpaesse: `attributeTypeOf`(4) · `FormatECodec`(15) · `functionCriticality`(6) ·
`GraphService`(18) · `MutateResult`(20) · `FORMAT_E_CODEC`(6).

**P4 faellt durch** — und die Luecke ist lehrreich: der geteilte Engpass ist dort kein
importiertes Symbol, sondern ein **Datenfeld**, `SE_DESCRIPTOR.edgeTypes[...].validPairs`. Wer
nur Importe zaehlt, sieht ihn nicht.

### 3. Als Detektor unbrauchbar — das Rauschen

Ueber alle 5.050 Dateipaare in `graphcode/src`:

| Alarmschwelle (Rang ≤) | Paare | Anteil |
|---:|---:|---:|
| 3 | 219 | 4,3 % |
| 5 | 335 | 6,6 % |
| 10 | 622 | 12,3 % |
| **20** | **1.175** | **23,3 %** |

Die echten Paare liegen bei Rang 4–20. Eine Schwelle, die sie faengt, faengt **fast jedes vierte
Dateipaar**. Recall 6/7 bei 23 % Fehlalarm ist kein Detektor.

### 4. Die Umkehrung — und die ist brauchbar

Nicht Paare ranken, sondern **Engpaesse**. Ein Engpass = ein WERT (kein Typ) mit wenigen
Anfassern, davon mindestens **zwei per Import**:

**96 Kandidaten aus 5.805 Bezeichnern.** Eine Seite Liste statt 1.175 Paare — und die drei, die
in diesem Umbau zaehlten, stehen darin: `FORMAT_E_CODEC`, `FormatECodec`, `formatEToCommands`.

(Erster Versuch war „2–4 Anfasser, mindestens ein Import" → 316 Kandidaten, unlesbar. Rang 2
heisst meistens „hier definiert, dort einmal benutzt". Erst zwei Importeure machen eine Tuer.)

## Schluss

**Aehnlichkeit ist fuer diese Fehlerklasse das falsche Werkzeug — mit Zahlen, nicht als Meinung.**
ND-01/ND-02 bleiben richtig fuer das, wofuer sie da sind (Copy-Paste, semantische Dubletten im
Modell); sie werden hier nicht angefasst und brauchen keine andere Schwelle.

Der brauchbare Weg ist der aus CR-GC-634, und dieser Spike liefert ihm den Vorrat: **keine
Suche, sondern eine Ratsche ueber benannte Tueren.** Die Liste der 96 Kandidaten ist der
Eingang fuer `tests/engpass-ein-leser.test.ts` — heute stehen zwei darin.

**Offen, benannt:** P4 zeigt, dass ein Engpass auch ein Datenfeld sein kann. Die Kandidatenliste
sieht nur Importe. Wer `SE_DESCRIPTOR.edgeTypes` als Tuer fuehren will, muss Feldzugriffe
mitzaehlen — ITEM-2026-522 nennt es, dieser CR loest es nicht.
