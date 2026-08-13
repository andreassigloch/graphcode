# CR-GC-329 — Die Schwellwerte stehen in der Config und kommen mit der Kennzahl heraus

**Status:** done · **Datum:** 2026-08-12 · **Abgeschlossen:** 2026-08-13
**Ziel:** graphcode 0.12.x
**Ontologie:** v4.0.0 — **unverändert**
**Vorbedingung:** CR-SM-233 (`sigloch-modules/docs/cr/open/CR-SM-233-schwellwerte-als-policy-parameter.md`) —
contracts nimmt die Schwellen als Parameter entgegen und hat keinen internen Default mehr.
**Bezug:** [CR-GC-326](CR-GC-326-modul-metriken-je-mod.md) (`graph_metrics`, done),
[CR-GC-325](CR-GC-325-dimension-readiness-ueber-mcp.md) (`dimension_readiness`, done),
CR-SM-232 (`moduleMetrics`), CR-SM-223 (MT-01/MT-02-Schwellen unvalidiert)

---

## 1. Problem

Seit CR-GC-326 liefert `graph_metrics` die Modulkennzahl (Instabilität, LCOM4, Kohäsion). Die
**Schwelle**, gegen die geurteilt wird, kommt nicht mit: sie steckt in contracts als Konstante
(`INSTABILITY_THRESHOLD = 0.7`, LCOM4-Stufen 4/5). CR-SM-233 macht daraus einen Parameter — dann
braucht dieser Parameter einen Halter, und den gibt es in graphcode nicht:

- **graphcode hat keine Config-Datei.** `HarnessConfigSchema` (contracts/harness) kennt vier
  Felder — `repoRoot`, `scope`, `consumerType`, `preCommitTimeout` — und wird in `src/mcp-server.ts`
  aus Code/Env zusammengesetzt. Auf der Platte liegt neben `.graphcode/` nichts, was ein Mensch
  editieren könnte.
- **Ein Konsument, der 71 % anzeigt, kennt die 70 % nicht.** `graph_metrics` gibt den Wert,
  `rules_evaluate` den Verstoß — die Schwelle selbst steht in keiner Antwort. Wer sie anzeigen
  will, muss sie sich lokal hinschreiben. Genau das ist der parallele Pfad, den CR-SM-233 in
  contracts beseitigt und der hier sofort neu entstünde.
