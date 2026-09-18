# CR-GC-550: se-plan leitet über REQ ab, nicht über FUNC-Blätter

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-302 (finding)
**Erstellt:** 2026-09-18
**Item:** bok/items/ITEM-2026-302.json (Lane: code)
**Messgrundlage:** `bok/docs/research/fremdlauf-sigllm-2026-09.md` §8.1, §12

---

## Befund

`se-plan` nennt in §3/§5 den **FUNC** als die Einheit, die ein Bauauftrag realisiert („the FUNC +
the REQ it `satisfy`s …", „realize this ONE node"). Die Ontologie kennt aber **vier** Träger für
ein REQ — RD-01 akzeptiert `satisfy` von FUNC, FCHAIN, MOD und SYS. Zwei Komponenten sind sich
uneinig, was „realisiert" heißt, und der Plan sieht nur einen Vierteil davon.

Gemessen am ersten Fremdlauf (sigllm): 64 Blatt-REQ, davon getragen von FUNC 32, MOD 20, FCHAIN 7,
SYS 5. Der Plan CR-SL-034 leitete 22 Bauaufträge aus 20 FUNC-Blättern ab und meldete **„20 von 20
geordnet, keine Zyklen"** — eine Vollständigkeitsaussage über die Menge, die er selbst gewählt
hatte. Im selben Graphstand hatten 40 von 64 Blatt-REQ einen Bauauftrag. Die 32 an MOD/FCHAIN/SYS
fielen durch, und genau sie mildern alle 16 offenen FM-03-Risiken: FM-03 stand deshalb 151 Züge
lang unverändert auf 16. Der Ergänzungsplan CR-SL-050 zog 17 Aufträge von Hand nach.

Das ist kein Ordnungsfehler. Die topologische Sortierung war korrekt. Falsch ist die **Auswahl der
Grundmenge**.

## Zielbild

1. **Die Ableitungsmenge sind Blatt-REQ**, nicht FUNC-Blätter. Je REQ wird sein Träger bestimmt;
   der Schnitt des Bauauftrags bleibt am Träger (Kontext-Slice wie bisher), die **Vollständigkeit
   zählt über REQ**.
2. **Ein Auftrag für ein REQ an einem MOD- oder SYS-Träger trägt seine `relation` direkt auf das
   REQ** — nicht nur auf das Modul. Das ist die Konvention, die CR-SM-343 prüft; weicht sie ab,
   sind es wieder zwei Wahrheiten.
3. **Die Reihenfolge bleibt unverändert** topologisch über `depends-on`. Dieser CR fasst
   `deriveImplPlan`s Sortierung nicht an.
4. **`se-plan` schließt mit einer gerechneten Zusicherung**, nicht mit einem Satz: *n von m
   Blatt-REQ haben einen Bauauftrag; die ungedeckten heißen …*. Keine leere Liste ⇒ der Plan ist
   nicht fertig, und das steht in der Ausgabe.
5. Die Rechnung lebt **im Kern, nicht im Skill-Text** — `deriveImplPlan` liefert sie mit, damit ein
   Test sie festnagelt und der nächste Skill-Umbau sie nicht verliert.

## Umfang — 3 Dateien

| Datei | Änderung |
|---|---|
| `src/loop/se-plan.ts` | `ImplPlanResult` um `reqCoverage: { leaf: string[]; covered: string[]; uncovered: string[] }`; Deckung nach der Definition aus CR-SM-343 (direkt, oder über FUNC/FCHAIN-Träger — MOD/SYS zählen nicht) |
| `tests/se-plan.ordering.test.ts` | die vier Fälle unten; Datei bleibt der eine Pin für den Kern |
| `.claude/commands/se-plan.md` | §1 (Lesemenge: REQ führt), §3 (Einheit ist das REQ, Schnitt am Träger, direkte CR→REQ-Kante bei MOD/SYS), §6 (Zusicherung als Pflichtausgabe) |

Der scaffold-Pfad (`src/surface/scaffold-templates.ts`) verteilt `.claude/commands/` unverändert —
prüfen, ob eine Versionsangabe der Skill-Datei mitzuziehen ist (`version: 3` im Frontmatter → 4).
Falls ja, ist das die vierte Datei und der CR bleibt unter der Sechs-Dateien-Grenze.

## Akzeptanzkriterien

1. **Alle vier Träger kommen vor.** Fixture mit je einem REQ an FUNC, FCHAIN, MOD und SYS: der Plan
   nennt vier Bauaufträge, nicht einen.
2. **`reqCoverage.uncovered` ist nicht leer, solange ein Blatt-REQ keinen Auftrag hat** — und der
   Test prüft den Fall MOD-Träger mit CR auf dem Modul: der bleibt **ungedeckt**, bis die direkte
   CR→REQ-Kante steht.
3. **Nicht-Blatt-REQ zählen nicht** (compose→REQ-Kinder tragen die Deckung), gleiche Grundgesamtheit
   wie RD-01 und CR-SM-343.
4. **Regression:** `order`, `cycles`, `forwardViolations` bleiben bitgleich zu heute — der
   bestehende Ordnungstest läuft unverändert grün.
5. **Nachgerechnet am echten Lauf:** der CR nennt vor dem Schließen die Deckungszahl, die
   `reqCoverage` am sigllm-Graphstand v99 liefert. Erwartet 40 von 64 — trifft sie nicht, ist die
   Definition anders als gemessen und der CR schließt nicht.
6. `npm run build` und `npm test` in graphcode grün.

## Abgrenzung

Dieser CR ist der **einmalige Schnitt** — er sorgt dafür, dass ein Plan vollständig entsteht.
Die **laufende** Absicherung, damit er es auch bleibt und in jedem Repo gilt, ist **CR-SM-343**
(contracts, Regel + Readiness-Zeile). Ein Prüfschritt, der aufgerufen werden muss, wird genau dann
übersprungen, wenn er zählt: im Fremdlauf 28 Vorschau-Aufrufe in der Spezifikation, **0** in der
Bauphase. Deshalb beide, nicht einer.

`se-view:implplan` bleibt unberührt — es rendert einen Plan, es erzeugt keinen. Kein zweiter
Renderer.
