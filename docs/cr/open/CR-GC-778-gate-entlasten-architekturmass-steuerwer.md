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

## Vom Autor zu entscheiden

1. **Der Satz in `CLAUDE.md`** „measurement … sits below the gate because the gate judges with it" stimmt
   danach nur noch für die Regelauswertung. Soll er geändert werden?
2. **Probelauf:** Soll `graph_mutate` mit `dryRun` die drei Berichte weiter immer liefern (heute so), oder nur
   auf Wunsch? Vorschlag: weiter immer, das ist der Zweck des Probelaufs.
3. **Architekturmaß im echten Schreiben:** Es blockt nicht, wählt nicht und rankt nicht mehr. Soll es beim
   echten Schreiben ganz entfallen und nur im Probelauf und in `graph_metrics` stehen? Das spart je Schreiben
   eine Rechnung über den ganzen Graphen. Vorschlag: ja.

## Erwartete Wirkung auf die Kettenkennzahlen (auf einer Modellkopie gerechnet)

Rückkopplung der Steuerungsschleife von 9 auf 7 Funktionen, der Gate-Kette von 5 auf 3.
