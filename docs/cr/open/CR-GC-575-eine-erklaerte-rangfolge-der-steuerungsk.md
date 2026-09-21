# CR-GC-575: Erst Bloat streichen, dann eine erklaerte Rangfolge der Kanaele

**Status:** ✅ Abgeschlossen 2026-09-21 — Rangfolge steht, Ausbeute gemessen, Streichen bewusst ersetzt
**Typ:** aus Item ITEM-2026-417 (idea)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-417.json (Lane: graph)

---

## 1 Befund

Wenn zwei Kanaele dasselbe adressieren, entscheidet heute verstreuter Code, welcher gewinnt:
ein Ternaer in `generate.ts` (Klausel schlaegt Template, CR-GC-564), ein Markertext in der
Injektion ("bereits eingebettet — Guide NICHT erneut aufrufen"), eine Bedingung im Executor
(`selection`, CR-GC-568), die Stagnations-Schwelle (`defer` ab 3), der Preflight (schreibt um,
bevor das Gate etwas sieht).

**Es gibt keine erklaerte Rangfolge.** Jeder Konflikt musste bisher durch einen Lauf gefunden
werden — viermal in dieser Serie.

## 1a Stand nach der Umsetzung (2026-09-21)

**Geliefert ist Prio 2, nicht Prio 1.** Die Rangfolge steht in `src/loop/channel-rank.ts`
und wird von den beiden Stellen angewandt, die sie vorher je fuer sich entschieden haben:

- `generate.ts` hatte **zwei** Ternaere vierzig Zeilen auseinander — CR-GC-564 fuer den
  Imperativ, CR-GC-566 fuer die Fokus-Typen. Dass beide denselben Gewinner waehlen, sagte
  nur ein Kommentar zu. Jetzt ist es EIN `winner(...)`-Aufruf, der beides traegt.
- `executor-prompt.ts` haengte seine Bloecke in der Reihenfolge an, in der sie historisch
  entstanden. Dadurch stand die **Anleitung (Rang 5) UNTER den Vorschlaegen (Rang 6)** —
  CR-GC-556 kam vor CR-GC-557. Jetzt sortiert `byRank(blocks)`.

`tests/channel-rank.test.ts` haelt die Ordnung, ihre Begruendungspflicht und beide
Anwendungsstellen fest; die Rueckkehr des alten Ternaers bricht ihn.

**Nicht geliefert: das Streichen.** Entscheidung 2026-09-21 (Auftraggeber): `GENERATION_TEMPLATE`
wird **demoviert statt geloescht** — es faellt auf Rang 6 und verliert jeden Konflikt gegen
eine Regel-Klausel, bleibt aber der Text fuer die fuenf Dimensionen, fuer die es **keine**
`RULE_CLAUSE` gibt (`arch`, `alloc`, `ver`, `schema`, `cr`, `ms`). Der Grund ist Kriterium 2
dieser CR selbst: CR-GC-564 hat gemessen, dass die Klausel die Vorlage **dort schlaegt, wo
beide dieselbe Arbeit beschreiben** — nicht, dass die Vorlage ueberall nichts traegt. Ein
Streichen, das die uebrigen Dimensionen auf „Behebe die Funde der Dimension." zuruecksetzt,
waere genau die ungemessene Aenderung, die diese CR verbietet. Gegenmessung dazu:
CR-GC-282, wo ein Minimal-Rendering 22 statt 82 Elemente lieferte.

**Auch der Wortlaut bleibt unveraendert.** Die Vorlage als „Vorschlag, kein Auftrag" zu
etikettieren waere eine zweite ungemessene Aenderung am Imperativ — dieselbe Klasse wie
CR-GC-565. Demoviert ist die PRAEZEDENZ im Code, nicht die Schaerfe des Satzes.

**Offen und namentlich benannt:**
1. Kriterium 3 — ein Lauf nach dem Zug, gegen das Kontrollband der Ausbeute. Nicht gefahren.
2. Prio 1 im Uebrigen: Skill-Rumpf und `graph_suggest`-Block sind weiter **ungemessen**;
   `FIX_TEMPLATES` liegt in `@sigloch/se-engine` und ist kein Zug dieses Repos.
