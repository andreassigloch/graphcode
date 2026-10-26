---
name: se:constraints
version: 4
description: Constraints (CREATE) — je Dimension nach Element und Eigenschaft fragen und die Antwort als nicht-funktionale REQ an Kette, Modul oder System schreiben, mit einem TEST, der den Snapshot liest. Nur architektur-bestimmende Constraints, nie ein Gewicht. Vor dem ersten Schnitt (se:top-level) oder wenn der Autor eine Entscheidung festhalten will.
---

# se:constraints — eine Entscheidung des Autors als Anforderung mit Test

## Wofür dieser Skill da ist

Ein **Constraint** ist eine nicht-funktionale Anforderung an eine Kette (`FCHAIN`), ein Modul (`MOD`)
oder das System (`SYS`), mit einem TEST, der sie verifiziert (CR-GC-804). Die Testdatei liest den
committeten Snapshot (`docs/graph/<name>.graph.json`) und prüft die Eigenschaft am Modell: Kanten,
Allokation, Eingänge. Der Test ist das Messinstrument; ein Attribut, das jemand nachpflegen muss, gibt es nicht.

**Die Grammatik** (`R-18`, am Gate ein Fehler): eine FUNC erfüllt keine nicht-funktionale Anforderung.
Betrifft der Constraint eine Funktion, hängt er an der Kette, die sie enthält; der Test prüft weiter die
Funktion. Vorbild: `REQ-ein-schreibweg` an `FCHAIN-apply-gate`, geprüft werden die Eingänge von
`FUNC-graph-store` (CR-GC-851, `tests/constraint-ein-schreibweg.test.ts`).

**Architektur-bestimmend** ist ein Constraint, wenn ein Zug am Modell ihn brechen kann, ohne dass sich
Code-Verhalten ändert: eine Funktion verschieben, einen Fluss anlegen, ein Modul teilen. Nur solche nimmt
dieser Skill auf. Eine Anforderung an das Verhalten im Lauf (Antwortzeit gemessen, Fehlerrate) schreibst
du mit `se:author-req` ohne diesen Skill.

Gewichte und Zielwerte gibt es nicht mehr (CR-GC-853). Eine Kennzahl ohne Adressat kann das Gate nicht
prüfen und der Autor nicht beantworten. Kennzahlen finden, Constraints steuern.

---

## 1. Umfang lesen

```
graph_elements({ type: "FCHAIN" })              # die Ketten
graph_metrics()                                 # modules, chains, functions
graph_metrics({ constraintCarriers: true })     # die Constraints, die schon stehen
```

Aus `graph_metrics` liest du je Modul `allocatedFuncs`, `fanIn` und `uphillDependencies`, je Kette
`answerPath` und `moduleBoundaries`. Die Constraints, die schon stehen, nennt `constraintCarriers` mit
`reqId` und `by`. Frage nicht nach etwas, das schon steht.

## 2. Je Dimension fragen

Die Frage bleibt je Dimension. Die Antwort nennt ein **Element** und eine **Eigenschaft**, nie eine Zahl
für die Dimension selbst. Jede Antwortform nennt ihre Prüffunktion aus `@sigloch/graphcode/constraints`,
wo es eine gibt.

| Dimension | Frage | Antwort-Beispiel | an | Prüfung am Snapshot | Prüffunktion |
|---|---|---|---|---|---|
| Änderbarkeit | Was muss sich ändern lassen, ohne anderes anzufassen? | „kernel kennt keinen Client" | SYS, MOD | kein Fluss gegen die Schichtordnung (`uphillDependencies`) | fehlt — über `se:author-req`, der Test schreibt die Prüfung |
| Zusammenhalt | Was gehört zusammen? | „Kette X liegt in einem Modul" | FCHAIN | alle Glieder in einem MOD (`moduleBoundaries`) | fehlt — über `se:author-req`, der Test schreibt die Prüfung |
| kurze Wege | Was muss schnell beim Akteur sein? | „Antwortweg von X ≤ n Glieder" | FCHAIN | Länge des Antwortwegs (`answerPath`) | fehlt — über `se:author-req`, der Test schreibt die Prüfung |
| Fehlertoleranz | Was muss weiterlaufen, wenn ein Teil ausfällt? | „Fluss f ist async" | FCHAIN | Merkmal `sync` am Fluss in der Kette, Weg ohne das Teil | fehlt — über `se:author-req`, der Test schreibt die Prüfung |
| Größe | Wie groß darf ein Teil werden? | „Modul ≤ 9 Funktionen" | MOD | Zahl der allocate-Kanten (`allocatedFuncs`) | fehlt — über `se:author-req`, der Test schreibt die Prüfung |
| Engpass | Wo darf kein Engpass sein, wo ist einer gewollt? | „Zugang zum kernel nur über fünf Verträge" | MOD | Eingänge, Abnehmer (`fanIn`) | fehlt — über `se:author-req`, der Test schreibt die Prüfung |
| Schutz | Was ist geschützt? | „Modul gesichert: Zugang nur über f" / „Ein Schreibweg" | MOD, FCHAIN | Eingänge aus der erlaubten Liste | `constraints.eingaengeNurAus` |

