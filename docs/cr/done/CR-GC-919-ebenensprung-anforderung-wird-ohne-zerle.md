# CR-GC-919: Ebenensprung — Anforderung wird ohne Zerlegung tief erfuellt

**Status:** ✅ Done (2026-11-17)
**Typ:** aus Item ITEM-2026-1321 (finding)
**Erstellt:** 2026-11-12
**Item:** bok/items/ITEM-2026-1321.json (Lane: code)
**Regel dazu:** CR-SM-436 (wartet auf die Messung dieses CR)

---

**Bezug:** [`SPIKE-GC-ein-erfueller-je-req-RESULTS.md`](../../archive/spikes/SPIKE-GC-ein-erfueller-je-req-RESULTS.md) §1 und §6.
Entscheidung des Autors 2026-11-12: immer die volle Kette SYS.1 → SYS.2 → SWE.1; erst CR-GC-918
abschliessen, dann am echten Modell neu zaehlen.

## Befund

Ein Ebenensprung ist eine REQ, die direkt unter SYS oder einem UC haengt, keine Kind-REQ hat und von
einer FUNC oder einem MOD unterhalb der obersten Ebene erfuellt wird. Beispiel aus dem Modell:

```
SYS-graphcode ─compose→ REQ-repo-uninstall  „Deinstallation entfernt alle installierten Artefakte ohne Residuen."
                           ▲ satisfy
FUNC-block-betrieb > FUNC-block-bedienung > FUNC-harness-cli (Blatt, Ebene 2)
```

Die Systemanforderung springt ueber zwei Funktionsebenen. Was „ohne Residuen" fuer die Kommandozeile
heisst, steht in keiner Anforderung. Nach Automotive SPICE fehlt die Software-Anforderung (SWE.1), die
aus der Systemanforderung (SYS.2) abgeleitet ist.

Gezaehlt an der Spike-Kopie: 57 vorher, 37 nach den Batches von CR-GC-918. Zulaessig bleibt der
Erfueller auf der Systemebene: SYS, FCHAIN, MOD der obersten Ebene, Blatt-FUNC der obersten Ebene
(SYS.3.BP4: Systemanforderung zum Architekturelement).

## Zielbild

1. **Zaehlen** am Modell nach CR-GC-918, Liste der Faelle in diesen CR.
2. **Je Fall korrigieren:** an der Grenze des Erfuellers eine Kind-REQ ableiten (EARS, nur was an
   seiner Grenze sichtbar ist), `REQ -compose-> REQ`, die `satisfy`-Kante an das Kind, TEST dazu.
   Im Beispiel: „Wenn graphcode remove laeuft, loescht es genau die Pfade, die init angelegt hat."
3. **Faelle ohne sinnvolle Kind-REQ** listen: dort ist die Eltern-REQ selbst zu tief formuliert und
   wandert als Ganzes nach unten (INCOSE C2).
4. **Messung fuer CR-SM-436:** Zahl der Faelle vorher und nachher, Zahl der Faelle, die sich als
   Pruefregel nicht eindeutig entscheiden liessen.

## Akzeptanz

- [x] Liste der Spruenge am Modell nach CR-GC-918, mit Zahl (39, Abschnitt Messung).
- [x] Jeder Sprung zerlegt oder verschoben; verbleibende mit Grund gelistet (keine verbleibend).
- [x] Keine neue Fehlermeldung, R-01 = 0, keine REQ mit mehr als einem Erfueller.
- [x] Messung an CR-SM-436 uebergeben (RD-07 in contracts 12.15.0, eingezogen mit CR-GC-955).
- [x] `npm run verify:model` gruen; `docs/graph` und `docs/views` im selben Commit.

## Umfang

`docs/graph/graphcode.graph.json` und die erzeugten Sichten unter `docs/views/`. Kein Quellcode.

---

## Messung (Schritt 1, 2026-11-17)

**Definition, wie gezaehlt:** Eine REQ ist ein Sprung, wenn (a) ein SYS oder UC sie per `compose` enthaelt,
(b) sie keine Kind-REQ hat (`REQ -compose-> REQ`) und (c) mindestens ein Erfueller (`satisfy`) tief liegt: eine
FUNC, die eine andere FUNC enthaelt (`FUNC -compose-> FUNC`), oder ein MOD, das ein anderes MOD enthaelt.
Zulaessig sind SYS, FCHAIN, MOD der obersten Ebene und FUNC ohne Eltern-FUNC.

