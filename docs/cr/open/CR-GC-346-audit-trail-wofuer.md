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

**Eine** REQ hängt daran:

| uid | Inhalt |
|---|---|
| `REQ-rule-calibration` | Die Aufzeichnung erlaubt es, je Regel und je Konsument Blockade­häufigkeit und Ergebnis über die Zeit auszuwerten — die Eingangsgröße jeder Schwellen­entscheidung. |

### 2.1 Die Vorhersage-Hälfte kommt bewusst **nicht** mit

Ein zweites `REQ-prompt-prediction` (der Trail trägt die Regelidentität, damit ein Lernmechanismus
Verstöße vorhersagen kann) stand hier im ersten Entwurf und ist **gestrichen**. Entscheid
2026-08-15: Learning ist ein Zukunftsthema, `@sigloch/learning-core` wird nicht angefasst.

Die Nachmessung stützt das. graphcode bezieht aus dem Paket **genau eine Funktion**
(`projectTrajectory`, [src/emit.ts:28](../../../src/emit.ts)); alles andere — `EventBus`,
`math-utils`, rund zwanzig Interface-Typen von `Observer` bis `PublishedModels` — ist ungenutzt.
Und `trajectory.jsonl` **liest niemand**: sie wird bei jeder Mutation und jedem Preview vollständig
neu geschrieben, hat aber familienweit keinen Konsumenten; die zugehörigen USAGE-MATRIX-Zeilen
beschreiben `learning-plugin` und `.aimprove/trajectories.jsonl`, also das Vorgängerprodukt.

Eine REQ zu modellieren, deren Abnehmer nicht existiert, wäre genau die Sorte Behauptung, gegen die
CR-GC-339 antritt. Befund F1 unten bleibt trotzdem stehen — er ist gemessen und wird wahr bleiben;
er treibt hier nur nichts.

**Abgrenzung:** dieser CR modelliert den Zweck und repariert **einen** Datenpfad (F3). Er baut
keinen Lernmechanismus und fasst learning-core nicht an. graphcode liefert Evidenz, nicht Inferenz —
und `REQ-rule-calibration` braucht dafür nichts ausser `audit.jsonl`.

**Nachtrag 2026-08-15 — was hier zu weit gestrichen wurde.** Der Entscheid oben trennt zwei Dinge
nicht, die getrennt gehören: *Auswerten* und *Erfassen*. Für die Vorhersage-Anforderung und für
CR-DRAFT-GC-348 gilt er unverändert. Für das **Erfassen** des Urhebers und des auslösenden Prompts
gilt er nicht — eine Aggregation lässt sich jederzeit nachrechnen, ein nicht mitgeschriebener Prompt
ist unwiederbringlich weg. Die Aufzeichnungs-Hälfte ist deshalb als **[CR-GC-354](CR-GC-354-trail-traegt-urheber-und-prompt.md)**
wieder aufgemacht (`REQ-prompt-provenance`, dort modelliert in CR-GC-355). learning-core bleibt
unangetastet — das Akzeptanzkriterium unten gilt für 354 genauso.

---

## 3. Befunde — gemessen am echten Trail (2026-08-15, 108 Records seit 2026-07-03)

### F1 · Der Learning-Feed zerstört die Regelidentität — **notiert, geparkt** (§2.1)

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

`TrajectorySchema` liegt in learning-core. **Nicht anfassen** (§2.1) — der Befund ist festgehalten,
damit er beim Reaktivieren nicht neu erhoben werden muss, und treibt hier nichts.

**Zweitbefund aus derselben Messung, ebenfalls nur notiert:** `materializeTrajectory` schreibt den
Feed bei **jeder** Mutation und **jedem** dryRun-Preview vollständig neu
([tool-context.ts:132/:158](../../../src/tool-context.ts)) — 108 Zeilen pro Schreibvorgang,
für null Leser. Ob dieser Schreibpfad heute überhaupt laufen soll, ist eine eigene Entscheidung
(Kosten gegen Optionswert) und gehört weder in diesen CR noch in den geparkten CR-DRAFT-GC-348.

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
Nachmessung am selben Tag, wenige Stunden später: **76,9 KB von 564,7 KB = 13,6 %** — dazu F3b.

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