- **Ein unsicherer Wert ist heute nur durch Codeänderung stilllegbar.** MT-01/MT-02 sind
  ausdrücklich unvalidiert (CR-SM-223: „Validation … is deferred"). Die einzige bisherige Antwort
  darauf war, die Regel auszubauen (MT-03).

---

## 2. Ziel

Die Schwelle existiert im Betrieb genau einmal — in einer editierbaren Config — und verlässt den
Host **zusammen mit der Zahl, über die sie urteilt**.

---

## 3. Nicht-Ziele

- **Keine Schwellenlogik in graphcode.** Geurteilt wird weiter in den contracts-Regeln; graphcode
  hält den Wert und reicht ihn durch.
- **Keine Kalibrierung.** Ob 0.7 richtig ist, entscheidet dieser CR nicht.
- **Kein stiller Default.** Fehlt die Config, gilt `DEFAULT_METRIC_POLICY` aus contracts — aber die
  Antwort sagt das (`source: "default"`), statt es zu verschweigen.
- **Keine Ausweitung auf ND/AO/BQ.** Deren Schwellen folgen demselben Weg, sobald CR-SM-233s
  Folge-CR sie zu Parametern gemacht hat. Hier bleibt es bei der Architektur-Achse.

---

## 4. Anforderungen

1. **Config-Datei** `graphcode.config.jsonc` im `repoRoot`, Zod-validiert, mit einem
   `metricPolicy`-Block. **JSONC, nicht JSON** — der Grund für die Datei ist gerade, dass ein
   stillgelegter Wert seine Begründung neben sich trägt:
   **Zwei Ebenen, getrennt ausgewiesen** (`docs/MESSGROESSEN.md`, „Schwellen — zwei Ebenen"):
   ```jsonc
   {
     // Ebene 2 — Zielarchitektur: was DIESES Projekt erreichen will. Setzt der Mensch.
     "targets": {
       "instability": null,          // unvalidiert (CR-SM-223) — messen, nicht ampeln
       "lcom4": { "info": 4, "warning": 6 },
       "focusThreshold": 0.8         // "Dimension zu schwach?" — EINE Zahl für Fokus und ready
     },
     // Ebene 1 — Verfahren: Maße des Messgeräts, mit dem Werkzeug ausgeliefert.
     // Startwerte ohne Messreihe; Änderung hier ändert das Messgerät, nicht das Ziel.
     "procedure": {
       "ndSimilarity": 0.85,
       "schemaOverlap": 0.5
     }
   }
   ```
   `focusThreshold` ersetzt beide heutigen Werte: den Default-Parameter `threshold = 0.8` in
   `src/generate.ts:134` und das `ready ≥ 0.7`-Flag in se-steering.
   Dass dieselbe Frage („ist diese Dimension zu schwach?") heute zwei Antworten hat, ist der
   eigentliche Anlass — CR-SM-235 macht die Schwelle dafür zum Parameter ohne Default.
2. **Durchreichen:** die Policy geht an `evaluateAllRules` (via `takeSteeringSnapshot`) und an
   `moduleMetrics`-Konsumenten. Ein zweiter Ort, an dem eine Zahl steht, entsteht nicht — Grep-Nachweis.
3. **Mit herausgeben:** `graph_metrics` liefert die geltende Policy in derselben Antwort wie die
   Kennzahlen, inklusive Herkunft:
   `{ modules: [...], policy: { instability: null, lcom4: {...} }, policySource: "config" | "default" }`.
   Ein Konsument, der eine Ampel zeichnet, liest Wert und Schwelle aus **einer** Antwort.
4. **`null` heißt messen, nicht urteilen** — die Kennzahl bleibt in der Ausgabe, es entsteht kein
   Verstoß. Nicht verwechselbar mit „Regel aus" (die Zahl verschwände) oder `0` (die Regel würde
   überall feuern).
5. **Fail fast bei kaputter Config:** vorhandene, aber schemawidrige Datei → Startfehler mit
   Pfad und Feld. Kein Fallback auf Defaults, wenn jemand die Datei erkennbar gemeint hat.
6. Fehlt die Datei ganz → `DEFAULT_METRIC_POLICY`, `policySource: "default"`, einmalige Notiz im
   Startlog.

---

## 5. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/config.ts` (neu) | `GraphcodeConfigSchema` + Laden/JSONC-Parse + `policySource` |
| `src/mcp-server.ts` | Config beim Boot laden, an Harness/Tools geben |
| `src/steering-snapshot.ts` | Policy + `focusThreshold` an `evaluateAllRules`/`computeReadiness` durchreichen |
| `src/tools/metrics.ts` | `policy` + `policySource` in die Antwort |
| `tests/config.test.ts` (neu) | fehlend → default; kaputt → Startfehler; `null` schweigt, Kennzahl bleibt |
| `graphcode.config.jsonc` (neu, Beispiel im Repo) | die eigenen Werte, kommentiert |

6 Dateien — Obergrenze erreicht.

**Folge-CR (bewusst getrennt):** `src/generate.ts` löscht seinen Default-Parameter `threshold = 0.8`
und liest `focusThreshold`. Getrennt, weil er erst laufen kann, wenn CR-SM-235 die Schwelle in
`computeReadiness` zum Parameter ohne Default gemacht hat — sonst stünden kurzzeitig drei Werte für
dieselbe Frage im Baum statt zwei.

---

## 6. Akzeptanzkriterien

- [x] `grep -rn "0\.7" src/` findet keine Architektur-Schwelle mehr (nur noch Config/Contracts).
- [x] `graph_metrics` liefert `policy` + `policySource` in derselben Antwort wie `modules`.
- [x] `"instability": null` → MT-01 feuert nicht, `instability` steht trotzdem in jeder Modulzeile.
      Geprüft **im Gate**, nicht nur in der Anzeige (`tests/config.test.ts`).
- [x] `"lcom4": { "info": 4, "warning": 6 }` verschiebt die Severity nachweislich gegenüber 4/5
      (Nachweis in contracts: `tests/unit/se-metric-policy.test.ts`, Stufen-Tabelle 3/4/5/6/7).
- [x] Schemawidrige Config → Start bricht mit Pfad + Feld ab, kein stiller Default.
- [x] `npm run build` grün; Suite 675/677 — die zwei roten sind benannt (s. Abschluss).

---

## 7. Folgen

Danach gilt: **contracts rechnet, graphcode konfiguriert und liefert, der Renderer zeigt.** Ein
Dashboard, das „71 % / Ziel ≤ 70 %" anzeigt, hat beide Zahlen aus einem Aufruf und keinen eigenen
Zielwert — der zunächst erwogene `ConfigSchema.kpiTargets` in graph-view-edit entfällt damit
ersatzlos. Was dann noch außerhalb der Config steht, ist `READY_THRESHOLD = 0.7`
(`se-steering/src/readiness-compute.ts:16`) für die Dimensionsscores — bewusst offen gelassen,
eigene Größenordnung, eigener CR.

---

## 8. Abschluss 2026-08-13

**Was zusätzlich nötig war — und warum es nicht optional war.** Die Datei-Tabelle in §5 nannte
6 Dateien; real sind es 11 (+ contracts-Seite als CR-SM-233). Grund: die Policy ohne Default ist eine
**Signaturänderung**, und ein halb umgestellter Baum wäre genau der zweite Pfad, den der CR beseitigt.

| Zusatz | Warum |
|---|---|
| `src/harness.ts` + `graph-api-core createSeDescriptor(policy)` | **Der eigentliche Befund:** graphcodes Gate urteilt über `SE_DESCRIPTOR.rules` (`DefaultRuleEngine`), NICHT über `evaluateAllRules`. Ohne diesen Schritt hätte `graph_metrics` die konfigurierte Schwelle angezeigt, während MT-01 im Gate weiter mit 0.7 geurteilt hätte — der Fehler wäre nur umgezogen |
| `src/steering.ts`, `src/generate.ts`, `src/tools/{report,write,suggest}.ts` | `takeSteeringSnapshot`/`nextStep`/`generationStep` reichen die Policy durch; die Tools holen sie aus `harness.getMetricPolicy()` — eine Quelle, kein Default an der Aufrufstelle |
| `src/index.ts` (`createHarness`) | Config beim Boot laden; kaputte Datei bricht den Start ab, statt still zu defaulten |
| `package.json` | Deps auf contracts ^4.0.0 / graph-api-core ^2.2.0 / se-steering ^0.4.0 / se-optimizer ^0.3.3 |

**Träger der Werte:** `harness.getGraphcodeConfig()` gibt `{config, source, path}` heraus — deshalb
kann `graph_metrics` `policySource` melden, ohne eine zweite Ladestelle zu haben.

**Suite: 675/677.** Zwei rote Tests, beide benannt statt weggeredet:
1. `tests/distribution.test.ts` — installiert ein gepacktes graphcode in ein fremdes Repo und zieht
   `@sigloch/contracts` aus der **Registry** (3.3.0, ohne `DEFAULT_METRIC_POLICY`). Direkte Folge der
   Entscheidung „lokal linken, später publishen": grün, sobald contracts 4.0.0 publiziert ist.
2. `tests/audit.trail-projection.test.ts` — misst die Projektionsgröße am **lokalen** `.graphcode/audit.jsonl`
   (88.2 % statt der geforderten ≥ 89 %). **Vorbestehend**: auf `HEAD` (b6e2f67) mit derselben
   Trail-Datei genauso rot, ohne eine Zeile dieses CRs. Eigener CR (Schwelle nachmessen oder Projektion
   verbessern) — nicht hier stillschweigend anpassen.

**Nicht erledigt (bewusst, wie in §5 angekündigt):** `src/generate.ts` liest `focusThreshold` noch
nicht — der Default-Parameter `threshold = 0.8` steht weiter dort. Der Folge-CR kann erst laufen, wenn
CR-SM-235 die Schwelle in `computeReadiness` zum Parameter ohne Default gemacht hat. `focusThreshold`
ist in der Config **gehalten und exportiert**, aber noch ohne Konsument — das ist der bewusst
akzeptierte Zwischenzustand, keine vergessene Verdrahtung.

@author andreas@siglochconsulting