**Eichung:** Am Spike-Stand 7e46c55b ergibt diese Zaehlung 57, gleich der Zahl im Spike.

| Modellstand | Spruenge | davon eindeutig | davon nicht eindeutig |
|---|---|---|---|
| 7e46c55b (Spike, vor CR-GC-918) | 57 | 30 | 27 |
| 11279a84 (master vor CR-GC-918) | 59 | 32 | 27 |
| a9674276 (master nach CR-GC-918) | 39 | 36 | 3 |

**Nicht eindeutig als Pruefregel (fuer CR-SM-436):**

- **Mehrere Erfueller** (vor CR-GC-918: 27 Faelle): Welcher Erfueller zaehlt? Seit RD-06 = 0 gibt es diesen
  Fall nicht mehr. Eine Regel RD-07 kann RD-06 voraussetzen.
- **Unter SYS/UC und zugleich unter einer REQ** (3 Faelle): Ist die REQ Systemanforderung oder schon Kind einer
  anderen? Die Regel muss festlegen, ob ein Eltern-REQ den Sprung aufhebt.
- **Unter zwei Elementen der obersten Ebene** (2 der 36, `REQ-post-harness-cli` unter SYS und UC,
  `REQ-model-exchange-pre` unter zwei UC): entscheidbar, aber die Regel muss mehrere Eltern zulassen.
- **Tiefes MOD** (2 Faelle an `MOD-kernel-measure`, Kind von `MOD-kernel`): Zaehlt ein Unter-MOD als
  unterhalb der obersten Ebene? Diese Zaehlung sagt ja.

**Die 39 Faelle auf master (a9674276):**

| REQ | unter | Erfueller | nicht eindeutig |
|---|---|---|---|
| `REQ-rule-calibration` | UC-loop-closure | `FUNC-audit-stats` | – |
| `REQ-mcp-tool-registry` | SYS-graphcode | `FUNC-bind-tools` | – |
| `REQ-tool-input-parsed-once` | SYS-graphcode | `FUNC-bind-tools` | – |
| `REQ-chain-metrics` | UC-live-graph-view | `FUNC-chain-metrics` | – |
| `REQ-readiness-model` | SYS-graphcode | `FUNC-compute-readiness` | – |
| `REQ-impact-based-testing` | UC-efficient-testing | `FUNC-deduce-tests` | – |
| `REQ-post-emit-update-event` | UC-live-graph-view | `FUNC-emit-update-event` | – |
| `REQ-near-duplicate-detection` | UC-deterministic-steering | `FUNC-evaluate-rules` | – |
| `REQ-doc-export` | SYS-graphcode | `FUNC-export-markdown` | – |
| `REQ-post-export-markdown` | SYS-graphcode | `FUNC-export-markdown` | – |
| `REQ-srs-29148` | UC-model-exchange | `FUNC-export-markdown` | – |
| `REQ-done-iff-no-focus` | UC-deterministic-steering | `FUNC-generation-step` | – |
| `REQ-metrics-constraint-carriers` | UC-live-graph-view | `FUNC-graph-metrics` | – |
| `REQ-metrics-risk-scope` | UC-live-graph-view | `FUNC-graph-metrics` | – |
| `REQ-steering-pre` | UC-deterministic-steering | `FUNC-graph-store` | – |
| `REQ-applied-suggestion-moves-target` | UC-deterministic-steering | `FUNC-graph-suggest` | – |
| `REQ-target-shifts-ranking` | UC-deterministic-steering | `FUNC-graph-suggest` | – |
| `REQ-post-harness-cli` | SYS-graphcode+UC-repo-lifecycle | `FUNC-harness-cli` | – |
| `REQ-repo-uninstall` | SYS-graphcode | `FUNC-harness-cli` | – |
| `REQ-skill-import-code-nennt-verb` | UC-model-exchange | `FUNC-import-code` | – |
| `REQ-model-exchange-pre` | UC-consolidate-requirements+UC-model-exchange | `FUNC-import-code-verb` | – |
| `REQ-mutate-befund-je-element` | UC-model-exchange | `FUNC-import-doc` | – |
| `REQ-thresholds-from-config` | UC-deterministic-steering | `FUNC-load-config` | – |
| `REQ-conflict-free-merge` | UC-graph-time-travel | `FUNC-merge-nodes` | – |
| `REQ-post-merge-nodes` | UC-graph-time-travel | `FUNC-merge-nodes` | – |
| `REQ-selective-code-lane` | UC-efficient-testing | `FUNC-plan-code-lane` | – |
| `REQ-render-document` | UC-model-exchange | `FUNC-render-verb` | – |
| `REQ-completeness-actor-bounded` | UC-live-graph-view | `FUNC-score-completeness` | – |
| `REQ-readiness-completeness` | UC-live-graph-view | `FUNC-score-completeness` | – |
| `REQ-post-impact-testing` | UC-efficient-testing | `FUNC-select-tests` | – |
| `REQ-session-leaves-nothing-behind` | UC-repo-lifecycle | `FUNC-session-shutdown` | – |
| `REQ-steering-post` | UC-deterministic-steering | `FUNC-take-steering-snapshot` | – |
| `REQ-model-lane-fixed-set` | UC-efficient-testing | `FUNC-verify-lane-model` | – |
| `REQ-recommend-next-step` | SYS-graphcode | `FUNC-vorschlag` | – |
| `REQ-bericht-ist-kein-urteil` | UC-deterministic-steering | `FUNC-zug-bericht` | – |
| `REQ-readiness-transparent` | UC-live-graph-view | `MOD-kernel-measure` | – |
| `REQ-store-recovery` | SYS-graphcode | `FUNC-open-store` | auch unter REQ |
| `REQ-single-measurement-path` | UC-deterministic-steering | `FUNC-take-steering-snapshot` | auch unter REQ |
| `REQ-dashboard-ontology-sync` | UC-live-graph-view | `MOD-kernel-measure` | auch unter REQ |

