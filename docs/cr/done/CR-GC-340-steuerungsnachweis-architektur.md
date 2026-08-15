# CR-GC-340 — Steuerungsnachweis I: Messpfad, Architektur-Richtung, Claim-Konformität

**Status:** done · **Abgeschlossen:** 2026-08-15 · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **4**)
**Ziel:** die Steuerungswirkung von graphcode wird **bewiesen**, nicht behauptet.
**Herkunft:** Claim-Audit 2026-08-15 (→ CR-GC-339). Dieser CR trägt das **vollständige
Testkonzept** (§2, restart-fest) und implementiert davon den deterministischen Architektur-Zweig.
**Fortsetzung:** CR-GC-341 (Prozess-Zweig, Claims a + b).

---

## 1. Problem

Die Artikel behaupten drei Wirkungen, für die es heute **keinen kausalen Test** gibt:

| Claim | Behauptet in | Test heute |
|---|---|---|
| a) Regeln machen den Graphen korrekt | 02, 03, 06 | verteilt über `harness.gate.test.ts`, `export-graph-guard.test.ts` — kein zusammenhängender Nachweis |
| b) wir steuern den Kunden durch den SE-Prozess (Gates + Artefakte) | 04, 06, 07 | Momentaufnahmen ja, **Konvergenz nein** |
| c) wir steuern die Architektur-Ausprägung des Modells | 05, 06, 07 | **keiner** — kein einziger Test variiert `target` |

Konkret geprüft 2026-08-15: [`tests/mcp.suggest.test.ts`](../../../tests/mcp.suggest.test.ts) hat
4 Fälle (Reihenfolge, Verdict, read-only, Determinismus) und ruft `graph_suggest` **nie** mit zwei
verschiedenen Zielvektoren auf. [`tests/harness.fit-advisory.test.ts`](../../../tests/harness.fit-advisory.test.ts)
prüft die Δ-Konsistenz, aber nie „Δ läuft in Zielrichtung".

---

## 2. Testkonzept (SSOT — gilt für CR-GC-340 **und** CR-GC-341)

### 2.1 Warum das größtenteils **keine** E2E-Tests sind

Die Regelstrecke hat drei Glieder:

```
Stellgrößen ──► REGLER (deterministisch) ──► AKTOR (LLM) ──► STRECKE (Graph)
 target-weights   takeSteeringSnapshot →       Kandidat        mutate() + ℝ⁶
 focusThreshold   readiness → Fokus →          schreiben       Messung
 MetricPolicy     Prompt / Suggestion-Ranking
```

Nur der **Aktor** ist stochastisch. Ein LLM-E2E-Rotlauf sagt nicht, ob der Regler falsch gerechnet
oder das Modell schlecht geschrieben hat — kein Diagnosewert, flaky, teuer.

**Deshalb: den Loop am Aktor auftrennen.** Ein *skriptierter* Aktor (kanonischer Batch je
Fokus-Dimension) schließt die Kausalkette und bleibt deterministisch. Ein einziges echtes
LLM-E2E bleibt nötig — nur für „ist der Aktor überhaupt steuerbar", statistisch, nightly, **nie im
Gate** (§2.4).

### 2.2 Das Grundmuster: Differenztest, nie Absolut-Assertion

