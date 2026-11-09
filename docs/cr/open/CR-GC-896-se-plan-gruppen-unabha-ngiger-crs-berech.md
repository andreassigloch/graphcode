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

## Umfang laut Modell

- `FUNC-cr-groups` (neu, `src/loop/se-plan.ts` `crGroups`) — allocate `MOD-loop`, compose in
  `FCHAIN-doc-export`, io mit `FUNC-export-markdown` ueber `FLOW-cr-groups-request` / `FLOW-cr-groups`
  (SCHEMA `SCHEMA-cr-groups` = Zod `CrGroupsSchema`).
- `FUNC-se-plan` (`.claude/commands/se-plan.md`), `FUNC-export-markdown` (implplan-Ansicht).
- `REQ-plan-gruppen` (neu, unter `UC-code-quality`), verify durch `TEST-se-plan-groups`
  (`tests/se-plan.groups.test.ts`), der auch `SCHEMA-cr-groups` prueft.

## Ergebnis

- `crGroups(graph, crIds)` → `{ groups, cyclic }`. Zwei CRs trennen sich bei einem depends-on-Pfad
  (Voraussetzung in einer frueheren Gruppe) oder einer gemeinsamen `realRef`-Datei (eigene Relationen,
  bei einer REQ die ihrer Traeger). CRs in oder hinter einem Zyklus stehen unter `cyclic`.
- implplan: Spalte *Gruppe* je CR, offene CRs nummeriert, erledigte `—`, Zyklus `Zyklus`.
- Gruppen werden gerechnet, nicht als Attribut am MS gespeichert — eine gespeicherte Kopie liefe
  bei jeder neuen Kante auseinander.
- se-plan Version 9: §8 gibt die Gruppen aus, §10 „Run the plan" — Hauptsitzung koordiniert, je CR
  einer Gruppe ein Agent im eigenen Worktree, nur die Hauptsitzung schreibt den Graph und rollt aus.
- Test: 5 Faelle; ohne den neuen Code alle 5 rot.
- Gegenprobe am Plan von immo-infra (`/Users/andreas/Developer/prod/immo-infra`, Stand heute):
  MS-INF-2 mit 19 offenen CRs → 6 Gruppen (die erste mit 12 CRs); MS-INF-3 (12), -4 (8), -5 (7),
  -6 (3), -7 (5) je eine Gruppe; kein Zyklus. Grenze: Dateien kennt die Rechnung nur ueber `realRef`;
  ein CR, dessen Traeger noch keine `realRef` haben, teilt mit niemandem eine Datei.
- Erster Volllauf rot 2, beide aus diesem CR: RC-08 (SCHEMA an einen TS-Typ gebunden) → `CrGroupsSchema`
  als Zod-Vertrag, den `crGroups` an seiner Rueckgabe parst; `arch.optimization-dry-run.spike` (Messung
  am Repo-Graphen) → neu gemessen und mit Kommentar eingetragen: drei Zuege statt vier, Engpass nach der
  Kette BW-02 @ FUNC-block-abfrage. Weiter derselbe Befund ITEM-2026-798.
- `verify:full CR-GC-896` (zweiter Lauf): 1723/1723 gruen (210 Dateien), Schlupf 0.
