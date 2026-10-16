# CR-GC-813: Modell zeigt Veranlasser statt Aufrufer: Skills und Fluss-Familien an mutate/export ohne Gegenstueck im Code

**Status:** ✅ Done (2026-10-16)
**Typ:** aus Item ITEM-2026-959 (finding)
**Erstellt:** 2026-10-16
**Item:** bok/items/ITEM-2026-959.json (Lane: graph)
**Art:** Modellzug, kein Code

---

## Befund

Das Modell zeichnet, wer eine Änderung *veranlasst*, nicht wer im Code *aufruft*. Mit der Regel „ein FLOW je
Erzeuger" (IO-02) entsteht daraus je Skill ein eigener Fluss direkt in den Kern:

| Ziel | Flüsse im Modell (v760) | Aufrufer im Code |
|---|---|---|
| `mutate` | 22 × `mutate-cmd-*` (14 von Skills) | 4: Werkzeug `graph_mutate` (`src/surface/write.ts:389`), `graph_test_ingest` (`src/projections/testreport.ts:169`), `graph_merge` (`src/kernel/merge.ts:223`), `bootstrap` (`src/surface/bootstrap.ts:119`); dazu der Probelauf in `graph_suggest` (`src/loop/suggest.ts:240`, nur `dryRun`) |
| `exportMarkdown` | 9 × `query-request-*` (6 von View-Skills) | 2: `graph_export` (`src/projections/export.ts:255`), `scripts/export-graph.mjs:73` |
| `computeReadiness`, `chainMetrics`, `evaluateRules` | 12 Flüsse direkt an Skills | Skills lesen über `graph_readiness`, `graph_metrics`, `rules_evaluate`/`rules_get_violations` (laut Skill-Dateien) |

Insgesamt 34 Anschlüsse von Skills an Kern- und Projektions-Interna, die es im Code nicht gibt. Dazu:

- `FLOW-mutate-cmd-agent` führt vom Agenten direkt an `mutate`; `graph_mutate` nimmt nur Format-E
  (`src/surface/import-code-verb.ts:221`).
- Die Werkzeugschicht `graph_mutate` hat keine FUNC; dort entstehen Audit und Trajectory.
- Vier Risiken haben keinen Träger, zwei davon beschreiben Verhalten des Agenten:
  `REQ-risk-skill-instructs-rejected-move`, `REQ-risk-client-holds-stale-tool-list`.

## Lösungsprinzip (Entscheidung Auftraggeber 2026-10-16)

Das Modell zeigt das Lösungsprinzip; ob ein Teil in einem LLM oder in klassischem Code läuft, ist Entwurf.

- **Agent-Ablaufsteuerung ist eine FUNC** — eine Event-Schleife, die Aufträge annimmt, den nächsten Schritt
  wählt und Werkzeuge ruft; nicht deterministisch, wenn ein LLM sie ausführt. Realisierung extern
  (`external: true`, Claude Code / OpenCode).
- **Interpreter-Prinzip (Variante B):** ein Skill ist eine Ablaufbeschreibung. Die Ablaufsteuerung ruft ihn auf,
  erhält die Anleitung und führt sie aus; Werkzeugaufrufe gehen **von der Ablaufsteuerung** aus, ein Fluss je
  Vertrag. Ein Skill schreibt nie selbst.
- **`ACTOR-agent` wird Auftraggeber** (Mensch im Prompt oder Orchestrator): Auftrag hinein, Ergebnis heraus.
- **Testkonzept unverändert, Testdurchführung nicht:** REQ und TEST der Ablaufsteuerung gelten unabhängig von der
  Realisierung; die `testRefs` nennen den Messlauf (Rig/graphanalyze) statt `vitest`.
- Selbstmodellierung ist kein Sonderfall: die Ablaufsteuerung steht im Modell, weil sie zum Lösungsprinzip von
  graphcode gehört.

Verworfen: Skill-Katalog als ein Blatt mit Skills ohne Flüsse (29 dauerhafte R-30/R-31-Warnungen, Ketten
zerfallen am Agenten); Variante A Verteiler+Handler (je Skill eigene Werkzeugflüsse, Kreuzungen nur −9 % innerhalb
der Streuung).

