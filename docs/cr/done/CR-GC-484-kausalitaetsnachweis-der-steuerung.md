# CR-GC-484 — der Kausalitätsnachweis der Steuerung

**Status:** erledigt 2026-09-07 · **Angelegt:** 2026-09-07
**Herkunft:** CR-GC-483 §6. Auftraggeber: „cr 484 brauchen wir."

## 1. Root Cause

`tests/steering.architecture-causality.test.ts` war der Kausalitätsnachweis des ℝ⁶ — T-C1 „the
target direction reaches the ranking", T-C2 „an applied suggestion moves ℝ⁶", T-C4 Placebo. Zwei
Dinge waren mit ihr passiert:

1. Sie war **10 von 12 rot, schon vor dieser Sitzung.** Der Nachweis hatte längst aufgehört zu
   halten, und niemand hat es gesehen — weil `npm test` an der Wurzel dauerhaft rot war
   (CR-SM-290) und graphcodes Suite 18 rote Dateien trägt.
2. Seit CR-GC-483 prüfte sie zusätzlich einen **gelöschten** Vertrag: das Eingabefeld `target`
   gibt es nicht mehr.

Eine rote Datei ist schlecht; eine rote Datei, die einen nicht mehr existierenden Vertrag prüft,
ist irreführend.

## 2. Was

Ersetzt durch den Nachweis für den Chebyshev-Score, gleiche Methode (A/B über **eine**
Stellgröße, behauptet wird die Differenz und ihr Vorzeichen, nie ein absoluter Score). Datei
umbenannt: `tests/steering.steer-causality.test.ts`.

| | prüft |
|---|---|
| **T-S1** | Die publizierte `score` **ist** die Chebyshev-Verbesserung des Gate-Advisorys; die Rangfolge folgt ihr; deterministisch. |
| **T-S2** | **Der Kern:** die vom Gate gemeldete Zahl ist die **echte** — unabhängig nachgerechnet, nicht aus derselben Quelle gelesen. Plus: das Gate rechnet mit dem **Budget des Hosts**, nicht mit dem Default. |
| **T-S3** | Das **Budget** ist die Stellgröße — sie ersetzt die Zielrichtung. Zwei Arme, ein Graph: Score 0 gegen 0,5003, und nur das enge Budget benennt `RD-04:SYS-steering`. |
| **T-C3** | Unverändert übernommen (MetricPolicy/focusThreshold als Knopf) — war und ist grün. |
| **T-S4** | Placebo: innerhalb aller Budgets ist der Score **blind**, die Rangfolge bleibt deterministisch — und `readiness` ist dort *nicht* blind. Blindheit ist dokumentiert, nicht bestanden. |

**T-S3 ist der Kern der Umstellung.** Beim ℝ⁶ war die Stellgröße ein Gewichtsvektor, den der
Nutzer setzt. Den gibt es nicht mehr: normiert wird gegen die Regelschwelle, und die ist die
einzige verbliebene Stellschraube. Ein Nachweis, der sie nicht bewegt, prüft die Steuerung nicht.

## 3. Der Defekt, den der Rot-Nachweis freigelegt hat

**`computeSteerAdvisory` las `DEFAULT_METRIC_POLICY` fest.** Ein Host, der sein Budget enger
stellt — seit CR-SM-292 die *einzige* Stellschraube der Steuerung —, hätte am Gate weiter nach
dem Default gerankt, und niemand hätte es gesehen. `policy` ist jetzt **Pflichtparameter ohne
Default**; ein Fallback wäre genau der zweite Pfad aus CR-SM-233.

Gefunden wurde er nicht durch Nachdenken, sondern weil T-S2 im ersten Entwurf **grün blieb**,
als `improvement` probeweise fest auf 0 gesetzt wurde.

## 4. Und der Test selbst war zuerst Fake-Coverage

T-S2 lief zunächst auf dem **Default**-Budget. Dort liegt die Fixture innerhalb aller Budgets,
der Score ist vorn wie hinten 0, und die Behauptung `vorher − nachher === improvement` ist
`0 === 0`. Der Test hätte jede Lüge durchgelassen — genau das Anti-Pattern aus `CLAUDE.md`
(„Tests grün, aber keiner testet die geänderte Funktion").

Zwei weitere Entwürfe bewegten nichts: ein `SYS -compose-> UC` und ein `SYS -compose-> MOD`.
RD-04 zählt an dieser Stelle den **FUNC-Wurzelwald** (CR-SM-282) — die Meldung sagt es wörtlich
(„3 root FUNC children"). Erst die vierte Wurzel-FUNC bewegt den Score. **Dass der Test das
jedes Mal gemeldet hat, ist der Beleg, dass er beisst.**

## 5. Ergebnis

**12 von 12 grün** (vorher 2 von 12). Drei Rot-Nachweise gefahren:

| Eingriff | Reaktion |
|---|---|
| `improvement` fest auf 0 | T-S2 rot |
| beide T-S3-Arme mit demselben Budget | T-S3 rot (2 von 3) |
| Gate rechnet mit `DEFAULT_METRIC_POLICY` statt mit dem Host-Budget | T-S2 rot |

## 6. Dateien (3)

`tests/steering.steer-causality.test.ts` (aus `steering.architecture-causality.test.ts`) ·
`src/kernel/measure/fit-advisory.ts` · `src/kernel/harness.ts`
