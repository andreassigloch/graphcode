# CR-GC-874: FC-06 am eigenen Modell richten: ein Einsprung für MCP und CLI, Vorab-Lieferung als Datei

**Status:** ✅ Done (2026-10-28)
**Typ:** aus Item ITEM-2026-1109 (finding)
**Erstellt:** 2026-10-28
**Item:** bok/items/ITEM-2026-1109.json (Lane: graph)

---

FC-06 meldet am eigenen Modell (v973) Ketten mit mehreren Auslösern, ohne Auslöser und mit Vorab-Lieferung. Entscheidung Andreas 2026-10-28: (1) MCP und CLI nutzen denselben Einsprung (src/cli.ts main = FUNC-cli-dispatch) → eine Kette; der Agent (FUNC-agent-loop und die Skill-Funktionen) ist Aufrufer, kein Glied von host-start/model-import. (2) Ein Akteur, der nur vorab liefert, ist kein Akteur: die Funktion holt die Daten selbst (Datei/Speicher) — FLOW-config-file und die async-Kanäle des Regelhalters (channel-dimension-template, channel-gate-protocol, channel-rule-clause, version-bump) werden zu gelesenen Dateien/Speichern. (3) Herunterfahren (session-end) und Schema-Guard sind eigene Ketten (se:top-level Regel 4). Ziel: FC-06 am eigenen Modell 0 Befunde oder je Rest eine benannte Entscheidung; docked-session (Agent vs. Dashboard an verschiedenen Knoten) und verify-lane (ein CLI-Fluss an zwei Gliedern) mit klären.

---

## Umfang

Reine Modellarbeit am Selbstmodell (Graphversion 975 vor, 981 nach; die Versionen 977 bis 981 enthalten auch Schritte der Nachbarsitzung und der Testläufe, ihre Moves stehen unten). Kein Code geändert. Schreibweg: `graph_mutate` des graphcode-Hosts, danach `graph_export`.

Geprüft am Code:

- `src/cli.ts` `main` ruft für `mcp` `serveStdio` und für `import-code` `executeImportCode`. Beide laufen durch `FUNC-cli-dispatch`. Der Agent startet beide Verben über die Schale; er ruft `main`, er ist kein Glied.
- `src/kernel/config.ts` `loadGraphcodeConfig` liest `graphcode.config.jsonc` selbst (`readFileSync`). Die Datei liefert nichts vorab.
- `GATE_PROTOCOL`, `RULE_CLAUSE` und `GENERATION_TEMPLATE` sind Konstanten in `src/loop/generate.ts`; `generationStep` liest sie, niemand reicht sie.
- `src/kernel/schema-guard.ts` bildet den Fingerabdruck aus dem Descriptor, den `open` reicht, und liest den Marker selbst; die Kopfzeile sagt: keine Versionspflege von Hand.
- `src/surface/upgrade.ts` `executeUpgrade` liest `owner.lock` mit `existsSync`/`readFileSync`. Es ruft `StoreLock` nicht.
- `src/surface/audit.ts`: `audit_trail` und `audit_stats` rufen `await auditLog.query(...)` auf dem Log, das `createToolContext` hält.
- `scripts/verify-code.mjs` und `scripts/verify-full.mjs` sind zwei npm-Skripte; keines ruft das andere.
- `src/surface/host-shim.ts`: der Stellvertreter einer angedockten Sitzung (`buildProxyRegistry`) und das Dashboard rufen beide `callHost` gegen `startHostSocket`.

## Umsetzung (Modell-Züge)

1. **Vorab-Lieferung des Regelhalters entfällt (Entscheidung 2).** Gelöscht: `FLOW-config-file`, `FLOW-channel-dimension-template`, `FLOW-channel-gate-protocol`, `FLOW-channel-rule-clause`, `FLOW-version-bump` und `ACTOR-regelhalter` (danach ohne io-Kante, löst nichts aus, empfängt nichts). `FUNC-load-config`, `FUNC-generation-step` und `FUNC-schema-guard` nennen in der Beschreibung, was sie selbst lesen. Eine Datei ohne schreibende Funktion und eine Konstante sind im Modell keine Flüsse; ein Speicher-Fluss wie `FLOW-store-load` setzt eine FUNC voraus, die den Speicher hält.
2. **Ein Einsprung für MCP und CLI (Entscheidung 1).** `FUNC-agent-loop` aus `FCHAIN-host-start` und `FCHAIN-model-import` entfernt, ebenso `FUNC-import-code` und `FUNC-import-doc` aus `FCHAIN-model-import`. `FUNC-import-doc` hängt jetzt an `FCHAIN-skill-authoring` (schreibt durchs Gate, der Test `skill-authoring-gate` bleibt grün). `FUNC-import-code` hat keine Kette (siehe offene Fragen).
3. **Herunterfahren eigene Kette (Entscheidung 3).** `FUNC-session-shutdown` aus `FCHAIN-host-start` entfernt; `FCHAIN-session-end` besteht schon. `FUNC-schema-guard` bleibt Glied von `host-start` und `http-host`: `open` ruft ihn beim Start. Mit `FLOW-version-bump` ist sein zweiter Einstieg weg; `FCHAIN-schema-migration` besteht schon.
4. **verify-lane zwei Ketten (Entscheidung 4).** Zwei Skripte, zwei Einstiege. Neu `FCHAIN-verify-lane-full` (unter `UC-efficient-testing`, `satisfy REQ-risk-selection-misses-red-test`) mit `FUNC-verify-lane-full` und `FUNC-measure-test-schlupf`. `FCHAIN-verify-lane` behält `FUNC-verify-lane-code`, Name und Beschreibung benennen jetzt `verify:code`.
5. **loop-closure (Entscheidung 5).** `FLOW-audit-record` von `async` auf `sync`: die Werkzeuge holen den Eintrag über `auditLog.query` und warten. `FUNC-tool-context` ist damit erreichbar.
6. **repo-lifecycle (Entscheidung 5).** `FUNC-claim-store-lock` aus der Kette entfernt. `upgrade` liest die Datei selbst; der Fluss `FLOW-lock-file` bleibt als Fluss zwischen den Funktionen im Modell.
7. **CR-Umfang:** `CR-GC-874 -relation->` auf die berührten FUNC.

