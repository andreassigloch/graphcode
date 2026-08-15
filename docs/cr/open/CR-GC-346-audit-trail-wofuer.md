# CR-GC-346 — Der Audit-Trail: wofür er da ist

**Status:** open · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **3** + Graph)
**Ziel:** der Audit-Trail bekommt den Verwendungszweck, den er faktisch schon hat — Kalibrierung
unserer eigenen Schwellen, Regeln und Prompt-Templates — und die Datenpfade tragen ihn.
**Verwandt:** CR-GC-340/341 beweisen den **inneren** Regelkreis bei festen Stellgrößen. Dieser CR
öffnet den **äußeren**: woher die Stellgrößen kommen.

---

## 1. Problem

`REQ-audit-trail` sagt heute vollständig: *„audit_trail/audit_stats liefern Mutations-History/
Statistik."* Das ist eine Lesefläche für einen Agenten, der fragt „was ist passiert". Mehr ist nicht
modelliert.

Der nachweislich wertvollste Gebrauch des Trails ist ein anderer, und er hat schon vier CRs
erzeugt — jedes Mal von Hand mit `jq`, nie über ein Werkzeug:

| CR | Was aus dem Trail kam | Folge |
|---|---|---|
| CR-GC-284 | R-01 dominierte die Rejections aller Modelle (Haiku 26/29, Opus 17/18, devstral 10/23) | `src/preflight.ts` — Rejections deterministisch verhindert statt per Feedback repariert |
| CR-GC-286 | von 81 Rejections erreichten nur 18 das Gate | zwei unauditierte Pfade geschlossen; die Fehldiagnose „Emissions-Regime beschneidet Frontier" **widerlegt** |
| CR-GC-290 | Triade R-02/R-20/R-22 aggregiert 170/251/266 mal | `req`- und `arch`-Template korrigiert |
| CR-GC-292 | R-12 = 0 Treffer in 86 Records | CR **ohne Bau geschlossen** — die Vorbedingung war widerlegt |

Vier Mal hat der Trail eine Regel, eine Schwelle oder ein Prompt-Template verbessert, einmal davon
eine Behauptung widerlegt und einmal Arbeit gespart. Das ist ein Use Case. Er steht nirgends im
Modell, also ist keiner der Datenpfade dafür gebaut — und genau das ist unten messbar.

**Warum das jetzt dran ist.** CR-GC-340 §T-C3 macht jede Urteilsschwelle zu einem *Knopf statt
einem Literal*. Ein Knopf ohne Messreihe ist aber nur eine andere Art zu raten. Die Lücke steht
wörtlich in unserer eigenen Config:

> `"instability": null` — *„die 0.7 ist gesetzt, nicht gemessen (CR-SM-223). null heißt MESSEN,
> NICHT URTEILEN … Auf 0.7 setzen, sobald die Schwelle an echten Modulen kalibriert ist."*
> — [graphcode.config.jsonc](../../../graphcode.config.jsonc)

Diese Kalibrierung wartet auf genau die Daten, die im Trail liegen.

---

## 2. Der fehlende Use Case

```
UC-loop-closure — "Der Regelbetreiber kalibriert Schwellen und Prompts am Trail"

Als Betreiber des Regelwerks will ich aus den aufgezeichneten Gate-Entscheidungen ablesen,
welche Regel wie oft und bei wem blockt, damit ich Schwellen und Prompt-Templates an
Messwerten justiere statt an Vermutungen.
```

Zwei REQ hängen daran — die zwei Hälften, die der Nutzer benannt hat:

| uid | Inhalt |
|---|---|
| `REQ-rule-calibration` | Die Aufzeichnung erlaubt es, je Regel und je Konsument Blockade­häufigkeit und Ergebnis über die Zeit auszuwerten — die Eingangsgröße jeder Schwellen­entscheidung. |
| `REQ-prompt-prediction` | Die Aufzeichnung trägt die **Regelidentität** jeder Entscheidung, positiv wie negativ, sodass ein Lernmechanismus vorhersagen kann, welche Regeln ein Kandidat verletzen wird, bevor er ans Gate geht. |

`REQ-prompt-prediction` ist keine Neuerfindung: CR-GC-314 hat `rulesPassed` genau mit dieser
Begründung eingeführt — *„Ein Lernmechanismus kann mit der ersten Aussage arbeiten und mit der
zweiten gar nicht."* Das Feld existiert. Der Use Case dazu nicht, und Befund F1 zeigt, was daraus
folgt.

**Abgrenzung, damit der Umfang nicht zerläuft:** dieser CR modelliert den Zweck und repariert die
Datenpfade. Er baut **keinen** Lernmechanismus — der ist `@sigloch/learning-core`s Sache. graphcode
liefert Evidenz, nicht Inferenz.

---

## 3. Befunde — gemessen am echten Trail (2026-08-15, 108 Records seit 2026-07-03)