## Zielbild

```
Auftraggeber ─Auftrag─▶ Agent-Ablaufsteuerung ─Skill-Aufruf─▶ Skill X ─Anleitung─▶ Agent-Ablaufsteuerung
Agent-Ablaufsteuerung ─Format-E─▶ graph_mutate ─Format-E─▶ formatEToCommands ─mutate-cmd─▶ mutate
Agent-Ablaufsteuerung ─Sichtauftrag─▶ graph_export ─▶ exportMarkdown
graph_readiness / graph_metrics / rules_* ─Antwort─▶ Agent-Ablaufsteuerung
```

## Umfang

1. Neu: `FUNC-agent-loop` (Agent-Ablaufsteuerung, `external: true`), `FUNC-graph-mutate-tool`
   (`src/surface/write.ts` `bindWriteTools`), `FUNC-rules-tool` (`src/projections/report.ts`, `rules_evaluate` +
   `rules_get_violations`); MOD-Zuordnung und Wertblock je FUNC.
2. `ACTOR-agent`: alle 5 io-Ausgänge und 17 io-Eingänge auf `FUNC-agent-loop` umhängen; Name/Beschreibung
   „Auftraggeber"; neuer Auftrag-/Ergebnisfluss Auftraggeber ⇄ Ablaufsteuerung.
3. Skills (22 + 7 View-Skills): Eingang `skill-request` von der Ablaufsteuerung; je Skill ein Ausgang
   „Anleitung" an die Ablaufsteuerung. Alle übrigen Skill-Flüsse löschen bzw. auf die Ablaufsteuerung umlegen
   (14 `mutate-cmd-*`, 6 `query-request-view-*`, `query-request-render-views`, 6 `skill-report-*`,
   `rendered-views`, 12 Eingänge aus Kern-Interna, rohes `audit-record`).
4. Schreibweg: Ablaufsteuerung → `graph_mutate` → `formatEToCommands` → `mutate`; Host-Socket und import-code an
   `graph_mutate`; `FLOW-mutate-cmd-agent` löschen.
5. Export: Ablaufsteuerung und `registerAutoExport` an `graph_export`, `graph_export` → `exportMarkdown`.
6. Ketten: Ablaufsteuerung als Glied der Ketten, die ein Skill trägt; `FCHAIN-skill-authoring` gegen
   `FCHAIN-apply-gate` prüfen (inhaltlich deckungsgleich nach dem Umbau).
7. Risiken `REQ-risk-skill-instructs-rejected-move`, `REQ-risk-client-holds-stale-tool-list` an die
   Ablaufsteuerung; REQ + TEST der Ablaufsteuerung mit Messlauf als `testRefs`.
8. `REQ-skill-authors-through-gate` (14 Skills) neu fassen: der Skill weist an, die Ablaufsteuerung schreibt durchs
   Gate.
9. **Durchreicher zusammenlegen** (Idee 2): `FUNC-docked-session` geht in `FUNC-host-socket` auf (Merge). Beide Seiten
   liegen in `src/surface/host-shim.ts` (`buildProxyRegistry`, `startHostSocket`), tragen denselben Vertrag und haben
   einen Abnehmer; `FLOW-mutate-cmd-docked-session` entfällt. Der Host-Socket reicht an `graph_mutate` weiter, nicht an
   `mutate`. Nicht zusammengelegt: `takeSteeringSnapshot`/`computeSteeringDelta` und `seedFromJson`/`importGraph`
   (nur gleiche Datei, eigene Verträge).
10. Ketten, die bisher nur über den falschen Fluss `mutate-cmd-agent` an einen Akteur grenzten (FC-04), bekommen die
    Ablaufsteuerung als Glied, Schreibketten dazu Werkzeug und Decoder: `grammar-query`, `interface-escalation`,
    `dashboard-metrics`, `test-ingest`, `capture`, `modelfree-gate`, `live-update`.