Jeder Steuerungsnachweis ist ein **A/B über eine einzige Stellgröße**: zwei Läufe, identisch bis auf
sie, Assertion auf **Differenz und Vorzeichen**. Absolut-Assertions („arch-Score ist 0.86") brechen
bei jeder Fixture-Änderung und beweisen nichts über Steuerung.

Zu jedem Richtungstest gehört eine **Negativkontrolle**: eine Stellgröße, die nichts ändern darf,
ändert nichts. Ohne sie ist „alles bewegt alles" und die Richtungsaussage wertlos.

### 2.3 Die Testmatrix

| ID | Claim | Stellgröße | Regelgröße | Form | CR |
|---|---|---|---|---|---|
| **T-0** | Voraussetzung | — | Violations + Readiness | Drei Oberflächen, ein Ergebnis | **340** |
| **T-C1** | c | `target.weights` Vorzeichen | Suggestion-Ranking | A/B, Vorzeichenumkehr | **340** |
| **T-C2** | c | `target.weights` Vorzeichen | **ℝ⁶ nach echter Mutation** | A/B, angewandtes Δ | **340** |
| **T-C3** | c | `MetricPolicy` (Config) | `moduleMetrics`-Urteil | A/B, Kippen | **340** |
| **T-C4** | c | Ziel ohne feuernde Operator-Regel | Ranking | Placebo | **340** |
| **T-D1** | Belegbarkeit | — | Artikel-Zahlen | Doc-vs-Code-Konformität | **340** |
| **T-A1** | a | — | Persistenz / Block / Umgehung | „die eine Tür" | 341 |
| **T-B1** | b | Graph-Reife | `currentPhaseGate`, `focusTypes` | Leiter, tabellengetrieben | 341 |
| **T-B2** | b | — | kein Handoff bei offenem Gate | ✅ **existiert**: [`generate.test.ts:228`](../../../tests/generate.test.ts) | — |
| **T-B3** | b | Runden im Loop | Phasen-Sequenz | **Ratsche**, skriptierter Aktor | 341 |
| **T-B4** | b | Graph-Reife | View-Ausgabe je Gate | Artefakt-Kopplung | 341 |
| **T-B5** | b | `defer` | Fokus ja, Zustand nein | Negativkontrolle | 341 |

### 2.4 Ausdrücklich **nicht** im Gate

Das LLM-in-the-loop-E2E (zwei gegenläufige Zielprofile, gleicher Seed, ℝ⁶-Divergenz nach N Runden,
über M Läufe statistisch) gehört in eine eigene, manuell/nightly gestartete Suite. Begründung:
nicht-deterministisch, Kosten, und ein Fehlschlag ist nicht zuordenbar. Kein Blocker für einen CR.

---

## 3. Umfang **dieses** CR

### T-0 · Ein Messpfad (zuerst — sichert alle anderen ab)

`nextStep()`, `generationStep()` und der `steeringDelta`-Zweig des dryRun-Verdicts liefern für
**denselben** Graphen identische Violation-Sets und Readiness-Scores.

Regression auf die Bugklasse CR-GC-303/324: das flache Export-Encoding (CR-216/219) flacht
`attributes.*` auf Top-Level ab, Contracts-Regeln lesen aber `element.attributes?.x` — dadurch
feuerten R-19/R-20/R-26/VR-01/AF-01..05 in einzelnen Pfaden scheinbar bzw. gar nicht und
verschoben die Dimensions-Priorisierung. Heute geht alles über
[`takeSteeringSnapshot`](../../../src/steering-snapshot.ts); **dass** es dabei bleibt, ist bisher
nicht erzwungen.

Assertions: gleiche `rule_id`+`element_id`-Menge, gleiche `report.scores` je Dimension, gleiche
`blockingErrors` — über alle drei Oberflächen, auf einem Fixture mit attributgetragenen Bindungen
(`realRef`, `testRefs`, AF-Stempel).

> Driftet die Messung, sind a), b) und c) alle drei ungültig, egal wie grün sie sind.

### T-C1 · Vorzeichenumkehr

Identischer Graph, `graph_suggest {scalability: +1}` vs. `{scalability: -1}`:

- das Δm·t̂ der Top-Suggestion kehrt das Vorzeichen um,
- die Top-1 ist eine andere Suggestion,
- `target` (ℝ⁶, kanonische Ordnung) im Ergebnis spiegelt die Eingabe.

Beweist: die Zielrichtung erreicht den Vorschlag überhaupt.

### T-C2 · Angewandtes Δ — **der Kernbeweis**

1. Top-Suggestion mit Ziel `+d` holen,
2. deren Template-Edit über `harness.mutate()` **real** anwenden,
3. ℝ⁶ vorher/nachher messen.

Assertions:
- die adressierte Komponente bewegt sich mit dem Vorzeichen des Ziels,
- keine andere Komponente regrediert über ε (ε im Test benannt, nicht magisch),
- mit invertiertem Ziel läuft dieselbe Kette in die Gegenrichtung.

Das ist wörtlich der Claim „eine Änderung der Steuergröße erzeugt eine Mutation des Graphen in die
zu steuernde Richtung" — und braucht **kein LLM**, weil die Suggestion den Template-Edit
deterministisch mitliefert (`Suggestion.edit`, s. [`src/tools/suggest.ts`](../../../src/tools/suggest.ts)).
Wenn nur **ein** Test aus diesem CR gebaut wird, dann dieser.

### T-C3 · Schwelle ist ein Knopf, kein Literal

