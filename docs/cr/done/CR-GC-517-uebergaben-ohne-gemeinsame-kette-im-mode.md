# CR-GC-517: Übergaben ohne gemeinsame Kette im Modell korrigieren

**Status:** ✅ Done (2026-09-12)
**Typ:** aus Item ITEM-2026-069 (bug)
**Erstellt:** 2026-09-12
**Item:** bok/items/ITEM-2026-069.json (Lane: graph)
**Folge:** sigloch-modules CR-SM-313 (R-21 scharf stellen)

---

## Befund

44 Übergaben zwischen Funktionen (`FUNC` ─io→ `FLOW` ─io→ `FUNC`) lagen in keiner gemeinsamen Kette. Am Code
eingeordnet: 4 falsche Kanten, 24 Kanten, die eine **gereichte** Abhängigkeit des Aufrufers beschreiben, 15 echte
Übergaben ohne Kette, 1 FLOW an einen zerlegten Block.

**Der mechanische Batch ist verworfen.** Aus der Klassifikation folgen 74 neue `compose`-Kanten; sie hätten `mutate`,
`bootstrap`, `merge-nodes` und `test-ingest` in je elf Ketten gehängt und die Ketten zu Sammelbecken gemacht.
Entscheidung Auftraggeber 2026-09-12: Ein Knoten, der jeder Kette dient, ist **kritisch** — das ist eine Aussage über
ihn, keine Kettenlücke. Die Vorbereitung gehört in die Vorbedingung des Use Case („Graph geladen und geprüft"),
nicht in jede Kette.

## Umsetzung (19 Kommandos, graphVersion 264)

| Klasse | Änderung |
|---|---|
| falsche Kanten | `io cli-command → run-executor` gelöscht, ersetzt durch den neuen FLOW `run-request` (`run-verb` → `run-executor`, Beleg `run-verb.ts:123`) · `io gate-verdict → se-review` und `→ se-status` gelöscht (beide Skill-Dateien nennen `mutate` nirgends) · `io graph-state → gate-client` gelöscht (`bindGateClient` liest über `graph_elements`) |
| Modellfehler | FLOW `measurement-vector` endete am zerlegten Block `goal-steerer`; jetzt an `generation-step` und `next-step` |
| echte Übergaben | `apply-gate` holt `arch-fitness` · `steering-loop` holt `run-verb`, `list-elements`, `fit-advisory`, `target-profile` · `doc-export` holt `list-elements`, `read-tools` · `advisory-roundtrip` holt `target-profile-load` |

## Verifikation

- Gate: tier `suggest`, 0 Fehler, `steerAdvisory` 3,250780 → 3,250772 — die Korrektur bewegt die Kennzahl nicht.
- Offene Übergaben 44 → 31, davon 28 an Infrastruktur (`graph-store` 13, `create-harness` 6, `mutate` 5,
  `cli-dispatch` 3, `load-config` 1).
- Blast-Radius greift sichtbar: `graph_impact(FUNC-list-elements)` nennt jetzt drei Ketten und drei Use Cases;
  `steering-loop` und `doc-export` fehlten vorher.

## Suite

- Volle Suite 137 Dateien, 1092/1092. Der erste Lauf zeigte EINEN Ausfall in `audit.trail-projection` — kein Modellbefund, sondern eine Uncaught Exception `RuntimeError: memory access out of bounds` aus `kuzu-wasm` unter Parallellast. Isoliert läuft die Datei zweimal grün (11/11), sie arbeitet ohnehin auf einem eigenen Temp-Store. Als ITEM-2026-072 erfasst, damit die Zufallsaussage einen Namen hat.

## Bewusst offen

- `cli-dispatch → import-code-verb` und `→ rewind`: der Dispatcher als Mitglied jeder Verb-Kette wäre dieselbe
  Sammelbecken-Logik; der Actor-Eintritt läuft über `cli-command` am Verb selbst.
- `auto-export → export-markdown`: hängt an der Altlast, dass `serve-stdio` in `doc-export` keinen Ausgang hat. Ein
  FLOW `host-boot` wurde gemessen und **verworfen** — er hob die Randbreite von Grounding 13 → 18, Speicherwerk auf 11,
  Betrieb auf 12 und verschlechterte den Steuer-Score um 0,25.