---

## Korrektur (Schritte 2 und 3, 2026-11-17)

**Entscheidung des Auftraggebers:** anwenden, wenn das Gate sauber ist. Der Batch lief erst als Trockenlauf.
Der erste Trockenlauf blockte mit R-01: Die neuen Eltern-REQ hatten keinen TEST. Der zweite lief ohne Meldung.

**Ergebnis:** RD-07 39 → 0 (Engine, contracts 12.15.0, und Zaehlung am Snapshot), RD-06 bleibt 0, keine
Fehlermeldung, R-01 = 0. REQ 259 → 265. Alle anderen Befundzahlen unveraendert.

**A — unter eine vorhandene Systemanforderung gehaengt (19):**

| Eltern-REQ | Kinder |
|---|---|
| `REQ-auto-persist-merge` | `REQ-conflict-free-merge`, `REQ-post-merge-nodes` |
| `REQ-versioned-broadcast` | `REQ-post-emit-update-event` |
| `REQ-graph-tests-operational` | `REQ-impact-based-testing`, `REQ-post-impact-testing` |
| `REQ-steering-from-metrics` | `REQ-done-iff-no-focus`, `REQ-steering-pre`, `REQ-steering-post`, `REQ-single-measurement-path`, `REQ-thresholds-from-config`, `REQ-near-duplicate-detection`, `REQ-recommend-next-step` |
| `REQ-code-quality` | `REQ-bericht-ist-kein-urteil` |
| `REQ-graph-is-ssot` | `REQ-doc-export`, `REQ-post-export-markdown` |
| `REQ-single-kuzu-owner` | `REQ-store-recovery`, `REQ-session-leaves-nothing-behind` |
| `REQ-audit-trail` | `REQ-rule-calibration` |
| `REQ-repo-install` | `REQ-post-harness-cli` |

**B — neue Systemanforderung, die Kinder darunter (19):**