### F3b · Die Schwelle misst gegen ein gleitendes Fenster — sekundäre Anforderung

*(übernommen aus CR-GC-344, das dafür ersatzlos gelöscht wurde — die Ursache ist dieselbe Zeile.)*

Der Test slict auf die **letzten 50 Records** ([Zeile 226](../../../tests/audit.trail-projection.test.ts)) und
vergleicht gegen eine *absolute* Schwelle. Damit hängt das Ergebnis an der Form der letzten 50
Operationen, nicht am Trail insgesamt. Gemessen über gleitende 50er-Fenster desselben Trails:

| Fenster (letzte 50 …) | roh | projiziert | Reduktion |
|---|---|---|---|
| aktuell | 564,7 KB | 76,9 KB | **86,4 %** ❌ |
| −50 Ops | 160,4 KB | 16,5 KB | 89,7 % ✓ |
| −150 Ops | 332,5 KB | 36,4 KB | 89,1 % ✓ |

Die Zusage kippt also mit der Session-Aktivität hin und her, Bandbreite ~86–90 %; ein Batch über 28
Knoten verschiebt sie allein. **Das ist dieselbe Ursache wie F3** — Violations skalieren mit der
Batch-Breite —, aber der Aggregations-Fix beseitigt sie nicht, er verschafft ihr nur Luft (5,4 %
statt 13,6 %). Ohne Gegenmaßnahme kalibriert der Test nach jedem Fix erneut gegen eine
Momentaufnahme und ist irgendwann wieder rot, ohne dass sich an der Projektion etwas geändert hat.

**Sekundäre Anforderung zu §4.2/4.3:** die 11-%-Schwelle bleibt, aber die Kalibrierung wird
belastbar gemacht — Messwert **mit Datum und Bandbreite über die drei Fenster** im Kommentar, plus
eine trail-unabhängige Gegenprobe (synthetischer Record mit bekanntem Fett-Anteil, feste
Größenzusage). Erst die Gegenprobe schlägt zuverlässig fehl, wenn die Projektion *schlechter* wird;
der Fall am echten Trail allein nickt sonst ab, was gerade herauskommt.

### F4 · Aufbewahrung ist unentschieden

`FileAuditLog` komprimiert automatisch ab **10 MB** (`DEFAULT_COMPACT_BYTES`) und benennt die alte
Datei nach `audit-<stamp>.jsonl` um. Aktuell: **576 KB, 5,5 % der Schwelle, noch kein Archiv**. Kein
Datenverlust also — aber wenn der Trail die Evidenzbasis für Kalibrierung ist, ist Compaction
irgendwann Beweisvernichtung, und es ist bis heute nicht entschieden, was sie überleben muss.
Aufnehmen, nicht jetzt lösen (§6).

---

## 4. Umfang **dieses** CR

1. **Modell:** `UC-loop-closure` + `REQ-rule-calibration` durchs Gate anlegen, mit `compose`-Kanten
   an `SYS-graphcode` und einer `verify`-Kante auf den TEST (die REQ-mit-Test-Invariante,
   `se:author-req`). `REQ-audit-trail` bleibt, wie es ist — es beschreibt die Lesefläche korrekt;
   die neue REQ beschreibt den Zweck.
2. **F3 fixen:** `projectAuditEntries` verdichtet nicht-gatende Violations je `(ruleId, severity)`.
   Die Schwelle im Test bleibt bei 11 %, der gemessene Wert (5,4 %) steht mit Datum daneben — wie
   CR-GC-319 es vorgemacht hat.
3. **Test rot zuerst** (`se-test`): der Aggregations-Fall muss einmal aus dem richtigen Grund rot
   gesehen worden sein, und der bestehende Größen-Fall muss mit dem Fix von rot auf grün kippen —
   das ist der Nachweis, dass er den Pfad wirklich misst.
