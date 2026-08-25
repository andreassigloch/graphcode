# CR-GC-417 — Der Werkzeugkontext steht in der Gate-Kette

**Status:** done — 2026-08-25 (graphVersion 198)
**Herkunft:** CR-GC-409 §A, Paket „Registry/Kontext" — die Hälfte, die sich
ehrlich schließen lässt.
**Ziel:** R-31 für `FUNC-tool-context` schließen, ohne einen FLOW zu erfinden.

## Befund

`createToolContext` galt im Modell als Einrichtungsschritt des Repo-Lebenszyklus
(`FCHAIN-repo-lifecycle`) und hing an keiner `io`-Kante (R-31). Beides ist eine
Fehlbeschreibung derselben Sache: der Werkzeugkontext ist kein Aufbauschritt,
sondern das Tool-seitige Stück des Apply-Gates. Er hält die einzige Schreibkette,
die OCC-Prüfung, Gate-Aufruf und Audit-Eintrag atomar zusammenhält.

Seine zwei realen Datenübergaben stehen bereits als FLOWs im Graphen — es fehlten
nur die Kanten:

- `recordAudit(consumerId, result: MutateResult, …)` nimmt das Gate-Urteil
  entgegen → `FLOW-gate-verdict`.
- Direkt daneben materialisiert derselbe Aufruf die Trajektorie
  (`materializeTrajectory`, CR-252 — die Projektion entsteht ausdrücklich IM
  Werkzeug-Layer, nicht im Harness) → `FLOW-trajectory`.

Kein neues FLOW, kein neues SCHEMA, keine Code-Änderung: die Verträge
(`SCHEMA-mutate-result`, `SCHEMA-trajectory`) existieren und werden bedient.

## Umfang

**Modell (gate-only, `graph_mutate`)**
- `FCHAIN-repo-lifecycle -compose-> FUNC-tool-context` **entfällt**;
  `FCHAIN-apply-gate -compose-> FUNC-tool-context` tritt an seine Stelle.
  Der Umzug ist die Voraussetzung dafür, dass die Verdrahtung nicht IO-01
  auslöst: im Lebenszyklus teilt der Werkzeugkontext mit keinem Glied einen FLOW,
  im Gate-Ablauf teilt er `FLOW-gate-verdict` mit `FUNC-mutate`.
- `FLOW-gate-verdict -io-> FUNC-tool-context`
- `FUNC-tool-context -io-> FLOW-trajectory`

**Kein Code.** Die Aussage war schon wahr, sie stand nur nicht im Graphen.

## Nicht in diesem CR: `FUNC-bind-tools`

`bindToolsToHarness` bleibt unverdrahtet. Durch eine Kompositionswurzel fließen
keine Daten: sie liefert eine Registry aus Funktionen, und ein SCHEMA darüber
wäre ein Vertrag über Verhalten, kein Datenformat. §A hatte diesen Ausgang
vorgesehen („oder Entscheidung: Infrastruktur-FUNCs ohne io akzeptieren"); die
Entscheidung steht aus und ist keine, die dieser CR treffen kann. Festgehalten in
CR-GC-421.

## Regel-Delta (gemessen)

| Regel | vorher | nachher |
|---|---|---|
| R-31 | 7 | 6 |

Kein neues R-21 (das Paar `mutate → tool-context` teilt jetzt `FCHAIN-apply-gate`,
und die trägt `TEST-mutate-gate`), kein neues IO-01.

## Abnahme

Bestehend: `tests/operations-log.integration.test.ts` und `tests/audit.*` fahren
`recordAudit` gegen echten Disk-Kuzu und prüfen den Log-Eintrag;
`tests/hooks.learning-emit.test.ts` prüft, dass `trajectory.jsonl` genau dort als
Projektion entsteht. Dieser CR behauptet nichts, was dort nicht schon läuft.