### F1 · Der Learning-Feed zerstört die Regelidentität — **der schwerste**

`trajectory.jsonl` ist das eine Artefakt, das ausdrücklich für einen Lernmechanismus existiert
(CR-GC-252). `projectTrajectory` in `@sigloch/learning-core` reduziert die Violations auf **drei
Ganzzahlen**:

```js
violations: { error: n, warning: n, info: n }
```

Keine `ruleId`, kein `elementId`, kein `rulesPassed`, keine `rulesetVersion` — obwohl der
Audit-Record alle vier trägt. Ein Konsument des Feeds kann nicht sagen, **welche** Regel abgelehnt
hat. Keine der vier Analysen aus §1 wäre auf diesem Feed möglich gewesen; alle vier liefen auf
`audit.jsonl` von Hand.

`TrajectorySchema` liegt in learning-core → Familie-Review + Version-Bump. **Nicht in diesem CR**,
siehe §6.

### F2 · `audit_stats` liefert vier Zahlen

```ts
{ totalEntries, applied, rejected, graphVersion }
```

Die Tabelle, auf der CR-GC-284 ruht — Rejections je Regel × je Konsument — kann kein Werkzeug
erzeugen. Von Hand ist sie eine `jq`-Zeile; auf dem aktuellen Trail:

| Regel | Rejections | | Konsument | Rejections |
|---|---|---|---|---|
| R-29 | 16 | | mcp-client | 4 |
| SCHEMA-01 | 8 | | cr-gc-334 | 1 |
| R-08 | 2 | | cr-gc-311 | 1 |
| OCC | 2 | | (4 weitere) | je 1 |

Die 16 R-29 sind der `testRefs`-Migrationsversuch von heute (CR-GC-338) — der Regelkreis im
Kleinen, nur eben ohne Werkzeug.

### F3 · Die Projektion behält jede Violation wörtlich — **heute rot**

[`tests/audit.trail-projection.test.ts`](../../../tests/audit.trail-projection.test.ts) fällt seit
heute: die Default-Antwort ist **61,8 KB von 387,7 KB = 15,9 %**, gefordert sind ≤ 11 %.

Ursache: CR-GC-319 wirft `commands` und `rulesPassed` weg, behält aber **jede** Violation wörtlich —
auch nicht-gatende `info`. Violations skalieren mit der Batch-Breite **genauso** wie Kommandos: ein
Batch über 28 Knoten erzeugt 28 VR-01-Infos. Drei solche Records von heute tragen 40,3 KB der 61,8 KB
projizierten Ausgabe.

Die Schwelle anzuheben wäre der Symptom-Fix. Der Wurzelfix ist derselbe Gedanke wie CR-GC-319: das
Ereignis ausliefern, nicht das Volumen.

**Vorschlag, am echten Trail nachgerechnet** (letzte 50 Records, dieselbe Grundmenge wie der Test):
`error`-Violations bleiben wörtlich — sie erklären die Ablehnung. `warning`/`info` werden je
`(ruleId, severity)` zu `{ ruleId, severity, count }` verdichtet.

| | Größe | Anteil |
|---|---|---|
| roh | 386,3 KB | 100 % |
| heute | 62,4 KB | 16,2 % |
| Vorschlag | **21,0 KB** | **5,4 %** |
| Schwelle 11 % | 42,5 KB | — |

*(Die „heute"-Zeile ist eine Nachbildung der Projektion außerhalb des Tools und landet mit 62,4 KB
innerhalb eines Prozentpunkts der 61,8 KB, die das Tool selbst meldet — die Rechnung bildet den
echten Pfad ab.)*

Kein stiller Cap: die Anzahl bleibt vollständig, nur die Wiederholung der Prosa entfällt. Die
`elementId`s stehen unverkürzt im Record auf Platte, und für den lebenden Graphen liefert sie
`rules_get_violations`.

### F4 · Aufbewahrung ist unentschieden

`FileAuditLog` komprimiert automatisch ab **10 MB** (`DEFAULT_COMPACT_BYTES`) und benennt die alte
Datei nach `audit-<stamp>.jsonl` um. Aktuell: **576 KB, 5,5 % der Schwelle, noch kein Archiv**. Kein
Datenverlust also — aber wenn der Trail die Evidenzbasis für Kalibrierung ist, ist Compaction
irgendwann Beweisvernichtung, und es ist bis heute nicht entschieden, was sie überleben muss.
Aufnehmen, nicht jetzt lösen (§6).

---

## 4. Umfang **dieses** CR

1. **Modell:** `UC-loop-closure` + `REQ-rule-calibration` + `REQ-prompt-prediction` durchs Gate
   anlegen, mit `compose`-Kanten an `SYS-graphcode` und `verify`-Kanten auf ihre TESTs (die
   REQ-mit-Test-Invariante, `se:author-req`). `REQ-audit-trail` bleibt, wie es ist — es beschreibt
   die Lesefläche korrekt; die neuen REQ beschreiben den Zweck.
