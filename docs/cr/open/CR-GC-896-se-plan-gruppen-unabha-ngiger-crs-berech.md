# CR-GC-896: se-plan: Gruppen unabhängiger CRs berechnen und als Subagenten starten

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1272 (finding)
**Erstellt:** 2026-11-09
**Item:** bok/items/ITEM-2026-1272.json (Lane: code)

---

Befund aus immo-infra, gemessen an den Sitzungsprotokollen: Subagenten liefen nur einmal (2026-11-08) und erst nach der Frage des Nutzers „kannst du nicht parallel implementieren?“. Ein Zug im Subagenten kostete im Schnitt 96 k Token Kontext, in der Hauptsitzung 203 k (2264 Züge, 459 M Cache-Lesetoken).

Root Cause: se-plan §7 erzeugt je CR schon den Auftrag (graph_context-Ausschnitt + 5 Zeilen Prosa). §4 baut aber eine lineare Kette von Meilensteinen und berechnet nicht, welche CRs unabhängig sind. Ohne diese Angabe arbeitet die Sitzung die CRs nacheinander ab.

## Änderung (Skill-Text `.claude/commands/se-plan.md`, ggf. `src/loop/se-plan.ts`)
1. Je Meilenstein Gruppen von CRs bilden, die gleichzeitig laufen dürfen: keine depends-on-Kante zwischen ihnen und keine gemeinsame Datei (aus realRef/allocate der Träger und den Dateien, die `aise dispatch prepare --wurzel` nennt).
2. Die Gruppen als Ausgabe von §8 und als Attribut am MS-Knoten oder als relation, damit se-view:implplan sie zeigt.
3. Neue Anweisung für die Ausführung: die Hauptsitzung koordiniert nur. Sie startet je CR einer Gruppe einen Agenten im eigenen Worktree mit dem CR-Text als Auftrag, führt die Ergebnisse zusammen, schreibt allein in den Graph (Status, commitRef, testRefs) und rollt auf der Zielumgebung nacheinander aus.
4. Agenten schreiben nie in den Graph und rollen nicht aus.

## Akzeptanzkriterien
- se-plan liefert für den Plan von immo-infra (MS-INF-1..) die Gruppen; die Gruppe ist korrekt, wenn kein Paar eine Kante oder Datei teilt (Unit-Test auf der Gruppenbildung).
- se-view:implplan zeigt die Gruppen.
- Die Anweisung zur Ausführung steht in se-plan.md und wird von einem Test festgehalten.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** kein Host in /Users/andreas/Developer/dev/graphcode (keine host.sock).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