| Neue REQ (unter) | Text | Kinder | TEST |
|---|---|---|---|
| `REQ-messstand-nachvollziehbar` (UC-live-graph-view) | Wenn der Auftraggeber den Stand des Modells abfragt, nennt graphcode je Marke, Kette und Modul die Kennzahlen und die Elemente und Regeln, aus denen sie entstehen; gerechnet wird gegen den Regelkatalog aus contracts. | readiness-completeness, completeness-actor-bounded, chain-metrics, metrics-constraint-carriers, metrics-risk-scope, readiness-transparent, dashboard-ontology-sync, readiness-model | mcp-readiness, graph-metrics |
| `REQ-modellaustausch` (UC-model-exchange, UC-consolidate-requirements) | Wenn ein Fremdbestand eingelesen wird, gelangt er nur ueber graph_mutate in den Graphen; wenn eine Sicht ausgegeben wird, entsteht sie nur aus dem Graphen. | model-exchange-pre, mutate-befund-je-element, skill-import-code-nennt-verb, srs-29148, render-document | import-invariant, doc-export |
| `REQ-werkzeuge-wirken-im-repo` (SYS) | Jedes Werkzeug der MCP-Oberflaeche nimmt nur eine gueltige Eingabe an und wirkt auf den Store des Repos, in dem der Host laeuft. | mcp-tool-registry, tool-input-parsed-once | mcp-stdio-server, werkzeug-eingang-geparst |
| `REQ-testspur-passt-zum-diff` (UC-efficient-testing) | Wenn eine Aenderung geprueft wird, faehrt graphcode die Testspur, die zum Diff passt: die feste Modellmenge fuer reine Modell-Aenderungen, die abgeleitete Auswahl fuer Code-Aenderungen, sonst die volle Suite. | selective-code-lane, model-lane-fixed-set | selective-test-audit, verify-model-set |
| `REQ-umbau-haelt-vorhersage` (UC-deterministic-steering) | Wenn graph_suggest Umbauvorschlaege rankt, folgt die Reihenfolge dem Zielprofil, und ein angewandter Vorschlag bewegt die Kennzahl so, wie vorhergesagt. | applied-suggestion-moves-target, target-shifts-ranking | applied-suggestion-moves-target, target-shifts-ranking |

Die TESTs der neuen REQ pruefen je ein Kind ueber die Systemgrenze (MCP, Import, Export, Spuren, Suggest);
kein TEST ist neu.

**C — Kind abgeleitet (1):** `REQ-repo-uninstall` bleibt Systemanforderung. Ihr Kind
`REQ-remove-loescht-eigene-pfade` („Wenn graphcode remove laeuft, loescht es jede Datei, die init angelegt hat, und
laesst fremde Dateien stehen.“) erfuellt `FUNC-harness-cli`, geprueft von `TEST-cli-scaffold`.

**Zur Pruefung durch den Autor:** Die fuenf Texte unter B und die Zuordnungen unter A sind neu formuliert bzw.
gewaehlt; sie stehen hier, damit sie im Nachgang geprueft werden koennen. `REQ-conflict-free-merge` ueberschneidet
sich mit `REQ-merge-ohne-konflikt` (beide unter `REQ-auto-persist-merge`) — Duplikat, offen fuer CR-GC-954.


`npm run verify:full CR-GC-919` am 2026-11-17: 231 von 231 Dateien, 1914 von 1914 Tests gruen, Schlupf 0.

## Entscheidungen

_Nachtrag 2026-11-26 (CR-AB-036, aise-bok): Der Abschnitt fehlte beim Schließen. Übertragen aus dem Text oben; der Text oben bleibt unverändert._

| Frage | Festlegung | Begründung |
|---|---|---|
| Welche Kette gilt für Anforderungen von der Systemebene bis zur Funktion? | Immer die volle Kette SYS.1 → SYS.2 → SWE.1. Eine REQ unter SYS oder UC, die eine tiefere FUNC oder ein tieferes MOD erfüllt, bekommt eine Kind-REQ an der Grenze des Erfüllers. Ist die Eltern-REQ selbst zu tief formuliert, wandert sie als Ganzes nach unten. | Entscheidung des Autors 2026-11-12 (Abschnitt „Bezug"); Regel RD-07 misst den Ebenensprung |
| Welche Erfüller sind auf der Systemebene zulässig? | SYS, FCHAIN, MOD der obersten Ebene und Blatt-FUNC der obersten Ebene. | SYS.3.BP4: Systemanforderung zum Architekturelement (Abschnitt „Befund") |
