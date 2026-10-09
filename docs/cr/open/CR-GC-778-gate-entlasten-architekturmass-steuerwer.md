# CR-GC-778: Gate entlasten: Architekturmass, Steuerwert und Dateiliste aus dem Gate in die Schreibschicht

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-809 (idea)
**Erstellt:** 2026-10-09
**Item:** bok/items/ITEM-2026-809.json (Lane: code)

---

## Befund

Das Gate (`src/kernel/gate.ts`) tut nach dem Speichern drei Dinge, die nicht zu „urteilen und speichern"
gehören: Es rechnet das Architekturmaß (`computeFitAdvisory`), den Steuerwert (`computeSteerAdvisory`) und
die Dateiliste zur Modul-Zuordnung (`congruenceWorkOrder`) und hängt alle drei an seine Antwort.

Gefunden über die Wirkkettenanalyse: Die Fit-Bewertung liegt in der Rückkopplung des Gates, und ihr Fluss
zum Gate ist die einzige Kante vom Messwerk zurück in den Kern.

Drei Folgen:

1. **Risiko im Schreibweg.** Die drei Rechnungen laufen nach `store.commit` und vor den Nachlauf-Schritten,
   ohne Schutz. Wirft eine, ist die Änderung gespeichert, der Aufrufer bekommt einen Fehler, und Audit,
   Live-Update und Vorschlag laufen nicht. Aus dem Code gelesen, nicht beobachtet.
2. **Der Kern hängt am Messwerk.** Das Messwerk liest den Store, das Gate ruft das Messwerk: eine
   Abhängigkeit in beide Richtungen zwischen `kernel` und `kernel/measure`.
3. **Jeder Aufrufer zahlt.** Elf Skills, Import, Bootstrap, Test-Rückschreiben und der Host-Socket rufen das
   Gate; die drei Berichte lesen nur zwei Stellen.

## Wer die Berichte liest (gemessen per Suche, 2026-10-09)

| Stelle | liest |
|---|---|
| `src/surface/write.ts` (Werkzeug `graph_mutate`) | alle drei; blendet sie aus, wenn sie nichts sagen |
| `src/loop/suggest.ts` (Werkzeug `graph_suggest`, Probelauf je Vorschlag) | Architekturmaß und Steuerwert |
| Tests | zehn Dateien lesen sie direkt an der Antwort von `harness.mutate` |

Seit der Auslagerung des Executors (CR-GC-775) gibt es keinen dritten Leser mehr.

## Zielbild

Das Gate urteilt und speichert. Die drei Berichte rechnet, wer sie braucht, aus dem Zustand davor und danach.

- Der Zustand davor ist greifbar: Der Store ersetzt beim Übernehmen seine Arbeitskopie
  (`this.graph = candidate` in `src/kernel/graph-store.ts`), eine vorher geholte Referenz bleibt der
  Stand davor. Im Probelauf gilt dasselbe, bis der Aufrufer `loadGraph()` ruft.
- Eine Funktion im Messwerk fasst die drei Rechnungen zusammen (Stand davor, Stand danach, Schwellen →
  drei Berichte). `write.ts` und `suggest.ts` rufen sie nach dem Gate.
- Das Gate importiert das Messwerk nicht mehr.

`MutateResult` aus `@sigloch/contracts` bleibt, wie es ist: Die drei Felder sind eine lokale Erweiterung des
Gates, kein Vertragsfeld. Kein Versionssprung.

## Schritte

1. **Rot zuerst, Risiko belegen:** Test, der eine der drei Rechnungen werfen lässt und zeigt, dass die
   Änderung gespeichert ist, der Aufrufer aber einen Fehler sieht und kein Audit-Eintrag entsteht. Fällt
   er nicht rot aus, stimmt Befund 1 nicht; dann bleibt der Umbau eine Entkopplung ohne Fehlerbehebung.
2. Funktion im Messwerk; `write.ts` und `suggest.ts` stellen um; Gate verliert die drei Aufrufe und Importe.
3. Verhalten am Rand festlegen: Wirft die Messung in der Schreibschicht, bleibt der Zug angewandt und
   gemeldet, und die Antwort nennt, dass der Bericht fehlt. Kein stilles Verschlucken.
4. Modell: der Fluss der Fit-Bewertung geht an die Schreibschicht statt ans Gate; neue Anforderung
   „ein Fehler der Messung lässt den Zug bestehen" mit dem Test aus Schritt 1.
5. `tests/import-boundaries.test.ts`: `kernel` importiert `kernel/measure` nicht mehr — als Sperrklinke aufnehmen,
   falls die Schichtentabelle das hergibt.

## Umfang

