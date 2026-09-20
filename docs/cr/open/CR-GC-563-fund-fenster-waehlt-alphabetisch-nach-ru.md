# CR-GC-563: Fehler vor Warnungen — die Fundreihenfolge ist kein Alphabet

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-386 (bug)
**Erstellt:** 2026-09-20
**Item:** bok/items/ITEM-2026-386.json (Lane: graph)

---

## 1 Befund

Gemessen in Rig-Lauf 4 (`rig/sigllm-spezifikation/ergebnis.md`). Im Endzustand hat genau
EINE Readiness-Dimension Funde: `uc` mit 56, alle anderen null. Die Fokuswahl filtert auf
`violations > 0` — es gibt also über alle zwölf Runden nur einen Kandidaten, und was das
Modell tut, entscheidet allein die Reihenfolge der Fenster *innerhalb* der Dimension.

Diese Reihenfolge ist heute:

```ts
.sort((a, b) => a.rule_id.localeCompare(b.rule_id) || a.element_id.localeCompare(b.element_id))
```

**Alphabetisch.** Damit lautet die Abarbeitung FC-02 → R-15 → R-16 → UC-01 → UC-02 → …
und das heißt konkret:

- **FC-02 (warning)** kommt vor **UC-02 (error)**, weil F vor U kommt. Ein Fund, der das
  Gate blockiert, wartet auf drei, die es nicht tun.
- Der Lauf hat zwölf Runden in `uc` verbracht und **das Wort FUNC steht kein einziges Mal
  im Lauflog**. Endgraph: 22 Elemente, 16 Kanten, alle `compose`, keine einzige `io`.

Das Alphabet ist kein Kriterium. Es war nie eines — CR-GC-290 hat den Vergleich eingeführt,
um die Fenster *deterministisch* zu machen, nicht um sie zu *priorisieren*. Determinismus
braucht irgendeine totale Ordnung; dass es die lexikografische wurde, war eine Nebenwirkung.

## 2 Zielbild

**Fehler zuerst, dann wie bisher.** Der Rang ist `severity` — error vor warning vor info —
und erst danach `rule_id` und `element_id`. Determinismus bleibt: die Ordnung ist weiterhin
total und hängt nur vom Graphen ab.

Das System glaubt diese Priorität längst an anderer Stelle: `blockingErrors` muss für den
Handoff auf 0, Warnungen dürfen stehenbleiben. Die Fundwahl war der einzige Ort, der es
nicht wusste.

In der `uc`-Dimension sind das gemessen: **error** UC-01, UC-02 · **warning** FC-02, R-15,
R-16, UC-03 · **info** UC-05, UC-06. Neue Reihenfolge also UC-01 → UC-02 → FC-02 → R-15 →
R-16 → UC-03 → UC-05 → UC-06.

**Warum das den gemessenen Stillstand plausibel löst** — aus einem inhaltlichen Grund, nicht
weil „Fehler wichtiger klingen". Die beiden Fehler verlangen Substanz, die Warnung nicht:

| Regel | `fix_hint` | was entsteht |
|---|---|---|
| UC-01 (error) | *Add at least one REQ via compose trace* | REQs — und der Preflight hängt je REQ einen TEST-Stub an (R-01) |
| UC-02 (error) | *Wire an ACTOR to a FLOW that feeds … a FUNC in one of this UC's function chains* | FLOW und FUNC, also die Struktur |
| FC-02 (warning) | *Add a FCHAIN via compose trace* | eine leere Kette |

Der Lauf hat zwölf Runden lang die dritte Zeile ausgeführt. Der Fund, der zuerst drankommt,
bestimmt, welche Struktur entsteht.

Ob es reicht, sagt der nächste Lauf. Dieses CR behauptet es nicht.

## 3 Umfang

- `src/loop/generate.ts` — `violationsOf` sortiert nach `severity`, dann `rule_id`, dann `element_id`
- `tests/generate.test.ts` — Abnahme

Zwei Dateien.

## 4 Abnahme

1. In einer Dimension mit error- und warning-Funden liefert das erste Fenster eine **error**-Regel.
2. Die erste Warnung kommt erst, wenn kein error-Fenster mehr offen ist — und dann FC-02, also
   bei gleicher Severity weiter `rule_id` → `element_id` (Determinismus, CR-GC-290).
3. Ein Fenster trägt weiterhin genau eine Regel (Invariante aus CR-GC-290).
4. Zweimal derselbe Graph ⇒ derselbe `focusKey`.
5. Suite grün.

## 5 Was bewusst offen bleibt

Severity ist eine **Rangfolge, keine Abhängigkeitsanalyse**. Manche Funde sind Voraussetzung
anderer — UC-02 braucht FUNCs, die R-15 erzeugt. Eine echte Reihenfolge nach Abhängigkeit
wäre der nächste Schritt und ist ein eigener Entwurf, kein Sortierschlüssel.