Tests neu verankert: `tests/channel-model.test.ts` verlangt 7 statt 10 Kanäle (drei entfallen). `tests/arch.optimization-dry-run.spike.test.ts`: der abgelehnte Merge-Vorschlag wandert von `FLOW-channel-gate-protocol` (gelöscht) auf `FLOW-channel-next-step`/`-handoff`; dazu `R-30 @ FUNC-import-code` als abgelehnter Zug.

## Messung

FC-06 (contracts-Arbeitskopie, `fc06OneTrigger` über `docs/graph/graphcode.graph.json`):

| Kette | vorher | nachher |
|---|---|---|
| dashboard-metrics | triggers-disagree (4) | 0 |
| generation-states | triggers-disagree (4) | 0 |
| steering-loop | triggers-disagree (4) | 0 |
| host-start | predelivery | 0 |
| http-host | predelivery | 0 |
| schema-migration | predelivery | 0 |
| model-import | triggers-disagree (2) | 0 |
| loop-closure | no-trigger | 0 |
| repo-lifecycle | no-trigger | 0 |
| verify-lane | triggers-disagree (2) | 0 |
| docked-session | triggers-disagree (2) | 1 (offen) |
| **Summe** | **11** | **1** |

Fehler (`rules_get_violations`, severity error): 0 vorher, 0 nachher. IO-01 und FC-05: 0 vorher, 0 nachher. Alle Regeln über `evaluateAllRules` (Standardpolicy): nur R-30 neu (+1, `FUNC-import-code`); sonst gleich (R-21 blieb bei 1 — ein Versuch mit `import-code` unter `skill-help` hätte 10 R-21 erzeugt und wurde verworfen).

Tests: `verify:model` grün; `npm test` 1653 grün, 2 rot: `distribution.test.ts` (bekannt, unveröffentlichter contracts) und `repository-style.spike.test.ts` (verglich den Hash der SSOT, während die Nachbarsitzung CR-GC-875 anlegte; allein gefahren grün).

## Offene Fragen

1. **docked-session (FC-06 1 Befund).** Der Agent tritt bei `FUNC-agent-loop` ein, das Dashboard bei `FUNC-host-socket`. Am Code ist es ein Einsprung (`callHost` gegen `startHostSocket`), im Modell sind es zwei Knoten: der Agent ruft über `FUNC-host-proxy`, das Dashboard direkt. Zwei Ketten sind nicht ableitbar, weil `host-socket` Glied beider Ketten sein muss und die Antwortflüsse jeden Eingang zum vollen Eintritt machen. Optionen: (a) `chainRoles` prüft `neighbor` vor `full` (Änderung in sigloch-modules; `dashboard-call` ist in `host-start` und `session-end` schon `neighbor`); (b) der Agent tritt direkt bei `host-socket` ein und `agent-loop` fällt aus der Kette, was den Aufrufweg über den Stellvertreter verwischt. Nicht geändert.
2. **`FUNC-import-code` ohne Kette (R-30).** Der Skill ist Aufrufer; unter `skill-authoring` scheitert `skill-authoring-gate` (der Skilltext nennt kein Gate-Werkzeug), unter `skill-help` entstehen 10 R-21-Warnungen (kein REQ am Skill, R-02 steht schon offen). Entscheidung nötig: eine REQ für den Skill (löst R-02 und R-21) und dann `skill-help`, oder eine eigene Kette.
3. `FUNC-schema-guard` bleibt Glied von `host-start` und `http-host` (Aufruf aus `open`). Falls gemeint war, ihn dort ganz zu lösen: Entscheidung nötig; ohne `FLOW-version-bump` meldet FC-06 dort nichts.
