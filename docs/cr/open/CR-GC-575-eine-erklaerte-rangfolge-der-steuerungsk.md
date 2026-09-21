# CR-GC-575: Erst Bloat streichen, dann eine erklaerte Rangfolge der Kanaele

**Status:** 🟠 Open
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
