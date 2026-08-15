# CR-GC-351 — `modifiability` ist ordnungsabhängig (Determinismus-Loch im ℝ⁶)

**Status:** open · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **1 + ein Sibling-CR**)
**Ziel:** die Architecture-Fitness ist eine Funktion des Graphen — und nur des Graphen.
**Herkunft:** Befund beim Bau von CR-GC-340 (T-C2). Reproduziert, nicht vermutet.

---

## 1. Root Cause

`metrics(og, {layer})` aus `@sigloch/se-optimizer` liefert für **denselben Graphen in anderer
Element-Reihenfolge** einen anderen Wert in der Komponente `modifiability`. Gemessen auf
`tests/fixtures/steering-graphs.ts`:

| Element-Reihenfolge | modifiability | übrige fünf Komponenten |
|---|---|---|
| Einfüge-Reihenfolge | 2.38281 | identisch |
| nach uid sortiert | 2.38281 | identisch |
| umgekehrt | **2.46094** | identisch |

Ursache ist die Community-Detection hinter `modifiability`: sie liefert für eine permutierte
Knotenliste eine andere Partition. `metrics()` selbst ist rein (gleiches Objekt ⇒ gleiches Ergebnis,
über beliebig viele Aufrufe geprüft) — die Abhängigkeit ist die **Reihenfolge des Inputs**.

Verschärfend: der Store gibt **keine** Reihenfolgegarantie. Drei aufeinanderfolgende `loadGraph()`
auf einem unveränderten Store liefern drei verschiedene Knotenfolgen (gemessen).

---

## 2. Impact

- **`graph_suggest` war nicht deterministisch**, entgegen der eigenen Tool-Beschreibung
  („Read-only; die Metrik rankt, das Gate urteilt", deterministisch): derselbe Kandidat bekam in
  zwei aufeinanderfolgenden Aufrufen Score **0.263** bzw. **0.000**, und gleich bewertete
  Suggestions kamen je Aufruf in anderer Rangfolge.
- **Was NICHT betroffen ist:** die fünf übrigen ℝ⁶-Komponenten, die Regelauswertung, die
  Readiness-Scores, das Gate-Urteil. Kein Verstoß wurde je falsch gemeldet.
- **Bereits entschärft** (CR-GC-340, eingecheckt): `toOntologyGraph` — der EINE Mapper, durch den
  jede abgeleitete Zahl geht — liefert seit dem kanonisch sortiert (Elemente nach id, Traces nach
  source/type/target). Damit ist jede Messung im Repo wieder reproduzierbar, und
  `tests/steering.architecture-causality.test.ts` erzwingt das.

Die Entschärfung ist eine **Konsumenten-seitige Absicherung**, keine Reparatur. Ein anderer Konsument
von `@sigloch/se-optimizer` hat sie nicht.

---

## 3. Fix-Vorschlag

**Der eigentliche Fix gehört in `@sigloch/se-optimizer`** (Sibling, Drift-Lock: nicht forken):
Community-Detection über eine kanonisch geordnete Knotenliste laufen lassen, damit `metrics()`
ordnungsinvariant ist. → **CR-SM-xxx in `sigloch-modules`**, Version-Bump, danach hier nachziehen.

Graphcode-seitig offen:
- [ ] Die Sortierung in `toOntologyGraph` bleibt bis zum Sibling-Fix — danach entscheiden, ob sie als
      Gürtel-und-Hosenträger bleibt oder entfällt (kein zweiter Sortierpfad ohne Grund).
- [ ] Ein Regressionstest, der `metrics()` direkt gegen eine permutierte Elementliste prüft — heute
      ist die Invariante nur indirekt über die Suggest-Determinismus-Tests abgesichert.

**Entscheidung, die ich brauche:** Sibling-CR jetzt aufmachen (blockiert nichts, aber ein zweiter
Konsument läuft weiter in den Bug), oder mit dem nächsten contracts/optimizer-Bump bündeln.

@author andreas@siglochconsulting