11. Tests `tests/skill-authoring-gate.test.ts` und `tests/skill-report-measured.test.ts`: die Grundgesamtheit
    (Kettenglieder in `MOD-agent-surface`) schließt externe FUNCs aus — die Ablaufsteuerung hat keine Skill-Datei.

## Benannte Abweichungen

- `FCHAIN-merge-branches` bleibt ohne Akteur (FC-04): wer `graph_merge` auslöst, ist nicht modelliert; bisher
  verdeckt durch `mutate-cmd-agent`.
- `TEST-agent-loop-executes-skill` ohne `testRefs` (R-19), bis der Messlauf im Rig steht.
- `SCHEMA-skill-text` ohne Vertragstest (R-32): das Format legt der Agent-Host fest (`external`).
- Steuerungsmaß 4,0 → 5,0 (schlechteste Stelle BW-02 an Grounding, 24 Verträge): Verträge mit dem Akteur zählten nicht
  an Blockgrenzen, Verträge mit der Ablaufsteuerung zählen. Es sind dieselben Verträge, jetzt sichtbar. Die
  Ablaufsteuerung steht als fünfte Wurzel neben den vier Wertblöcken (Entscheidung Auftraggeber 2026-10-16); unter
  Betrieb › Bedienung läge das Maß bei 5,25.

## Umsetzung (2026-10-16)

Ein Batch durchs Gate, v760 → v761, ohne neue Fehler. Abnahme: `mutate` hat 7 Eingänge (vorher 24); keine io-Kante
zwischen Skill-FUNC und einer anderen FUNC als der Ablaufsteuerung; Kreuzungen am Export nachgemessen (Tabelle).
CODE-Spur grün (50 Dateien, 439 Tests); Typprüfung grün.

## Nicht in diesem CR

- **Antwort im synchronen Fluss** — verworfen (Auftraggeber 2026-10-16): Rückflüsse bleiben eigene FLOWs. Der
  Antwortvertrag bräuchte eine zusätzliche Kante, das spart im Modell nichts; Aufruf und Antwort als eine Linie
  zu zeigen ist Darstellung (GVE). Die Kreise Ablaufsteuerung ⇄ Werkzeug/Skill sind damit gewollt.
- Skills ohne FUNC (se-umbau, author-actor, Views implplan/nfr/testconcept/testmatrix).
- Darstellung (Netzlabel, Falten) → GVE.

## Umfang laut `graph_impact`

- `ACTOR-agent`: 5 io aus (`formatE-artifact-agent` 1, `mutate-cmd-agent` 2, `query-request-agent` 10,
  `skill-request` 22, `steering-trigger-agent` 1 Abnehmer), 17 io ein (8 Steuerungskanäle, 9 Antworten).
- Skill-REQ: `REQ-skill-authors-through-gate` (14), `REQ-doc-export` (7), `REQ-skill-reads-only` (4),
  `REQ-test-skill-red-first` (2), 7 skill-eigene REQ — `satisfy` bleibt, nur die Flüsse wandern.
- Vor dem Zug: `graph_impact` auf `FUNC-mutate`, `FUNC-export-markdown`, `ACTOR-agent`; `graph_tests` auf die
  geänderten Knoten (Modellspur `verify:model`).

## Messung (Nachbau des Netzes, ELK wie GVE, 8 Seeds, Module als Rahmen)

| | Kreuzungen (Band) | Linien |
|---|---|---|
| v760 | 3691 (3535–3944) | 240 |
| Ziel dieses CR (Prognose) | 2672 (2402–2813) | 246 |
| **umgesetzt, am exportierten SSOT v761** | **2260 (1710–2599)** | **234** |
| zum Vergleich: Antwort im synchronen Fluss (verworfen) | 1229 (1045–1418) | 198 |

Abnahme: Probelauf durchs Gate ohne neue Fehler; Eingänge `mutate` ≤ 7; keine io-Kante zwischen Skill-FUNC und
FUNC außerhalb {Ablaufsteuerung}; Kreuzungen am exportierten SSOT nachgemessen.
