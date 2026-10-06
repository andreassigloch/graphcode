# CR-GC-749: Der Schritt wählt nach Stufe — früheste zuerst; der Kaltstart kommt aus den Existenz-Regeln R-33 und R-17

**Status:** ✅ Done (2026-10-06)
**Typ:** aus Item ITEM-2026-762 (idea)
**Erstellt:** 2026-10-06
**Item:** bok/items/ITEM-2026-762.json (Lane: code)
**Deckt:** sigloch-modules CR-SM-395 §6 (Nachzug graphcode), Entwurf `docs/graphcode_regelmatrix_entwurf.md` §1.3, §5, §8.3.
**Schnitt:** Teil 2 von 3 (Teil 1: CR-GC-748, Teil 3: CR-GC-750, 751, 752). 8 Dateien: 1 Quelldatei, 1 Skript, 6 Testdateien.

---

## Befund

`generationStep` wählte die schwächste Readiness-Dimension und darin die Regel. Gemessen am Referenzlauf `lokal`
sprang die Fensterfolge damit zwischen den Stufen: 3, 2, 7, 7, 6, 8, 10. Daneben standen drei eigene Zustandstests
für den Kaltstart (kein SYS, kein UC, kein ACTOR) — dieselbe Frage, die seit contracts 11 eine Existenz-Regel
beantwortet.

## Umsetzung — `src/loop/generate.ts`

**Reihenfolge der Fenster.** Je Regel ein Schlüssel, in dieser Ordnung:

1. im Arbeitsschritt: sein Eintrittspunkt zuerst (unverändert, CR-GC-603);
2. **Stufe der Regel** (`ALL_RULE_DEFS[].stage`), früheste zuerst — `stufenRang`;
3. in einer Stufe die **Existenz-Regel** vor den übrigen (`role === 'existence'`);
4. darunter die bisherige Ordnung, unverändert: schwächste Dimension, Schwere, Klausel vor bloßem Fund, Regel-ID.

Es bleibt bei einer Regel und höchstens drei Elementen je Schritt, bei `focusKey`, `defer` und `stalled`.
Der Prompt nennt statt „Schwächste Dimension: uc." die Stufe beim Namen ihrer Menge: „Stufe: Anwendungsfall."
Kein zusätzlicher Zug, keine zusätzliche Zahl.

Zwei Festlegungen, die der Auftrag nicht vorgab:
- **`immer` (R-08, R-18, CR-R03) steht vor Stufe 1.** Eine Regel über alle Elemente gilt an jeder Stufe, also
  schon an der ersten. Folge: ein Grammatikfehler ist das erste Fenster — vorher stand er in der Dimension `arch`.
- **Existenz zuerst innerhalb der Stufe.** Ohne das stünde an einem Graphen mit nur einem SYS der Eintrittspunkt
  des Einsatzkonzepts (AF-01, Stufe 2) vor „das System hat nichts unter sich" (R-17, Stufe 2): beide Dimensionen
  sind dort nicht messbar, und `req` sortiert vor `uc`. Der Kaltstart wäre gekippt.

**Kaltstart.** `SEED_RULE = { sys: 'R-33', uc: 'R-17', actor: 'UC-02' }`.

| Stufe | Auslöser bisher | Auslöser jetzt | Text |
|---|---|---|---|
| `seed:sys` | kein SYS im Graphen | R-33 meldet (aus dem Kern-Fokus gelesen, gilt in jedem Arbeitsschritt) | unverändert |
| `seed:uc` | SYS, keine Struktur, kein UC | R-17 stellt das Fenster, keine Struktur | unverändert |
| `seed:actor` | SYS, UC, keine Struktur, kein ACTOR | UC-02 stellt das Fenster, keine Struktur, kein ACTOR im Bestand | unverändert |

Form des Schritts unverändert (`phase: 'seed'`, `focusDimension: 'seed:*'`, `focusKey: null`) — Executor
(`seedPhase`), `next-step.ts` (Satz je Kaltstart-Stufe) und `delegate.ts` lesen sie wie zuvor.

Das ist der **kleinere Schritt**: der Auslöser kommt aus der Regel, die Texte sind als Kaltstart-Fassung der
Regel geblieben. Nicht gebaut, weil es das Verhalten für den Agenten ändert: die drei Stufen als gewöhnliche
Fenster mit `focusKey` (dann griffe das Zurückstellen nach zwei Zügen auch im Kaltstart, und der Prompt trüge die
Fund-Zeile). Zwei Blicke in den Bestand bleiben deshalb stehen:
- „keine Struktur" (kein FUNC, kein MOD) unterscheidet Kaltstart von Rückwärts-Spezifikation — mit Struktur stellt
  dieselbe Regel ihr gewöhnliches Fenster;
- „kein ACTOR" wählt die Fassung von UC-02: bloße Akteure zuerst (CR-GC-559) oder das Skelett mit Anbindung
  (ITEM-2026-625). Die Klausel von UC-02 liest den Bestand an derselben Stelle schon.

## Was sich für den Agenten ändert

| Zustand | bisher | jetzt |
|---|---|---|
| leer → SYS → UCs → Akteure | `seed:sys` → `seed:uc` → `seed:actor` | dasselbe |
| danach (SYS, UCs unter dem System, ein Akteur; Host) | UC-01 → UC-02 → FC-02 → … | UC-02 → FC-02 → R-16 → AF-01 → UC-01 → UC-03 → AF-03 → AF-02 → AF-04 |
| derselbe Zustand, Treiber (Executor) | UC-01 → UC-02 → FC-02 → … | UC-02 → FC-02 → R-16 → UC-01 → UC-03 |
| Graph mit Grammatikfehler | Fehler innerhalb seiner Dimension | Fehler zuerst |
| ein offener Auftrag (Referenz `frontier`) | Bindungsbefunde nicht im Kern | nach allem davor: CR-R03 → FM-03 → R-19 → R-20 → R-26 |
| SYS mit einer Anforderung darunter, kein UC | `seed:uc` | kein `seed:uc` — R-17 schweigt (CR-SM-395 §10.5) |
| SYS und ein UC, der nicht am System hängt | `seed:actor` | dasselbe (UC-02 trägt eine Klausel und steht in der Stufe vor R-17) |

