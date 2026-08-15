# CR-GC-351 — `modifiability` ist ordnungsabhängig (Determinismus-Loch im ℝ⁶)

**Status:** open · **blockiert auf** [CR-SM-240](../../../../sigloch-modules/docs/cr/open/CR-SM-240-community-detection-ordnungsinvariant.md)
(angelegt 2026-08-15) · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **1**)
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

**Korrektur 2026-08-15 (Nachmessung am echten Graphen, beim Anlegen von CR-SM-240).** Die Spalte
„übrige fünf identisch" gilt **nur für diese kleine Fixture**. Auf `docs/graph/graphcode.graph.json`
(522 Elemente / 1151 Traces) wandert **auch `coherence`**:

| Layer | Reihenfolge | modifiability | coherence |
|---|---|---|---|
| arch | Einfüge / nach id | 3.2912558 | 4.0995261 |
| arch | **umgekehrt** | **3.2689068** | **4.1469194** |
| all | Einfüge | 3.2226816 | 3.8022648 |
| all | **umgekehrt** | **3.2362809** | **3.8153310** |

Beide sitzen auf derselben Partition (`metrics.ts:105–111`: `modularityOf` bzw.
`intraEdgeFraction`, je über `detectCommunities`), also war „nur modifiability" von Anfang an ein
Fixture-Artefakt, kein Befund. `scalability` differiert zusätzlich in der 15. Stelle — das ist
Float-Summationsreihenfolge in der Betweenness, ein anderer Befund (CR-SM-240 §6).

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
ordnungsinvariant ist. → **[CR-SM-240](../../../../sigloch-modules/docs/cr/open/CR-SM-240-community-detection-ordnungsinvariant.md)**,
angelegt 2026-08-15 (se-optimizer 0.4.0 → 0.5.0). Dort steht auch die exakte Ursache: die
Community-IDs sind **Eingabe-Indizes**, und der Merge-Tie-Break (`dq > best`, strikt) hängt an
ihnen — der Kommentar „ties broken by community-id order" stimmt nur, wenn diese IDs kanonisch
sind, und das sind sie nicht.

Graphcode-seitig offen, **nachdem** 0.5.0 draußen ist:
- [ ] Range auf `^0.5.0` heben (Caret ist auf `0.x` minor-gesperrt — `^0.4.0` zieht **kein** 0.5.0),
      `npm install`, Build + Tests.
- [ ] Dann entscheiden, ob die Sortierung in `toOntologyGraph` als Gürtel-und-Hosenträger bleibt
      oder entfällt (kein zweiter Sortierpfad ohne Grund).
- [ ] Ein Regressionstest, der `metrics()` direkt gegen eine permutierte Elementliste prüft — heute
      ist die Invariante nur indirekt über die Suggest-Determinismus-Tests abgesichert.

@author andreas@siglochconsulting