Je Antwort prüfst du das Kriterium: kann ein Zug am Modell sie brechen, ohne dass sich Code-Verhalten
ändert? Nein → kein Constraint dieses Skills; sag es und biete `se:author-req` an.

## 3. Konflikte beim Setzen

Drei Paare ziehen gegeneinander. Setzt der Autor beide Seiten, warnst du beim Setzen, mit dem Grund.
Du blockst nicht: ein bewusster Zielkonflikt ist legitim, ein unsichtbarer nicht.

- **Zusammenhalt ↔ kurze Wege** — eine Kette in einem Modul hält die Glieder beisammen; ein kurzer Weg
  zum Akteur verlangt oft ein Glied an der Modulgrenze.
- **Zusammenhalt ↔ Engpass** — ein straffer Schnitt braucht meist einen Übergang, durch den alles läuft;
  genau der ist der Engpass.
- **Schutz ↔ kurze Wege** — „Zugang nur über f" legt f in jeden Weg; jeder Weg wird um ein Glied länger.

Ob zwei Constraints sich wirklich ausschließen, zeigt erst die Test-Lane: kein Zug macht beide Tests grün.
Vorab berechnen lässt sich das nicht. Die Analyse dazu ist `se:optimize` auf Anforderung.

## 4. Schreiben: REQ und TEST in einem Batch

Über `se:author-req`, `dryRun: true` zuerst, mit der `baseVersion` deines letzten Lesens:

```
## Nodes
### REQ
+ REQ-<constraint>|<was gilt, in einem Satz> [__name:<Name>]
@kinds ["non-functional"]
### TEST
+ TEST-constraint-<constraint>|<was die Datei am Snapshot prüft> [__name:<Name>]
@testRefs [{"file":"tests/constraint-<constraint>.test.ts","tool":"vitest","level":"conformance"}]

## Edges
+ FCHAIN-<kette> -satisfy-> REQ-<constraint>
+ TEST-constraint-<constraint> -verify-> REQ-<constraint>
```

Der Adressat ist `FCHAIN`, `MOD` oder `SYS`, wie die Tabelle ihn nennt. Die Testdatei:

- liest den Snapshot und prüft die Eigenschaft, mit der Prüffunktion aus der Tabelle, wo es eine gibt
  (`import { eingaengeNurAus } from '@sigloch/graphcode/constraints'`, Vorbild
  `tests/constraint-ein-schreibweg.test.ts`);
- schreibt die Prüfung selbst, wo die Tabelle „fehlt" sagt. Lies dafür das Modell, rechne nicht nach,
  was contracts schon misst (`moduleMetrics`, `chainMetrics`). Braucht ein zweites Repo dieselbe
  Prüfung, wird sie ein Item für `@sigloch/graphcode/constraints`;
- trägt eine Positivkontrolle: eine Kopie des Snapshots mit dem brechenden Zug ist rot und nennt, was bricht.

Ein Test, der den Snapshot liest, fällt in graphcode unter das Muster `graph.json` in
`scripts/model-test-set.mjs`; `tests/verify-model.completeness.test.ts` zwingt ihn in den Satz der
Modell-Lane. Eine REQ ohne Erfüller meldet `RD-01`, ohne verifizierenden TEST `R-01`.

## 5. Herunterdeklinieren

Ein Constraint oben wandert in seine funktionalen Teile auf die tiefste Ebene. Das ist nicht dieser Skill:
`se-vorbereitung` §2 liest die Träger aus `graph_metrics({ constraintCarriers: true })` und ordnet jeden
Constraint einer der vier Klassen zu (Tieferlegen, Zerlegen, Funktion fehlt, Gilt quer).

## Abschluss-Prüfliste

- [ ] je Antwort ein Element und eine Eigenschaft, nie eine Zahl für die Dimension
- [ ] je Antwort das Kriterium geprüft: ein Zug am Modell kann sie brechen, ohne dass sich Code ändert
- [ ] jeder Adressat ist FCHAIN, MOD oder SYS
- [ ] je Konfliktpaar, dessen beide Seiten gesetzt sind, die Warnung gezeigt
- [ ] REQ und TEST in einem Batch durch `graph_mutate`, `dryRun: true` zuerst
- [ ] jede Testdatei mit Positivkontrolle
