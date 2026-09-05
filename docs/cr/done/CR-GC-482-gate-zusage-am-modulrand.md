# CR-GC-482 — Die Gate-Zusage steht an den Ketten, nicht an den Modulen

**Status:** ERLEDIGT 2026-09-05 (graphVersion 240 → 241, `auto-apply`) · **Angelegt:** 2026-09-05
**Herkunft:** Redirect aus dem Smeagol-Verdikt zu **CR-SM-279** (sigloch-modules,
`docs/cr/done/`, abgelehnt 2026-09-03). Dort reißt Gate 3; die Begründung endet mit: *„die
fehlende Aussage ist eine `MOD -satisfy-> REQ`-Kante an den Modulen des Gate-Pfads, und die ist
heute schon grammatikkonform. Erst modellieren, dann ist messbar, ob CR-01 das lesen soll."*
**Betrifft:** nur den Graphen (`docs/graph/graphcode.graph.json` über das Gate). Kein Code.
**Locks:** keiner. `MOD -satisfy-> REQ` mit strukturellen Kinds ist ein bestehendes Pattern.

---

## Root Cause

`CR-01` (CrossingFlowCount) meldet an 15 Modulgrenzen und rät dort zu einem Mediator. An den
größten dieser Grenzen **ist** der Mediator das Apply-Gate — die verriegelte Kernzusage dieses
Repos. Die Regel rät also gegen den eigenen Lock.

CR-SM-279 wollte das mit einem neuen Ontologie-Attribut (`architectural: true`) lösen. Das wurde
abgelehnt, weil die Aussage **bereits ausdrückbar** ist: `REQ-gate-only-writes` existiert
(`non-functional`, CR-GC-201). Was fehlt, ist die Kante von den Modulen, die die Zusage tragen —
gemessen: **1 von 4** ist modelliert (`MOD-kernel`).

## Impact — was heute im Graphen steht und was nicht

Die drei Verträge des Gate-Pfads und ihre Modulseiten (gemessen an graphVersion 240):

| Vertrag | produziert von | konsumiert von |
|---|---|---|
| `SCHEMA-mutate-command` | agent-surface, loop, surface | kernel, loop, surface |
| `SCHEMA-mutate-result` | kernel, kernel-measure, surface | agent-surface, kernel, kernel-measure, loop, surface |
| `SCHEMA-ontology-graph` | kernel | kernel, kernel-measure, loop, projections, surface |

**Die Zusage trägt, wer schreiben könnte und es durchs Gate tut** — also wer ein
`mutate-command` *produziert*, plus der Kern, der es ausführt:

- `MOD-kernel` — der einzige Kuzu-Owner. **Trägt die Kante bereits.**
- `MOD-agent-surface`, `MOD-loop`, `MOD-surface` — produzieren Mutate-Commands. **Kante fehlt.**

**Bewusst NICHT markiert**, obwohl sie am Gate-Pfad kreuzen:

- `MOD-projections` — *„Reine Projektionen des Graphen"*, konsumiert nur `ontology-graph`.
- `MOD-kernel-measure` — *„reine Funktionen Graph → Zahl"*, urteilt, schreibt nicht.

Beide erfüllen „Gate-only Writes" nur **vakuum** — sie schreiben gar nicht. Sie zu markieren wäre
genau der Missbrauch, den das Verdikt zu CR-SM-279 als Ablehnungsgrund nennt: ein Marker, gesetzt
um eine Warnung verstummen zu lassen, statt um eine wahre Aussage zu treffen.

## Fix

Drei `satisfy`-Kanten durchs Gate:

    MOD-agent-surface -satisfy-> REQ-gate-only-writes
    MOD-loop          -satisfy-> REQ-gate-only-writes
    MOD-surface       -satisfy-> REQ-gate-only-writes

## Akzeptanzkriterien

- [x] Die drei Kanten stehen, durchs Gate angewandt (`auto-apply`, 0 Violations), Export gezogen.
      Der Diff der generierten Views enthält **ausschließlich** diese drei Kanten.
- [x] `MOD-projections` und `MOD-kernel-measure` tragen die Kante **nicht**.
- [x] **Gemessen: 6 von 15** (vorher 0). Weder 0 noch 15 — ein ableitbares Kriterium für CR-01
      **kann** trennscharf sein. Tabelle unten.

## Nicht Teil dieses CR

- **Die Änderung an CR-01 selbst.** Dieser CR modelliert nur; ob und wie die Regel die Zusage
  liest, ist die Folgefrage — und sie ist erst nach der Messung oben beantwortbar.
- `REQ-one-gate-per-repo` trägt heute `kinds: functional` und kann deshalb (CR-SM-266 B,
  `where` auf `STRUCTURAL_KINDS`) von keinem MOD erfüllt werden. Ob das richtig typisiert ist,
  ist eine eigene Frage.

---

## Ergebnis der Messung — 6 von 15, und die Aufteilung ist plausibel

| Grenze | Verträge | gemeinsames strukturelles REQ |
|---|---:|---|
| kernel ↔ surface | **8** | `REQ-gate-only-writes` |
| kernel-measure ↔ loop | 6 | — |
| agent-surface ↔ surface | 5 | `REQ-gate-only-writes` |
| kernel ↔ projections | 5 | — |
| kernel ↔ kernel-measure | 4 | — |
| agent-surface ↔ kernel | 4 | `REQ-gate-only-writes` |
| loop ↔ surface | 3 | `REQ-gate-only-writes` |
| agent-surface ↔ projections | 3 | — |
| kernel ↔ loop | 3 | `REQ-gate-only-writes` |
| agent-surface ↔ loop | 2 | `REQ-gate-only-writes` |
| die übrigen fünf | 1–2 | — |

**Die größte Grenze überhaupt (kernel ↔ surface, 8 Verträge) ist die Gate-Grenze** — genau der
Fall, an dem CR-01 heute zu einem Mediator rät, den es gibt. Drei der sechs größten Grenzen sind
es. Die neun übrigen bleiben unmarkiert, darunter die zweitgrößte (`kernel-measure ↔ loop`, 6
Verträge) — dort steht CR-01s Rat unwidersprochen, und das ist vermutlich richtig so.

**Was das für die Folgefrage heißt:** ein CR-01-Bein, das die Zusage liest, hätte am
graphcode-Selbstmodell eine reale Wirkung (6 Grenzen leiser) ohne die Regel stumm zu schalten
(9 bleiben). Das ist die Zahl, die dem abgelehnten CR-SM-279 gefehlt hat. **Nicht** damit
entschieden ist, ob die Regel das *tun soll* — das ist eine L2-Frage und gehört durch
`se-grammar-review`, mit dieser Zahl als Eingang.

**Ehrliche Grenze der Messung:** sie zeigt Trennschärfe an EINEM Graphen. Ob das Kriterium auch
in einem Repo ohne Apply-Gate trennt (also nicht pauschal alles oder nichts markiert), ist damit
nicht gezeigt und wäre vor einer Regeländerung an einem zweiten Familie-Graphen zu prüfen.
