# CR-GC-944: Skilltexte ergänzen: Rest aus CR-GC-942

**Typ:** aus Item ITEM-2026-1371 (finding)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1371.json (Lane: code)

---

**Status:** Geschlossen 2026-11-15, umgesetzt für alle vier Kandidaten (Nr. 6, 10, 12, 16, je ohne den Teilsatz, den der geschlossene CR nicht trägt). Die Freigabe des Autors vom 2026-11-15 für CR-GC-942 gilt für diese vier Zeilen.

## Anlass

CR-GC-942 hat 7 von 13 Kandidaten aufgenommen und 3 abgelehnt. Vier gelten nach dem dortigen Maß als
aufzunehmen, passten aber nicht mehr in die Grenze von 10 Dateien.

## Kandidaten

| Nr | FAQ-Datei, Aussage | Skill | Warum | Offener CR |
|---|---|---|---|---|
| 6 | `fix-template-edit.md` Nr. 4: „Wende einen Vorschlag mit `add-node` … als einen Batch durchs Gate an und ersetze den Platzhalternamen." `vorschlaege-nicht-automatisch.md` Nr. 3: Merge-Vorschlag nicht blind folgen | `se/optimize.md` L42-56 und L104-111 | Der Skill behandelt `retire` als einen Batch, aber weder `add-node` mit Platzhalter noch Merge-Vorschläge von `graph_suggest`. | keiner |
| 10 | `sync-async-bedeutung.md` Nr. 4: „Belege den Wert mit Datei und Zeile im Code; ohne Beleg lass das Merkmal weg." `sync-async-ablage.md` Nr. 1: eine Ablage hat keine Sonderbehandlung | `se-vorbereitung.md` L146-150 | Der Skill fragt den Autor und verweist auf „im Code heißt Ja", verlangt aber keinen Beleg mit Datei und Zeile. | keiner |
| 12 | `req-mit-test.md` Nr. 3: „Lege für ein gelassenes Risiko … einen ungebundenen TEST an, der beschreibt, was ein Nachweis wäre." | `se-fmea.md` L137 | Der Skill lässt ein abgelehntes Risiko im Dokument stehen und schreibt es nicht ins Modell. | keiner |
| 16 | `graph-nutzung-messen.md` Nr. 3 und 4; `bindungsquote-und-deckung.md` Nr. 1; `ergebnis-nur-mit-gegenprobe.md` Nr. 3: Quote nie allein | `se-retro.md` L11, L16, L31 | Der Skill nennt `coveragePct` ohne Gegenzahl (Deckung) und zählt nicht „nur Befehle gegen das Repo". | keiner |

Volle Zitate: `aise-bok/docs/pflege/konflikte-skills-2026-11-15.md`, Tabelle 2.

## Hinweise aus CR-GC-942

- Nr. 16 (`se-retro`): Nur die Gegenzahl zur Quote gehört in den Skill. Die Zählung „nur Befehle gegen das Repo“
  macht `scripts/retro-kpi.mjs`.
- Feste Skill-Versionen in Tests zu `se-vorbereitung` (3 Dateien) und `se-fmea` (2 Dateien) vorher auf
  „mindestens“ umstellen, sonst meldet der Volllauf Schlupf.

## Abnahme

- [x] Je aufgenommenem Satz prüft ein Test sein Schlüsselwort (vorher rot).
- [x] `npm run verify:full CR-GC-944` grün, ohne Schlupf.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Nr. 6, `se/optimize` | Aufgenommen: Zug mit `edit.node` als ein Batch, Platzhaltername ersetzen (Version 10). Nicht aufgenommen: „Merge-Vorschlag nicht blind folgen". | CR-SM-367 trägt `add-node` mit Platzhalter; CR-GC-273 sagt nur „nie auto-apply", der Skill schreibt das schon. |
| Nr. 10, `se-vorbereitung` | Aufgenommen: ohne Beleg mit Datei und Zeile bleibt der Fluss ohne Merkmal; eine Ablage hat keine Sonderbehandlung (Version 11). | CR-GC-789 lässt Flüsse ohne Lesebeleg ohne Merkmal; CR-SM-408 verbietet die Sonderbehandlung. |
| Nr. 12, `se-fmea` | Aufgenommen: zu einem gelassenen Risiko ein ungebundener TEST (Version 14). | CR-GC-802 legt für zwei gelassene Risiken je einen ungebundenen TEST an. |
| Nr. 16, `se-retro` | Aufgenommen: die Bindungsquote steht nie allein, daneben die Deckung (`importCoverage`, gegen `unassigned: []`). Nicht aufgenommen: „nur Befehle gegen das Repo" (Version 8). | CR-GC-542 misst beide getrennt; die Zählung macht `scripts/retro-kpi.mjs`. |

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