Die zweite Zeile ist die eigentliche Änderung der Modellierstufe: das Skelett aus UC-02 (Akteur, Datenfluss,
Vertrag, Funktion, Kette) kommt vor den Anforderungen aus UC-01, und der Eintrittspunkt des Einsatzkonzepts
(AF-01, Stufe 2) steht vor UC-01 (Stufe 3). Beides folgt aus der Stufe am Katalog; eine andere Stufe dort wirkt
hier ohne Codeänderung. **Nicht gemessen:** kein Rig-Lauf mit einem Modell; belegt ist die Reihenfolge an den
Graphen der Referenzläufe und an Fixtures.

## Tests

**Rot zuerst:** `tests/generate.stufen.test.ts` gegen den Stand von CR-GC-748 (alte Ordnung): 11 von 23 rot —
u. a. erstes Fenster an Stufe 3 statt 2 (`lokal`), 9 statt 0 (`frontier`), 9 statt 5 (Golden), Fensterfolge nicht
nach Stufe geordnet, `seed:actor` statt `seed:uc` bei meldender R-17, `seed:uc` bei schweigender R-17.

| Datei | |
|---|---|
| `generate.stufen` | **neu**, 23 Fälle. Eigenschaften über beide Referenzläufe und das Golden: erstes Fenster an der frühesten Stufe; Fensterfolge nach Stufe geordnet; Existenz-Regel vorn; ein Fenster = eine Regel, ≤ 3 Elemente; offener Auftrag → Bindungsbefunde nach allem davor. Kaltstart: leerer Graph → R-33 → SYS-Wurzel; Elemente ohne System; `seed:uc` nur bei meldender R-17 (vier Fälle, lesen die Regel statt einen Zustand); `seed:actor`; mit Akteur oder Struktur das gewöhnliche Fenster; Kaltstart des Systems auch im Arbeitsschritt. |
| `generate` | sechs Fälle suchen ihr Fenster jetzt über `bisRegel(…)` statt „das erste ist UC-01, das zweite UC-02"; der Fall „erst wenn kein Klausel-Fenster mehr offen ist" umgeschrieben auf „in einer Stufe steht die Klausel-Regel vorn". |
| `steering.process-ratchet` | der Lauf des Skript-Aktors endet benannt an R-31 statt R-21 (Begründung im Test); neu: die Runden laufen die Stufen vorwärts, die Fehlerzahl fällt auf 0. |
| `fixtures/steering-graphs` | Skript-Aktor: Reparatur für „Datenfluss ohne Vertrag" unter R-18/R-34, für R-30. |
| `channel-rank` | die Klausel wird mit dem Bestand verglichen (das erste Fenster stellt jetzt UC-02). |
| `mcp.mutate-next-step` | **Fehler im Test aufgedeckt:** die Hebung des flachen Exports ließ `kinds` fallen; an jeder `satisfy`-Kante meldete R-18. Die Fehler standen bisher in einer späteren Dimension und fielen nicht auf. Hebung berichtigt. |

`scripts/model-test-set.mjs`: die neue Datei mit Grund aus der Modell-Spur ausgeschlossen (liest Rig-Graphen,
nie graphcodes SSOT).

### Tests, die einen im Katalog strittigen Wert festschreiben (CR-SM-395 §10)

Keiner in diesem CR: die Kaltstart-Fälle fragen, ob die Regel meldet, und verlangen die Gleichheit. Der benannte
Endpunkt R-31 im Ratschen-Test hängt an der Stufe von R-31 (6) und R-21 (9).

## Offen

1. **AF-01 vor UC-01.** Die Stufe 2 des Einsatzkonzepts stellt seinen Eintrittspunkt vor die Anforderungen. Im
   Host-Weg nennt der Schritt dann den Task `conops`, bevor es eine Anforderung gibt. Gewollt?
2. **`immer` vor Stufe 1** — auch für CR-R03 (Warnung). An der Referenz `frontier` ist sie das erste Fenster.
3. **R-17 verlangt keinen Anwendungsfall** (CR-SM-395 §10.5): ein System mit einer Anforderung darunter bekommt
   keinen Schritt „Anwendungsfälle" mehr.
4. **Modell-Zug.** Die Beschreibung von `FUNC-generation-step` nennt die schwächste Dimension als Auswahl; der
   laufende Host war tabu.

## Umfang laut `graph_impact`

Nicht gelaufen (laufender Host tabu). Leser von `phase`, `focusDimension`, `focusKey` über `git grep` geprüft:
`executor.ts`, `executor-bestofn.ts`, `executor-rank.ts`, `next-step.ts`, `delegate.ts` — Form unverändert.

## Verifikation

- `npm run build` grün.
- `npm run verify:full CR-GC-749` (Zeile in `docs/messung/testauswahl.jsonl`): 203 Dateien, 3 rot —
  `tests/lockfile-sync.test.ts`, `tests/distribution.test.ts` (Link-Modus, erwartet), `tests/conformance.test.ts`
  (1 Fall, Modell-Zug aus CR-GC-748). Spur VOLL (`tests/fixtures/steering-graphs.ts` hat keinen Knoten im
  Modell), damit kein Schlupf messbar; die Folge ohne Schlupf zählt diesen CR nicht.