4. **F3b (sekundär):** Messdatum + Fenster-Bandbreite an die Schwelle, und ein trail-unabhängiger
   Gegenprobe-Fall. Kein Absenken der 11 % — die Schwelle bleibt, nur ihre Herkunft wird prüfbar.

**Nicht-Ziele:** kein Lernmechanismus und **keine Zeile** in `learning-core` (§2.1), keine
Kalibrierung selbst (die braucht eine Messreihe, nicht einen CR), keine Änderung an `contracts`.

---

## 5. Akzeptanzkriterien

- [ ] `UC-loop-closure` und `REQ-rule-calibration` liegen im Graphen, durchs Gate mutiert, die REQ
      mit verifizierendem TEST — kein Hand-Edit am SSOT.
- [ ] `graph_export` läuft ohne `force`; `docs/views/srs.md` führt die neuen Knoten.
- [ ] `@sigloch/learning-core` ist unverändert — `git diff` in `sigloch-modules` ist leer und die
      Range in `package.json` steht weiter auf `^0.2.0`.
- [ ] `audit_trail` Default über den **echten** Repo-Trail ≤ 11 % der Rohgröße; der gemessene Wert
      steht mit Datum im Test daneben, nicht als geschätzte Zahl.
- [ ] Ein Record mit 28 gleichartigen `info`-Violations projiziert auf **einen** Eintrag mit
      `count: 28` — die Summe bleibt, die Wiederholung geht.
- [ ] `error`-Violations bleiben wörtlich inkl. `elementId` und `message` — eine Ablehnung muss aus
      der Default-Antwort erklärbar bleiben.
- [ ] `includeCommands` / `includeRulesPassed` liefern unverändert das Volle; der Record auf Platte
      ist unangetastet (*Schreiben ist nicht Ausliefern*, CR-GC-314).
- [ ] **(F3b)** Die Schwelle trägt Messdatum **und** die Bandbreite über drei gleitende 50er-Fenster —
      nicht eine einzelne Momentaufnahme.
- [ ] **(F3b)** Ein trail-unabhängiger Fall auf synthetischem Record sichert die Zusage: er schlägt
      fehl, wenn die Projektion schlechter wird, egal wie der lokale Trail gerade aussieht.
- [ ] Red-first für beide neuen Fälle nachgewiesen.
- [ ] `npm run build` + `npm test` grün.

---

## 6. Folge-CRs — benannt, nicht begonnen

| CR | Inhalt | Status |
|---|---|---|
| **CR-GC-347** | `audit_stats` aggregiert je Regel und je Konsument (F2) | **offen** — reines graphcode, keine Fremdpakete; das Werkzeug, das die vier Analysen aus §1 gebraucht hätten |
| **CR-GC-349** | Aufbewahrungsregel für den Trail (F4) | **offen** — Entscheidung, was Compaction überleben muss; Governance, nicht Code. Noch nicht geschrieben |
| **CR-DRAFT-GC-348** | `TrajectorySchema` trägt Regelidentität (F1) | **PARKED** (§2.1) — learning-core wird nicht angefasst, solange kein Leser existiert; als Draft benannt, damit es kein umsetzbarer CR ist |
| **CR-GC-354** | `AuditEntry` trägt `sessionId`/`model`/`intent` (§2.1 Nachtrag) | **offen** — der Vertrag, damit der Prompt überhaupt erfassbar ist; graph-api-core 3.1.0, kein Drift-Lock |
| **CR-GC-355** | Der Executor stempelt Modell + Prompt im Wortlaut | **offen** — der Pfad ohne Fremd-Transkript (lokale/fremde LLMs); modelliert `REQ-prompt-provenance` |
| **CR-GC-356** | `UserPromptSubmit`-Hook liefert den Prompt im MCP-Pfad | **offen** — Claude Code / OpenCode; Hook-Mechanik statt Selbstdeklaration |

Reihenfolge: **346 → 354 → 355 → 356**, mit **347** und **349** unabhängig davon. 347 nimmt die
neuen Felder automatisch mit (`byModel` als dritte Gruppierung), sobald sie im Record stehen.
348 steht ausserhalb dieser Kette und wartet auf einen echten Konsumenten des Feeds.

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
