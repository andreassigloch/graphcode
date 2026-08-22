# CR-GC-391 — Ein Rollup-FUNC schuldet nichts, was seine Blätter schulden

**Status:** open · **Angelegt:** 2026-08-21 · **Umsetzung:** `sigloch-modules` (`@sigloch/contracts`),
nicht in diesem Repo · **Basis:** `evaluateAllRules` @ graphVersion 145

> **Umsetzung liegt seit 2026-08-22 als `CR-SM-256` in `sigloch-modules` vor.** Dieser CR bleibt die
> Analyse und die Messung am Selbstmodell; die Regeländerung wird dort geschnitten und geschlossen.
> Neu gemessen bei graphVersion 168: die zwölf `FUNC-block-*` tragen 24 Findings aus `R-02` und
> `R-31`, je 12.

## Problem — eine Regel-Inkonsistenz, kein Modellfehler

Ein zerlegter FUNC (`FUNC -compose-> FUNC`) ist ein Rollup seiner Kinder. Zwei Regeln behandeln ihn
bereits so, zwei nicht:

| Regel | Prüft Blätter? | Begründung |
|---|---|---|
| `R-30` Wirkketten-Bindung | **ja** | CR-SM-249: *„Ein zerlegter FUNC ist ein Rollup seiner Kinder und hat keinen eigenen Bindungszustand — er darf gar keinen haben"*; `FC-03` verbietet ihm, Kettenglied zu sein |
| `R-20` realRef-Bindung | **ja** | Elternknoten gilt als gebunden, wenn alle Kinder gebunden sind (CR-GC-210) |
| `R-02` FUNC erfüllt REQ | **nein** | — |
| `R-31` io-Verdrahtung | **nein** | — |

Für `R-02` und `R-31` gilt die Rollup-Begründung wörtlich genauso. Ein Blackbox-Block hat keine
eigene io-Kante und erfüllt keine REQ, die nicht schon eine seiner Blatt-Funktionen erfüllt. Wer die
beiden Regeln heute befriedigen will, muss **erfinden**: eine io-Kante an einem Knoten, durch den
keine Daten fließen, oder eine satisfy-Kante, die die REQ ein zweites Mal beansprucht.

Gemessen am graphcode-Selbstmodell: die 13 `FUNC-block-*` tragen 38 Verstöße, davon **24 aus genau
diesen beiden Regeln** (`R-02` 12, `R-31` 12). Die verbleibenden 13 `R-20` sind echte unrealisierte
Blätter darunter — die bleiben und sollen bleiben.

## Änderung

`R-02` und `R-31` bekommen dieselbe Grundgesamtheit wie `R-30`: **ausschließlich Blätter** (FUNC ohne
`compose`-Kind vom Typ FUNC).

```
const decomposed = new Set(graph.traces
  .filter(t => t.type === 'compose' && funcIds.has(t.source) && funcIds.has(t.target))
  .map(t => t.source));
```

— derselbe Ausdruck, den `funcMustBeInEffectChain` bereits bildet.

## Semver

**Lockerung, kein heute grüner Graph wird rot** → MINOR auf `RULES_VERSION`.

**Achtung, Gate-Lücke:** `check-grammar-version.mjs` sieht diese Änderung **nicht** — der Snapshot
erfasst `id`/`severity`/`domain`, und alle drei bleiben gleich. Der Bump ist von Hand, wie bei
CR-SM-249.

## Wirkung (simuliert)

| | |
|---|---|
| graphcode-Selbstmodell | −24 Verstöße (`R-02` 12, `R-31` 12) |
| Blockschicht danach | nur noch `R-20` (13) + `RD-04` (1) — beides echte Befunde |

Gegen `sigloch-modules`' eigenes Selbstmodell ist die Messung **noch offen** und gehört vor den Bump.

## Definition of Done

- [ ] `R-02` und `R-31` melden nur noch an Blättern
- [ ] `RULES_VERSION` MINOR-Bump mit Begründung im Konstanten-Kommentar
- [ ] Ein Test, der einen zerlegten FUNC ohne satisfy/io grün stellt und sein unverbundenes Blatt rot
- [ ] Beide Selbstmodelle (graphcode, sigloch-modules) vorher/nachher gemessen und im CR notiert
- [ ] Publiziert, danach `npm install` in graphcode und Gegenprobe

**Abhängigkeit:** blockiert nichts. CR-GC-390 lässt die Blockschicht bewusst stehen und wird von
diesem CR nachträglich um 24 Verstöße entlastet.