3. Der Test „kein Kanal niedrigeren Ranges ueberschreibt einen hoeheren" ueber ALLE Kanaele
   braucht die Kanal-Knoten aus CR-GC-573; heute prueft die Abnahme die zwei Stellen, die
   die Ordnung anwenden.

---

## 2 Prio 1 — streichen, was gemessen nichts traegt

Reihenfolge nach gemessener Kosten-/Nutzenlage:

| Kanal | Beleg | Zug |
|---|---|---|
| Gate-Antwort | 70 % des Kontexts, 51 % Wiederholung, 0 blockierend | **kuerzen** (CR-GC-570) |
| `GENERATION_TEMPLATE` (8) | verliert gemessen gegen `RULE_CLAUSE` (CR-GC-564) | **streichen** |
| Skill-Rumpf je Runde | bis 4000 Zeichen, **nie gemessen** | erst messen, dann entscheiden |
| `FIX_TEMPLATES` (11) | `editSource: suggestion-template` in 14 Laeufen **0-mal** | am Handoff belegt wirkungslos; waehrend des Baus ungemessen (ITEM-2026-397) |
| `graph_suggest`-Injektionsblock | liefert selten eine Zeile mit Kante | an die Template-Messung koppeln |

Erst danach modellieren (CR-GC-573) — sonst entstehen Knoten fuer Kanaele, die weg gehoeren.

## 3 Prio 2 — die Rangfolge, die ich vorschlage

Eine Ordnung, an einer Stelle erklaert und testbar:

1. **Gate-Wahrheit (blockierend)** — was den Batch verhindert, schlaegt alles.
2. **Regel-Klausel des Fokus-Funds** — der EINE Imperativ der Runde.
3. **Grammatik** (Guide-Ausschnitt) — was legal ist.
4. **Bestand** (Element-Index) — was es schon gibt.
5. **Anleitung** (Skill-Rumpf) — wie man es gut macht.
6. **Vorschlag** (suggest/Template) — ein Kandidat, nie ein Auftrag.

Begruendung der Reihung: absteigend nach **Verbindlichkeit**. Was das Gate erzwingt, ist nicht
verhandelbar; was die Runde will, ist eine Entscheidung; Grammatik und Bestand sind Tatsachen;
Anleitung ist Qualitaet; ein Vorschlag ist eine Option. Alles andere (Fokus-Typen, `defer`,
Kandidatenzahl) ist Mechanik und gehoert dem Treiber, nicht dem Prompt.

**Der Test, der daraus folgt:** kein Kanal niedrigeren Ranges darf einen hoeheren
ueberschreiben. Das ist pruefbar, sobald die Kanaele Knoten sind (CR-GC-573).

## 4 Akzeptanzkriterien

1. Die Rangfolge steht an genau einer Stelle im Code, nicht in fuenf Bedingungen.
2. Jeder gestrichene Kanal ist mit seiner Messung begruendet, nicht mit Geschmack.
3. Ein Lauf nach dem Streichen liegt nicht unter dem Kontrollband der Ausbeute.

---

## 5 Kriterium 3 gemessen (Runde 7, 2026-09-21)

`gcrun`, sigllm-Prosa-Korpus, dieselbe `lauf-gcrun.env` wie die Bezugslaeufe:

| | Elemente | Median | Ablehnungen | Wall |
|---|---|---|---|---|
| vorher (Laeufe 3–5, CR-GC-568) | 94 / 59 / 45 | 59 | 8 / 9 / 20 | 41–55 min |
| **nach dem Zug** | 91 / 47 / 88 | **88** | 4 / 9 / 4 | 15–19 min |

Zwei von drei Laeufen im Band 68–122, der Median darin; der Ausreisser (47) hat seinen Vorgaenger
in der alten Serie (45). **Erfuellt fuer „nicht schlechter"** — eine Verbesserung der Ausbeute
tragen drei Laeufe nicht.

Offen bleibt, wie in §1a benannt: Skill-Rumpf und `graph_suggest`-Block sind ungemessen
(ITEM-2026-397 fuer die Vorlagen). Kongruenz: nicht aus dieser Session geprueft — benannte Ausnahme.
