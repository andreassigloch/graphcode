# CR-GC-635: Skill `se-umbau` — die vier Fragen, bevor etwas geloescht wird

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-519 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-519.json (Lane: code)
**Analyse:** `docs/research/referenz-change-2026-09-23.md`, Potenzial A

---

## Befund

Zwoelf Skills im Repo. **Genau einer nennt `graph_impact`** (`se-fmea`). Nach ihrem Verb sortiert:

| Anlegen (9) | Berichten (5+) | Steuern (3) |
|---|---|---|
| `se:author-req` · `se:author-uc` · `se:author-actor` · `se:top-level` · `se-conops` · `se-trade` · `se:generate` · `se:import-code` · `se:import-doc` | `se-status` · `se-review` · `se-retro` · `se-view:*` | `se:optimize` · `se:close-violations` · `se-plan` |

**Keiner deckt den Umbau ab** — aendern, ersetzen, loeschen. Dabei ist das die einzige Lage, in
der ein vergessener Impact teuer wird: ein neuer Knoten bricht nichts, ein geloeschter schon.
Und es ist die Lage, fuer die die Hausregel „keine parallelen Pfade" ueberhaupt geschrieben ist.

Gemessen am Referenz-Change (CR-GC-630/631, `rig/referenz-change/`): **0 Graph-Leseaufrufe, 45
Suchoperationen, 3 Volllaeufe.** Die Gegenprobe sagt, was die vier Fragen geantwortet haetten:
4 Testdateien statt 172, und die 20 Kanten an den zwei Knoten, deren `realRef` der Loeschzug
brach — gefunden hat sie stattdessen die Testsuite, 300 Sekunden spaeter.

## Zielbild

`.claude/commands/se-umbau.md`: ein Skill fuer die Lage „etwas Bestehendes aendern oder
entfernen", der die Reihenfolge festlegt, die der Referenz-Change teuer nachgeholt hat.

1. **Umfang benennen** — welche Knoten haengen an den Dateien? (`graph_elements`/`realRef`)
2. **`graph_impact(<uid>)` fuer jeden davon, VOR der ersten Loeschung.** Jede `satisfy`-Kante
   ist eine REQ, die gleich unerfuellt dasteht; jedes `realRef` ist ein RC-01, das sonst erst
   die VOLL-Spur meldet.
3. **`graph_tests({changeSet})`** — die Spur fahren, nicht die Suite.
4. **Der Modell-Zug gehoert in denselben CR**, durchs Gate. „Fertig" heisst kongruent oder
   benannt (CLAUDE.md).
5. **VOLL erst als Riegel**, nicht als Suchwerkzeug.

Dazu die zwei Fallen, die dieser Umbau wirklich gestellt hat:
- ein Test, der die geloeschte Datei **behauptet** (`test-selection.audit.test.ts`) — er wird
  gruen, indem die Spur still auf VOLL zurueckfaellt;
- der naheliegende Ersatz fuer geloeschte Aufrufer ist oft **selbst ein zweiter Pfad**
  (CR-GC-632).

## Das eigentliche Risiko: ein Skill ohne Ausloeser ist ein Dokument

Skills werden **vom Menschen** gerufen (`/se-umbau`). Der einzige automatische Ausloeser heute
ist `SKILL_FOR_DIMENSION` in `src/loop/generate.ts` — er ordnet einer Fokus-DIMENSION
(req/uc/arch/…) einen Skill zu. Ein Umbau ist keine Dimension, sondern eine **Lage**; der
Gate-Pfad kann ihn so nicht nennen.

Deshalb gehoert ein Ausloeser dazu, sonst ist dieser CR Papier. Zwei Kandidaten:

- **(a) `aise dispatch prepare`** druckt bereits „DEIN GATE: lies die CR-Datei(en)". Eine Zeile
  mehr — „Umbau (aendern/entfernen)? → `/se-umbau`" — trifft den Zeitpunkt vor der Arbeit.
  Billig, ausserhalb dieses Repos (bok), haengt an CR-GC-636.
- **(b) `SKILL_FOR_DIMENSION` um eine Lage erweitern.** Groesser: der Gate-Pfad muesste einen
  Umbau erkennen (z. B. `delete-node`/`delete-edge` im Batch oder ein `workOrder` mit `moves`).
  Interessant, weil das Signal schon da ist — `workOrder.moves` war in diesem Umbau gefuellt.

**Empfehlung: (a) in diesem CR, (b) als eigenes Item.** (b) ohne Messung zu bauen hiesse, ein
Verhalten zu erraten.

## Umfang

| Datei | Zug |
|---|---|
| `.claude/commands/se-umbau.md` | NEU |
| `tests/skill-rule-ids.test.ts` | der neue Skill faellt unter die Regel-ID-Pruefung |
| `docs/graph/` | SKILL/FUNC-Knoten, falls Skills modelliert sind — vor dem Zug pruefen |

## Abnahme — am Rig, nicht als Behauptung

Die Zusage dieses CR ist eine Verhaltensaenderung, und dafuer gibt es seit CR-GC-633 ein
Messgeraet. Der Beleg ist ein zweiter Lauf des Referenz-Changes **mit** dem Skill, gemessen mit
`rig/referenz-change/messen.mjs`:

1. **≥ 1 Graph-Leseaufruf vor der ersten Loeschung** (Grundlinie: 0).
2. **≤ 1 Volllauf** (Grundlinie: 3).
3. RC-01 wird vor der VOLL-Spur bemerkt, nicht von ihr.

Wird 1. oder 2. verfehlt, ist der Skill nicht der Fix, und der CR sagt das statt sich gruen zu
schreiben. Der Lauf kostet echtes Geld — er gehoert beauftragt, nicht nebenbei gefahren.
