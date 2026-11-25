# CR-GC-1028: Änderungs-Heatmap: Nacharbeit, Themenbreite, Mitänderung über graphcode, SM und GVE

**Typ:** aus Item ITEM-2026-1671 (idea)
**Erstellt:** 2026-11-25
**Item:** bok/items/ITEM-2026-1671.json (Lane: graph)

---

## Ziel

Der Auftraggeber will sehen, wo der Code der Familie wiederholt geändert wird, um dort zu stabilisieren und die Änderungsgeschwindigkeit zu senken. Eine erste Heatmap je Kalenderwoche zeigte vor allem, wann ein Thema bearbeitet wurde. Diese Aussage hilft nicht. Die Messung ersetzt die Zeitachse deshalb durch Größen, die vom Arbeitsplan unabhängig sind.

## Zug

1. `scripts/aenderungs-heatmap.mjs` liest `git log -p` von graphcode, SM und GVE über 6 Monate. Je Einheit (MOD mit Pfad, sonst Verzeichnis), je Datei und je Symbol misst es:
   - **Nacharbeit:** Anteil der geschriebenen Zeilen, die ein anderer CR binnen 14 Tagen wieder umschreibt.
   - **Fix-Anteil:** Anteil der Commits mit Typ `fix:`.
   - **Themenbreite:** Anzahl verschiedener CRs am Ort.
   - **Mitänderung:** Anteil der CRs, die zugleich eine andere Einheit ändern, dazu eine Matrix Einheit × Einheit.
   - **Pareto:** die 10 meistgeänderten Symbole, die es heute noch gibt.
2. `scripts/aenderungs-heatmap.config.json` trägt Repos, Quellpfade, Zeitraum und Frist. Die Rechnung kennt keine Repo-Namen.
3. `scripts/aenderungs-heatmap.html` ist die Vorlage der Seite. Die Ausgabe liegt in `docs/messung/aenderungs-heatmap.html`.
4. `tests/aenderungs-heatmap.test.ts` baut ein Wegwerf-Repo mit 5 datierten Commits. Es prüft die Symbolzuordnung je Zeile, Nacharbeit nur durch einen anderen CR binnen der Frist, die Umbenennung, Mitänderung und das Pareto.
5. Das Modell erhält `FUNC-aenderungs-heatmap` (Teil von `MOD-dev-scripts`), `REQ-aenderungs-hotspots` und `TEST-aenderungs-heatmap`. Alle Änderungen laufen durch das Gate.

Aufruf: `node scripts/aenderungs-heatmap.mjs [--config <json>] [--out <html>] [--json <json>]`.

## Dateien (7)

`scripts/aenderungs-heatmap.mjs`, `scripts/aenderungs-heatmap.config.json`, `scripts/aenderungs-heatmap.html`, `tests/aenderungs-heatmap.test.ts`, `scripts/model-test-set.mjs` (EXCLUDED-Eintrag: der Test nennt `docs/graph/` nur als Pfad eines Wegwerf-Repos), `docs/messung/aenderungs-heatmap.html`, diese Datei.

## Abnahme

- `tests/aenderungs-heatmap.test.ts`: 5 von 5 grün.
- Gegenprobe: Ohne die Bedingung „anderer CR“ werden 2 der 5 Tests rot. Danach ist die Bedingung wieder drin.
- `npm run type-check`: 0 Fehler.
- Lauf auf den echten Repos: graphcode 614, SM 308, GVE 160 Commits seit 2026-05-25, Laufzeit unter 2 s.

## Was die Messung zeigt (Stand 2026-11-25)

- **Nacharbeit:** Am höchsten ist sie in `MOD-loop` mit 26 % der geschriebenen Zeilen, am niedrigsten in `MOD-kernel` mit 5 %.
- **Pareto:** Es führen Versionskonstanten und Registrierungslisten an, die fast jeder CR ändern muss:
  - in SM `RULES_VERSION` (111 Änderungen), `GRAMMAR_SNAPSHOT` (102), `RULE_HELP` (55) und `CLASS_MAP` (36);
  - in graphcode `bindReportTools` (56), `bindWriteTools` (41), `bindSuggestTools` (38) und die Liste `EXCLUDED` in `scripts/model-test-set.mjs` (38).
- **Pareto-Verteilung:** Die 10 meistgeänderten Symbole tragen 9 % aller 5.891 Symboländerungen.

## Offen und benannt

- **CR-Nummer:** Gezählt wird nur die erste CR-Nummer im Commit-Betreff. 380 von 3.546 Datei-Änderungen tragen keine; sie zählen nicht als Nacharbeit.
- **SM und GVE:** Die MODs dort haben meist keinen `path`. Die Einheiten sind dort Verzeichnisse (`packages/<x>`, `src/<x>`).
- **R-30 und R-31 an `FUNC-aenderungs-heatmap`:** Der Eingang ist echt und verdrahtet: Die FUNC liest `FLOW-graph-snapshot-file`. Den Ausgang, die Seite an den Auftraggeber, trägt noch kein FLOW, und keine Wirkkette enthält die FUNC. Dafür bräuchte es ein SCHEMA mit Vertragstest und einen Anwendungsfall. Das ist nach FAQ `func-an-welche-kette` ein eigener CR. Bis dahin bleiben beide Warnungen benannt stehen (FAQ `r31-warnung-bleibt`).
- **R-04 und CR-01 an `MOD-dev-scripts`:** Der gelesene Snapshot zählt als Vertrag über die Modulgrenze zu `MOD-projections`. Die Abhängigkeit besteht im Code wirklich.
- **Lage der Repos:** Die Pfade der Nachbar-Repos sind relativ (`../sigloch-modules`, `../graph-view-edit`). Die Messung läuft nur dort, wo die Familie nebeneinander liegt.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang laut `graph_impact`

Neue Knoten: `FUNC-aenderungs-heatmap` (Kind von `FUNC-block-bedienung`), `REQ-aenderungs-hotspots` (Kind von `REQ-quality-metric`), `TEST-aenderungs-heatmap`. Bestehend berührt: `MOD-dev-scripts` (eine Zuordnung mehr), `FLOW-graph-snapshot-file` (ein Leser mehr). Kein bestehender Knoten verliert eine Kante. Gate: Version 1622, 0 Fehler.
