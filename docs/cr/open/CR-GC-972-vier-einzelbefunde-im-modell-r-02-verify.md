# CR-GC-972: Vier Einzelbefunde im Modell: R-02 verify-lane-code, CR-R01 vier offene CR ohne Umfang, RC-11 src/index.ts, Ketten-Klassifikation R-21 FC-06

**Typ:** aus Item ITEM-2026-1515 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1515.json (Lane: code)

---

## Befund

Stand graphVersion 1358: 148 Warnungen. Dieser CR bearbeitet vier Einzelbefunde, die ohne Entscheidung des Autors gehen oder klassifiziert werden müssen.

| Regel | Befund | Behandlung |
|---|---|---|
| R-02 | `FUNC-verify-lane-code` erfüllt keine Anforderung. Der Knoten trug einen `acceptedFindings`-Eintrag (CR-GC-954): „kein Test startet das Skript“. | behoben: eigene REQ mit Test |
| CR-R01 | CR-GC-808, 810, 811, 812 haben keine relation-Kante auf FUNC, MOD, SCHEMA, REQ oder UC. | behoben: Kanten laut CR-Text |
| RC-11 | `src/index.ts` gehört zu keinem MOD (importCoverage 103 von 104). | nicht behoben, Varianten unten |
| R-21 | `FUNC-serve-sse` übergibt an `FUNC-graph-expand` ohne gemeinsame FCHAIN. | klassifiziert, nicht behoben |
| FC-06 | `FCHAIN-docked-session` (2 Auslöser) und `FCHAIN-skill-import-code` (Auslöser an `FUNC-agent-loop` und `FUNC-cli-dispatch`). | klassifiziert, nicht behoben |

## Änderung

**R-02.** `scripts/verify-code.mjs` wird von keinem Test gestartet; `planCodeLane` und `meldeZurueck` haben ihre Tests, die Verdrahtung des Runners hatte keinen. Neu: `REQ-verify-code-plan-nennt-spur` (functional, unter `REQ-testspur-passt-zum-diff`, Erfüller `FUNC-verify-lane-code`) und `TEST-verify-code-plan` mit `tests/verify-code-plan.test.ts`. Der Test startet den Runner als Prozess mit `--plan` im Repo selbst, nur lesend: eine gebundene Quelldatei (`src/surface/rewind.ts`) ergibt Spur CODE und ein Kommando mit `tests/rewind.test.ts`; eine Quelldatei ohne Knoten ergibt Spur VOLL und `npx vitest run` ohne Dateiargument; Exit 0, keine Rückmeldung, kein vitest-Bericht. Der REQ-Text verspricht nur, was der Test prüft; das Lauf-Urteil und die Rückmeldung nach dem Lauf stehen bei `FUNC-lauf-urteil` und `FUNC-aenderung-melden`. Der Eintrag `acceptedFindings` am Knoten ist entfernt: sein Grund gilt nicht mehr.

**CR-R01.** relation-Kanten, je aus dem Text des CR:

| CR | Kante auf | Beleg im CR-Text |
|---|---|---|
| CR-GC-808 | `FUNC-mutate`, `FUNC-load-config` | „Durchgesetzt im Gate“; „Harness-Config listet erlaubte Schreiber“ |
| CR-GC-810 | `FUNC-bind-tools`, `FUNC-gve-supervise` | neues MCP-Tool `viewer_show`; „graphcode liest dashboard.url“ (`attachGve`) |
| CR-GC-811 | `FUNC-tool-context`, `SCHEMA-tool-context` | „occReject (tool-context.ts)“; `occReject` ist Mitglied des Werkzeug-Kontexts |
| CR-GC-812 | `FUNC-tool-context` | „Dirty = die OCC-Prüfung je Element“; der Rest (Rechner BQ, Rechtschreibung, lokales LLM, Viewer) hat heute keinen Knoten |

CR-GC-812 ist am schwächsten belegt: nur die OCC-Prüfung ist im Modell; die Vorschlagsberechnung selbst ist neu.

## Klassifikation der nicht behobenen Befunde

**RC-11, `src/index.ts`.** Die Datei ist die öffentliche Ausgabe des Pakets (reine Re-Exporte aus `kernel`, `surface`, `projections`). `src/cli.ts` ist über `FUNC-cli-dispatch` (realRef `main`) an `MOD-surface` gebunden; `src/README.md` nennt beide „bound via realRef, not by path“. Für `index.ts` gibt es keine FUNC. Varianten für den Autor: (a) eine FUNC „Paketausgabe“ in `MOD-surface` mit realRef auf die Datei, samt REQ und TEST; (b) die Datei nach `src/surface/` verschieben (FAQ `mod-path-einwertig`: lose Dateien ins Modulverzeichnis), dann ändern sich `package.json` (`main`, `exports`, `bin`), `dist/index.js` und der Test `distribution.test.ts`; (c) ein MOD für die Einstiegsdateien, dessen `path` nur ein Verzeichnis nennen kann, also dasselbe Verschieben. Nicht erfunden.

