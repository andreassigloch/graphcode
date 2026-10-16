# CR-GC-814: Modell: Recall falsch verdrahtet (seedFromJson an GraphStore statt applyReseed), sieben Wirkketten ohne Ausloeser

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-965 (bug)
**Erstellt:** 2026-10-16
**Item:** bok/items/ITEM-2026-965.json (Lane: graph)

---

## Befund (2026-10-16, aus GVE CR-GVE-368)

Der Kettenfokus in GVE soll nur zeigen, was zum Ausführen des Tasks nötig ist (Auftraggeber). GVE leitet das aus den
io-Flüssen der Kette ab; zwei Modellfehler machen das Bild falsch:

1. **Recall falsch verdrahtet.** Modell: `FUNC-graph-store -> FLOW-graph-state -> FUNC-seed-from-json`,
   `seedFromJson -> FLOW-ontology-json -> importGraph / heldBackTraces`, `importGraph -> GraphStore`; daneben
   `applyReseed -> FLOW-reseeded-graph -> GraphStore`. Im Bild entsteht eine Schleife GraphStore → seedFromJson →
   importGraph → GraphStore neben dem Hauptpfad. Code: `applyReseed` ruft `seedFromJsonFile`, das
   `importOntologyGraph` ruft (`src/kernel/harness-import.ts:227-250`). Richtig ist der Ablauf
   rewind → reseed → applyReseed → seedFromJson → importGraph → GraphStore.
2. **Sieben Wirkketten ohne Auslöser** — sie beginnen am Store statt an einem Akteur bzw. einem auslösenden Fluss:
   merge-branches, dashboard-metrics, snapshot-freshness, loop-closure, impact-testing, interface-escalation,
   generation-states (Messung GVE 2026-10-16 am Live-Modell). Ohne Quelle hat die Kette keinen Anfang.

3. **Sackgassen im Kettenfokus** (GVE CR-GVE-368, live 2026-10-16: Glieder, die keine Senke erreichen): Apply-Gate
   metrics, createHarness, computeFitAdvisory, ownKuzu, createToolContext, zugBericht; Bestand einlesen CLI-Dispatch,
   createHarness, graph_mutate, executeImportCode; Skill berichtet conformanceViolations, computeReadiness,
   computeMarks; Advisory Roundtrip graph_impact, bindReadTools; Repo-Lebenszyklus liveSessions, attachGve;
   Steuerungsschleife computeSteeringDelta; Recall heldBackTraces. Je Glied klären: fehlt der Ausgang im Modell
   (Code-Beleg) oder gehört das Glied nicht in die Kette (compose entfernen).

## Zielbild

- Recall: `applyReseed` liefert an `seedFromJson` (Fluss neu benennen, z. B. reseed-snapshot-path, oder den
  bestehenden verwenden); `FLOW-graph-state -> seedFromJson` nur, wenn es im Code einen solchen Lesezugriff gibt —
  sonst löschen. Wo `seedFromJson` außerhalb von Recall läuft (Boot `mcp-server.ts:111`, `import-code-verb.ts:126`),
  gehört es in die Kette, die den Boot beschreibt, nicht in Recall.
- Je Kette ohne Auslöser: den tatsächlichen Auslöser aus dem Code bestimmen (Akteur, CLI-/MCP-Aufruf, Timer, Hook)
  und als Quelle modellieren; ist keiner da, im CR benennen.
- Abstimmung mit **CR-GC-813** (Veranlasser statt Aufrufer, Agent-Ablaufsteuerung als FUNC): dieselbe Grundfrage
  „welcher Fluss existiert im Code". Erst nach dem Modellzug von 813 beginnen.

## Abnahme

- Jede geänderte Kante mit Code-Beleg (Datei:Zeile) im CR.
- GVE-Fokus Recall: kein Kreis über GraphStore; die sieben Ketten haben eine Quelle (Akteur oder Fluss von außen).
- `rules_evaluate` ohne neue Errors; `npm run verify:model` grün.

---

## Umfang laut `graph_impact`

- `graph_impact` auf FUNC-seed-from-json, FUNC-import, FUNC-apply-reseed, FUNC-graph-store und die sieben FCHAIN
  vor dem Zug. Nur Modell (`docs/graph`, `docs/views`) + CR-Dokument.