Entwurf: `src/kernel/gate.ts`, `src/kernel/harness.ts` (Rückgabetyp), eine Datei im Messwerk,
`src/surface/write.ts`, `src/loop/suggest.ts`, ein neuer Test. Folge: zehn Testdateien, die die Berichte an
`harness.mutate` lesen, stellen auf die neue Funktion um.

## Entschieden (Autor, 2026-10-09)

1. Der Satz in `CLAUDE.md` wird geändert.
2. Probelauf liefert die Berichte weiter immer.
3. Das Architekturmaß entfällt beim echten Schreiben; es steht im Probelauf und in `graph_metrics`.

## Umgesetzt

- **Gate** (`src/kernel/gate.ts`): rechnet keinen Bericht mehr und importiert das Messwerk nicht. Es gibt
  neben dem Urteil den Stand davor und danach heraus; ein geblockter Zug hat kein Paar.
- **Harness** (`src/kernel/harness.ts`): `mutate()` unverändert für alle Aufrufer; neu `mutateWithStates()`
  für die zwei Werkzeuge, die berichten. Das Paar entsteht im serialisierten Schreiben — ein Aufrufer, der
  den Stand davor selbst vorher läse, sähe einen fremden Zug dazwischen.
- **Messwerk** (`src/kernel/measure/zug-bericht.ts`, neu): `zugBericht` und `mitBericht`; der Bericht ist ein
  Zod-Vertrag (`ZugBericht`). Dafür ist die Dateiliste (`WorkOrder`) jetzt ebenfalls ein Zod-Schema.
- **Werkzeuge**: `graph_mutate` (`src/surface/write.ts`) und `graph_suggest` (`src/loop/suggest.ts`) rechnen die
  Berichte aus dem Paar.
- **Texte**: der Freigabe-Prompt und der Skill `se:top-level` sprechen vom Probelauf statt von „jeder Mutation".
- **Modell**: `FUNC-zug-bericht`, zwei Flüsse, ein Vertrag, `REQ-bericht-ist-kein-urteil` mit Test; der Fluss
  der Fit-Bewertung geht nicht mehr ans Gate.

## Was nicht so kam wie angekündigt

1. **Das Risiko „Zug gespeichert, aber als Fehler gemeldet" ließ sich nicht belegen.** Acht Formen von
   Altbestand (falsch typisierte `kinds`, `testRefs`, `realRef`, `status`, `acceptedFindings`,
   `analysisFreshness`, `role`, fehlende Beschreibung) über den Import eingespielt, danach ein gültiger Zug:
   keine der drei Rechnungen warf. Befund 1 oben war aus dem Code gelesen und bleibt unbelegt. Der Umbau ist
   damit eine Entkopplung, keine Fehlerbehebung. Die Absicherung in `zugBericht` (fehlender Bericht statt
   Wurf) ist an einem absichtlich unlesbaren Graph-Stand getestet, nicht an einem echten Fall.
2. **Der Kern importiert das Messwerk weiter**, nur das Gate nicht mehr: `evaluation.ts` braucht den
   Reifegrad, `harness.ts` die Testauswahl, `tool-contract.ts` einen Typ. Die Sperrklinke „Kern importiert
   kein Messwerk" (Schritt 5) ist deshalb nicht möglich; geprüft wird nur das Gate.
3. **Die Rückkopplung der Steuerungsschleife ist nicht kleiner geworden**, sondern um eine Funktion
   gewachsen (9 → 10): Das Vorschlagswerkzeug liest den Bericht und schreibt wieder ans Gate, das schließt
   den Kreis über die neue Funktion. Die Rechnung auf der Modellkopie hatte diese Kante nicht. In der
   Gate-Kette ist die Rückkopplung wie vorhergesagt auf den Kern geschrumpft (5 → 3).

## Tests

- Rot zuerst: `tests/gate.urteilt-und-speichert.test.ts`, neun Fälle.
- Angepasst: `harness.fit-advisory`, `work-order`, `mcp.silent-advisories` (das Architekturmaß wird im
  Probelauf geprüft; neu: beim echten Schreiben steht es nicht).
- Volllauf: 178 von 181 Dateien grün. Rot: die zwei Link-Modus-Tests und
  `tests/arch.optimization-dry-run.spike.test.ts` — die festgeschriebene Autopilot-Messung, die sich mit
  jedem Modellzug verschiebt (heute zum vierten Mal neu festgeschrieben).

## Vorhersage vor dem Bau (auf einer Modellkopie gerechnet)

Rückkopplung der Steuerungsschleife von 9 auf 7 Funktionen, der Gate-Kette von 5 auf 3. Eingetreten ist
nur das Zweite, siehe oben.