**R-21, `FUNC-serve-sse` → `FUNC-graph-expand`.** Echte Übergabe im Code: `src/surface/host.ts:254-261` bedient `GET /subgraph/:root` mit `harness.subgraph(...)`, dem Symbol von `FUNC-graph-expand`. Das Modell zeichnet es als `FLOW-http-route` von `FUNC-serve-sse` an `FUNC-graph-expand` und `FUNC-health-endpoint`. Die Route hat keinen Test (`tests/host.bridge*.test.ts` nennen sie nicht), und im Modell ruft keine Kette sie auf. Varianten: (a) eigene Kette „Viewer liest Teilgraph“ mit Akteur `ACTOR-dashboard` als Auslöser, REQ und Integrationstest; setzt voraus, dass der Viewer die Route wirklich ruft, das liegt im Nachbar-Repo; (b) die Route löschen und die Kante entfernen, wenn niemand sie ruft. Welche, entscheidet der Autor (FAQ `r21-uebergabe-ohne-kette`: R-21 nicht abnehmbar).

**FC-06, `FCHAIN-docked-session`.** Zwei Auslöser an verschiedenen Gliedern: `ACTOR-auftraggeber` über `FLOW-auftrag` an `FUNC-agent-loop`, `ACTOR-dashboard` über `FLOW-dashboard-call` an `FUNC-host-socket`. Beide sind echt: der Viewer ruft `host.sock` selbst. Nach FAQ `trigger-je-wirkkette` gehört je Auslöser eine eigene Kette (CR-GC-834 tat das für Einrichten, Hoststart, Sitzungsende, angedockte Sitzung). Variante: Kette „Viewer ruft Werkzeug über host.sock“ mit eigener REQ und Integrationstest, `FUNC-host-socket` aus der Kette der angedockten Sitzung heraus; schließt zuerst die Abnahme, dann die Kanten (FAQ `r21-uebergabe-ohne-kette`). Das ist eine neue Kette mit Test, kein mechanischer Zug.

**FC-06, `FCHAIN-skill-import-code`.** Der Auslöser des Weges ist `FUNC-agent-loop` (Skill gelesen, dann CLI-Verb). Die Mitglieder `FUNC-cli-dispatch` tragen aber auch `FLOW-cli-invocation` und `FLOW-cli-invocation-render` direkt vom Akteur, die zu anderen Ketten gehören (Verben `init`, `render`). Die Kette bekommt dadurch einen zweiten Auslöser an einem anderen Glied mit anderem Schema. Das ist kein Fehler der Kante, sondern der Eigenschaft: `FUNC-cli-dispatch` ist Eingang mehrerer Wege. Varianten: (a) FUNC-cli-dispatch je Verb teilen (eine FUNC je Verb mit eigener realRef-Funktion), dann hat die Kette nur ihre Eingabe; (b) das Ergebnis als benannte Entscheidung des Auftraggebers stehen lassen (FAQ `func-an-welche-kette` Punkt 5). Nicht entschieden.

## Nachweis rot-zuerst (R-02)

Mutante: in `scripts/verify-code.mjs` die Zeile `if (plan) process.exit(0);` entfernt, danach zurückgenommen (`git diff scripts` leer). Beide Fälle rot: der erste lief 8,2 s, weil der Runner nun vitest auf der Auswahl fuhr und zurückmeldete, der zweite lief in die 20-s-Grenze, weil er die volle Suite startete. Der Mutantenlauf war ein echter Lauf: er schrieb `ranAt` von fünf TEST-Knoten neu (Ergebnis `passed` unverändert) und startete kurz die volle Suite, die danach beendet wurde.

## Akzeptanz

- [x] `tests/verify-code-plan.test.ts` grün, mit Mutante rot gesehen.
- [x] `verify:code` grün (57 Dateien, 490 Tests, darunter der neue). `verify:full CR-GC-972` grün (249 Dateien), Schlupf 0, Link-Modus nein.
- [x] R-02 1 → 0, CR-R01 4 → 0 (`rules_evaluate`).

---

## Entscheidungen

keine

---

## Umfang laut `graph_impact`

Neu: `REQ-verify-code-plan-nennt-spur`, `TEST-verify-code-plan`, `tests/verify-code-plan.test.ts`. Geändert: `FUNC-verify-lane-code` (`acceptedFindings` leer). relation-Kanten: `FUNC-verify-lane-code`, `REQ-verify-code-plan-nennt-spur`. Kein Quellcode unter `src/` und kein Skript geändert.
