# CR-GC-351 — `modifiability` ist ordnungsabhängig (Determinismus-Loch im ℝ⁶)

**Status:** done · **Angelegt:** 2026-08-15 · **Abgeschlossen:** 2026-08-15 · **Max Files:** 6
(dieser CR: **2** + der Sibling)
**Sibling:** [CR-SM-240](../../../../sigloch-modules/docs/cr/done/CR-SM-240-community-detection-ordnungsinvariant.md)
— geliefert in `@sigloch/se-optimizer@0.5.0`.
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
Float-Summationsreihenfolge in der Betweenness — derselbe Ursprung, andere Wirkkette; der Fix an `buildAdjacency` trifft beide (§3).

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
- **Was NICHT betroffen ist:** die Regelauswertung, die Readiness-Scores, das Gate-Urteil. Kein
  Verstoß wurde je falsch gemeldet. (Die ursprüngliche Formulierung „die fünf übrigen
  ℝ⁶-Komponenten" ist durch die Nachmessung in §1 widerlegt: `coherence` wandert mit,
  `scalability` in der 15. Stelle.)
- **Bereits entschärft** (CR-GC-340, eingecheckt): `toOntologyGraph` — der EINE Mapper, durch den
  jede abgeleitete Zahl geht — liefert seit dem kanonisch sortiert (Elemente nach id, Traces nach
  source/type/target). Damit ist jede Messung im Repo wieder reproduzierbar, und
  `tests/steering.architecture-causality.test.ts` erzwingt das.

Die Entschärfung ist eine **Konsumenten-seitige Absicherung**, keine Reparatur. Ein anderer Konsument
von `@sigloch/se-optimizer` hat sie nicht. — **Seit 0.5.0 gegenstandslos:** die Reparatur sitzt an
der Quelle, jeder Konsument bekommt sie. Die Sortierung bleibt trotzdem, aus einem anderen Grund (§4).

---

## 3. Fix-Vorschlag

**Der eigentliche Fix gehört in `@sigloch/se-optimizer`** (Sibling, Drift-Lock: nicht forken):
Community-Detection über eine kanonisch geordnete Knotenliste laufen lassen, damit `metrics()`
ordnungsinvariant ist. → **[CR-SM-240](../../../../sigloch-modules/docs/cr/done/CR-SM-240-community-detection-ordnungsinvariant.md)**,
geliefert in **se-optimizer 0.5.0**. Dort steht auch die exakte Ursache: die Community-IDs sind
**Eingabe-Indizes**, und der Merge-Tie-Break (`dq > best`, strikt) hängt an ihnen — der Kommentar
„ties broken by community-id order" stimmt nur, wenn diese IDs kanonisch sind, und das sind sie nicht.

**Umgesetzt wurde eine Ebene höher als vorgeschlagen:** nicht `detectCommunities`, sondern
`buildAdjacency` kanonisiert — `degrees`/`modularityOf`/`intraEdgeFraction`/Betweenness lesen
alle dieselbe Knotenliste, fünf Konsumenten einzeln zu flicken wäre der Parallelpfad gewesen.
Nebeneffekt: die `scalability`-Float-Noise ist damit ebenfalls weg. Am graphcode-Graphen sind jetzt
**alle sechs Komponenten** über alle geprüften Permutationen bitgleich.

Graphcode-seitig erledigt:
- [x] Range auf `^0.5.0` gehoben (Caret ist auf `0.x` minor-gesperrt — `^0.4.0` zieht **kein**
      0.5.0), `npm install` löst auf 0.5.0 auf, Build grün, `npm test` 738/739 (der eine
      Fehlschlag ist vorbestehend und fremd: CR-GC-346 §3 F3).
- [x] Der Permutations-Regressionstest liegt **beim Sibling**, nicht hier: `metrics()` ist
      se-optimizer-Code, und ein zweiter Test derselben Invariante in graphcode wäre genau der
      Parallelpfad, den dieser CR bekämpft. Er prüft dort fünf Permutationen × zwei Layer × zwei
      echte Graphen.
- [x] Entscheidung zur Sortierung in `toOntologyGraph` — siehe §4.

---

## 4. Die Sortierung in `toOntologyGraph` bleibt — mit anderem Grund

Die naheliegende Antwort war „Sibling gefixt ⇒ Konsumenten-Pflaster weg" (keine parallelen Pfade).
**Gemessen ist sie falsch.** Test: Sortierung entfernt, permutierte Eingabe, 610 Violations des
Repo-Graphen —

| | mit Sortierung | ohne |
|---|---|---|
| **Menge** der Violations | identisch | identisch |
| **Reihenfolge** der Violations | identisch | **verschieden** |

Die Regeln urteilen also in beiden Fällen gleich; nur der Strom kommt anders sortiert heraus. Daran
hängen `rules_evaluate`, der Readiness-Report und der Audit-Record — die alle in Reihenfolge
ausgeben, während der Store keine Reihenfolgegarantie gibt. Die Sortierung ist damit **nicht**
redundant geworden, sie schützt seit 0.5.0 etwas anderes als vorher.

Konsequenz, damit die nächste Person nicht denselben Fehlschluss zieht:
- Der Doc-Kommentar in [`src/conformance.ts`](../../../src/conformance.ts) sagt jetzt ausdrücklich,
  **was er heute schützt** (Violation-Reihenfolge) und **was nicht mehr** (die ℝ⁶-Metriken, seit
  se-optimizer 0.5.0 an der Quelle gelöst) — samt der Bitte, ihn nicht auf der alten Begründung zu
  löschen.
- Der Grund ist **erzwungen, nicht dokumentiert**: `tests/conformance.test.ts` nagelt fest, dass
  eine permutierte Eingabe dieselbe Violation-**Sequenz** liefert. Red-first belegt — ohne die
  Sortierung fällt der Test mit `expected [ 'R-18|MS-4-mvp2', …(609) ] to deeply equal
  [ 'R-18|MS-2-coding-vv', …(609) ]`. Wird er eines Tages trivial wahr, darf die Sortierung gehen.

@author andreas@siglochconsulting
