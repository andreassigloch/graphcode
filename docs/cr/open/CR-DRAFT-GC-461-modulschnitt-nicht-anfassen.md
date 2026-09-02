# CR-DRAFT-GC-461 — Der Modulschnitt ist nicht das Problem (Messung, kein Umbau)

**Status:** draft — Befund + Entscheidungsvorlage, kein Implementierungs-CR
**Angelegt:** 2026-09-02
**Ausgelöst durch:** CR-GC-459 (Blockschnitt), offene Frage „lohnt der Modulschnitt gegen die Story-Blöcke?"

## Ergebnis in einem Satz

**Nein.** Die Kohäsionswerte (0,10–0,27) und die CR-01/R-04-Warnungen entstehen nicht durch einen
schlechten Modulschnitt, sondern durch das Apply-Gate — und das ist eine verriegelte Zusage.
Dateien zu verschieben würde nichts einbringen.

## Die Simulation

Drei Gruppierungen, gleiche Rechnung (`io`-Pfad FUNC→FLOW→FUNC, distinkte SCHEMA je Grenze):

| | Gruppen | interne Flüsse | **Anteil intern** | Verträge je Grenzpaar |
|---|---:|---:|---:|---:|
| **A** heutiger Schichtschnitt (`kernel`/`projections`/`surface`/`loop`/`agent-surface`) | 5 | 19 | **50 %** | 4,9 |
| **B** die 4 Story-Blöcke als Module | 4 | 19 | **50 %** | 5,5 |
| **C** die 18 Ebene-1-Blöcke als Module | 18 | 16 | 42 % | 1,8 |

**Die naheliegende Kennzahl trügt.** B hat in Summe 33 kreuzende Verträge gegen 49 bei A — das sieht
nach −33 % aus und ist reine Gruppenarithmetik: vier Gruppen haben weniger Grenzpaare als fünf, also
verteilen sich *dieselben* Kreuzungen auf weniger Paare. Group-count-unabhängig gemessen sind beide
Schnitte **identisch bei 50 %**, und pro Grenze ist B sogar schlechter. Von den 19 intern gehaltenen
Flüssen sind **17 in beiden Schnitten dieselben**; nur zwei tauschen die Seite.

C zeigt die Gegenrichtung: feiner schneiden macht es klar schlechter (42 %, 17 Paare über der
CR-01-Schwelle statt 6 bzw. 9).

## Warum jeder Schnitt bei 50 % landet

Drei Flüsse tragen **17 von 34 Grenzüberschreitungen — die Hälfte**. Die übrigen 16 kreuzenden
Flüsse überspannen je genau **eine** Grenze, also das unauffällige Minimum.

| Fluss | überspannte Grenzen | Produzenten → Konsumenten (Blockebene) |
|---|---:|---|
| `Graph-State` | 6 | Grounding, Betrieb, Führung → Grounding, Optimierung, Führung |
| `Mutate-Command` | 6 | Führung, Optimierung, Betrieb → Betrieb, Grounding, Führung |
| `Gate-Verdikt` | 5 | Grounding, Betrieb → Grounding, Optimierung, Betrieb, Führung |

Das ist `Mutate-Command → Gate-Verdikt → Graph-State`: **der Apply-Gate-Pfad**. `CLAUDE.md`:

> **One Apply-Gate = `mutate()`** — every edit (human *or* AI) goes through the same gate

Jeder Block schreibt durch dasselbe Gate und liest denselben Graphen. Diese drei Flüsse verbinden
notwendig alles mit allem, unter *jedem* Schnitt. Ein Hub, der die Kernzusage des Produkts ist, ist
kein Kopplungsdefekt.

## Der zweite Befund: CR-01 rät falsch

CR-01 feuert an jeder Modulgrenze mit ≥3 kreuzenden Verträgen und schlägt vor:

> „Reduce coupling between modules or **introduce a mediator**"

Der Mediator **ist bereits da** — das Gate. Die Regel zählt Verträge und kann nicht sehen, dass der
Hub die verriegelte Architektur ist. Ergebnis: neun Dauer-Warnungen, die nichts bedeuten, und ein
Fix-Hinweis, dessen Befolgung einen zweiten Schreibpfad bauen würde — genau das, was `CLAUDE.md`
als „keine parallelen Pfade" verbietet.

Dieselbe Klasse wie [`CR-DRAFT-GC-460`](CR-DRAFT-GC-460-fitness-bestraft-abstraktionsebenen.md):
**die Messebene sieht die Absicht nicht.** Dort bestraft die Fitness den vorgeschriebenen
Ebenen-Einzug, hier bestraft eine Regel das verriegelte Gate.

## Optionen (nicht entschieden)

| | Ansatz | Bemerkung |
|---|---|---|
| **A** | Flüsse als `architectural: true` markierbar machen; CR-01 zählt sie nicht mit | zielgenau, braucht ein Attribut im Meta-Modell → Familie-Review (Drift-Lock L1) |
| **B** | CR-01 auf Verträge **ohne** den Gate-Pfad einschränken (die drei Flüsse hart ausnehmen) | billig, aber eine Sonderregel mit hartkodierten uids — riecht |
| **C** | Nichts ändern, den Fix-Hinweis korrigieren: „oder der Mediator existiert bereits — dann ist diese Warnung erwartbar" | ehrlichster kleiner Schritt; die Warnung bleibt Rauschen |

Empfehlung: **A**, weil es die Frage stellt, die zählt („ist dieser Fluss Architektur oder Zufall?"),
und weil ein markierter Fluss auch für die Fitness-Frage aus CR-DRAFT-GC-460 nützlich wäre.

## Entscheidung, die dieser Draft festhält

**Kein Modulumbau.** `MOD-surface` (23 FUNCs, LCOM4=6) und `MOD-agent-surface` (29) bleiben, bis es
einen anderen Grund als die Kopplungszahlen gibt. Die Größenwarnungen (R-04, RD-04) sind davon
unberührt und wären mit einer *Ebene innerhalb* des Moduls zu beantworten, nicht mit einem anderen
Schnitt — was wiederum an CR-DRAFT-GC-460 hängt.

---

## Zur Familie getragen

Beide Befunde liegen als **`CR-SM-279` — „Die Messebene sieht die Absicht nicht"** im
sigloch-modules-Repo (`docs/cr/open/`), mit der gemeinsamen Klammer, dem Vorschlag
(`architectural: true` auf FLOW/FUNC, L1 + L2) und den vier Punkten, die vor einer Entscheidung zu
klären sind. Die Datei ist dort **abgelegt, aber nicht committet**: das Repo trug zum Zeitpunkt der
Ablage fremde uncommittete Arbeit (`.mcp.json`, `GRAPHCODE.md`, `package.json`), und ein Commit
hätte sie mitgenommen.