2. **F3 fixen:** `projectAuditEntries` verdichtet nicht-gatende Violations je `(ruleId, severity)`.
   Die Schwelle im Test bleibt bei 11 %, der gemessene Wert (5,4 %) steht mit Datum daneben — wie
   CR-GC-319 es vorgemacht hat.
3. **Test rot zuerst** (`se-test`): der Aggregations-Fall muss einmal aus dem richtigen Grund rot
   gesehen worden sein, und der bestehende Größen-Fall muss mit dem Fix von rot auf grün kippen —
   das ist der Nachweis, dass er den Pfad wirklich misst.

**Nicht-Ziele:** kein Lernmechanismus, keine Kalibrierung selbst (die braucht eine Messreihe, nicht
einen CR), keine Änderung an `learning-core` oder `contracts`.

---

## 5. Akzeptanzkriterien

- [ ] `UC-loop-closure`, `REQ-rule-calibration`, `REQ-prompt-prediction` liegen im Graphen, durchs
      Gate mutiert, jede REQ mit verifizierendem TEST — kein Hand-Edit am SSOT.
- [ ] `graph_export` läuft ohne `force`; `docs/views/srs.md` führt die drei neuen Knoten.
- [ ] `audit_trail` Default über den **echten** Repo-Trail ≤ 11 % der Rohgröße; der gemessene Wert
      steht mit Datum im Test daneben, nicht als geschätzte Zahl.
- [ ] Ein Record mit 28 gleichartigen `info`-Violations projiziert auf **einen** Eintrag mit
      `count: 28` — die Summe bleibt, die Wiederholung geht.
- [ ] `error`-Violations bleiben wörtlich inkl. `elementId` und `message` — eine Ablehnung muss aus
      der Default-Antwort erklärbar bleiben.
- [ ] `includeCommands` / `includeRulesPassed` liefern unverändert das Volle; der Record auf Platte
      ist unangetastet (*Schreiben ist nicht Ausliefern*, CR-GC-314).
- [ ] Red-first für beide neuen Fälle nachgewiesen.
- [ ] `npm run build` + `npm test` grün.

---

## 6. Folge-CRs — benannt, nicht begonnen

| CR | Inhalt | Warum nicht hier |
|---|---|---|
| **CR-GC-347** | `audit_stats` aggregiert je Regel und je Konsument (F2) | eigenes Tool-Schema; erst sinnvoll, wenn der Zweck im Modell steht |
| **CR-GC-348** | `TrajectorySchema` trägt Regelidentität + `rulesetVersion` (F1) | `@sigloch/learning-core` → Familie-Review + Publish + Range-Anhebung (Drift-Lock **L1**, *format stable*) |
| **CR-GC-349** | Aufbewahrungsregel für den Trail (F4) | Entscheidung, was Compaction überleben muss — Governance, nicht Code |

Reihenfolge: 346 → 348 (die Regelidentität ist die Voraussetzung für alles Lernen) → 347 → 349.

---

## 7. Verhältnis zu CR-GC-340 / 341

```
        ┌──────────────── äußerer Loop (CR-GC-346 ff., heute NICHT modelliert) ────────────────┐
        │                                                                                      │
        ▼                                                                                      │
   Stellgrößen ──► REGLER ──► AKTOR (LLM) ──► STRECKE (Graph) ──► Gate-Entscheidung ──► Audit-Trail
   MetricPolicy    deterministisch                                                       (Evidenz)
   focusThreshold
   Prompt-Templates
        ▲
        └── CR-GC-340/341 beweisen DIESEN Pfad — bei festen Stellgrößen
```

CR-GC-340/341 zeigen: eine Änderung der Stellgröße bewegt den Graphen in die gesteuerte Richtung.
Sie sagen nichts darüber, **ob die Stellgröße richtig steht** — das ist Absicht, und CR-GC-340 §2.2
begründet sie sauber (Differenztest statt Absolut-Assertion). Der äußere Loop ist die andere Frage,
und ohne ihn bleibt jede Schwelle eine Setzung.

Reihenfolge zu 340/341: **unabhängig**. Dieser CR fasst weder Fixtures noch Steuerungscode an; die
einzige Berührung ist inhaltlich (F3 ist der Testpfad, den 340 T-0 absichern will) und in beide
Richtungen konfliktfrei.

---

## 8. Betroffene Dateien (3 + Graph)

| Datei | Änderung |
|---|---|
| `src/tools/report.ts` | `projectAuditEntries`: nicht-gatende Violations je `(ruleId, severity)` verdichten |
| `tests/audit.trail-projection.test.ts` | Aggregations-Fall + Größenanspruch am echten Trail nachgemessen |
| `docs/cr/open/CR-GC-346-audit-trail-wofuer.md` | dieser CR |
| Graph (via Gate) | `UC-loop-closure` + zwei REQ + TESTs + Kanten |

@author andreas@siglochconsulting