Identischer Graph, `MetricPolicy` aus `graphcode.config.jsonc` verschoben ⇒ dasselbe
`moduleMetrics` kippt von ok auf Verstoß. Erzwingt die Kernaussage von
[`docs/MESSGROESSEN.md`](../../MESSGROESSEN.md) §Schwellen („Keine Urteilsschwelle steht als Literal
im Regelcode"), statt sie zu behaupten. Zweiter Fall: `focusThreshold` verschieben ⇒ andere
Fokus-Dimension, gleiche Violations.

### T-C4 · Placebo

Ziel auf eine Dimension ohne feuernde Operator-Regeln ⇒ Ranking **identisch** zum ungerichteten Lauf
(`target: {}`). Ohne diesen Test ist T-C1 nicht interpretierbar.

### T-D1 · Claims-Konformität (Doc-vs-Code)

Liest die Zahlen aus `docs/articles/*.md` und `README.md` und assertiert sie gegen die **lebende**
Quelle — dasselbe Muster, das CR-GC-205 schon für Tool-/Skill-Counts etabliert hat:

| Zahl im Text | Quelle |
|---|---|
| Elementtypen | `Object.keys(ELEMENT_DESCRIPTIONS).length` |
| Verbindungstypen | `TraceType.options.length` |
| legale Verbindungsmuster | `TRACE_PATTERNS.length` |
| Regeln | `ALL_RULE_DEFS.length` |
| Readiness-Dimensionen | `new Set(Object.values(RULE_TO_DIMENSION)).size` |
| MCP-Tools | Tool-Registry über `bindToolsToHarness` |

Stand 2026-08-15: **13 / 7 / 36 / 72 / 8 / 25**. Danach ist ein contracts-Bump, der die Artikel stale
macht, ein **roter Test** statt einer stillen Falschaussage.

Implementierungshinweis: die Zahlen im Text mit einem eindeutigen, greifbaren Muster schreiben
(z. B. immer „`36` legal connection patterns"), damit der Test nicht Prosa parsen muss. Alternativ
ein Marker-Kommentar je Zahl. Die Entscheidung gehört in diesen CR, nicht in CR-GC-339 — der
Text-Sweep dort muss das gewählte Format schon benutzen.

---

## 4. Akzeptanzkriterien

- [ ] **T-0**: ein Fixture mit attributgetragenen Bindungen liefert über alle drei Oberflächen
      identische Violations + Scores. Der Test schlägt fehl, wenn jemand eine Oberfläche auf
      `JSON.parse(exportGraphJson(...))` zurückstellt (Red-first nachgewiesen).
- [ ] **T-C1**: Vorzeichenumkehr des Ziels kehrt das Vorzeichen des Top-Scores um.
- [ ] **T-C2**: nach echter Anwendung der Top-Suggestion bewegt sich die adressierte
      ℝ⁶-Komponente in Zielrichtung; mit invertiertem Ziel in die Gegenrichtung.
- [ ] **T-C3**: `MetricPolicy`-Änderung kippt ein `moduleMetrics`-Urteil auf identischem Graphen;
      `focusThreshold`-Änderung verschiebt die Fokus-Dimension bei identischen Violations.
- [ ] **T-C4**: richtungsloses Ziel und Ziel auf eine tote Dimension liefern dasselbe Ranking.
- [ ] **T-D1**: alle sechs Zahlen aus §3 stimmen; der Test benennt bei Abweichung Datei, Zeile,
      erwarteten und gefundenen Wert.
- [ ] Alle Tests **red-first** nachgewiesen (`se-test`): jeder wurde einmal aus dem *richtigen*
      Grund rot gesehen, bevor er grün geglaubt wird.
- [ ] Persistenz = Disk-Kuzu, nie `:memory:`; keine Mocks.
- [ ] `npm run build` + `npm test` grün.

**Vorbedingung:** CR-GC-338 muss geschlossen sein — dort laufen aktuell 11 Tests rot
(`testRef` → `testRefs` nach contracts 4.0.0 plus verschobene Fokus-Fixtures). Auf rotem Grund
lässt sich kein Red-first-Nachweis führen.

---

## 5. Betroffene Dateien (4)

| Datei | Inhalt |
|---|---|
| `tests/steering.measurement-path.test.ts` | T-0 |
| `tests/steering.architecture-causality.test.ts` | T-C1 · T-C2 · T-C3 · T-C4 |
| `tests/claims.conformance.test.ts` | T-D1 |
| `tests/fixtures/steering-graphs.ts` | geteilte Fixtures (Arch-Teilgraph mit MOD/FUNC/FLOW/SCHEMA, attributgetragene Bindungen) |

Die Fixture-Datei ist neu und bewusst geteilt: CR-GC-341 baut auf denselben Graphen auf, sonst
messen die beiden CRs unterschiedliche Welten.

---

## 6. Reihenfolge

1. **T-0** — ohne den sind alle folgenden Zahlen wertlos.
2. **T-C2** — der Kernbeweis; T-C1/C3/C4 fallen als Beifang derselben Fixture ab.
3. **T-D1** — direkt danach, damit der Text-Sweep aus CR-GC-339 nicht wieder driftet.

@author andreas@siglochconsulting
