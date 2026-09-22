# CR-GC-551: `kinds` als Zeichenkette über den commands-Pfad

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-342 (bug)
**Erstellt:** 2026-09-19
**Item:** bok/items/ITEM-2026-342.json (Lane: code)

---

## 1. Root Cause

`normalizeReqKinds` läuft auf dem **Schreibpfad nur in `GraphService`** (`graph-api-core`,
`graph-service.ts:541/587`, CR-195d): dort wird `element.attributes.kinds` gehoben und zur Liste
normalisiert. **graphcodes Apply-Pfad geht dort nicht durch.** `graph_mutate` → `applyCommands`
(`src/kernel/apply-commands.ts:64`) mischt `attributes` roh zusammen und persistiert, was kam.
Eine Zeichenkette bleibt eine Zeichenkette.

Die Leser normalisieren weiterhin — R-18 liest `"non-functional"` korrekt als Menge
`{non-functional}` und weist die illegale satisfy-Kante ab. **Deshalb fällt es nicht auf:** das
Gate urteilt richtig, nur der gespeicherte Wert ist falsch.

> Korrektur zur Item-Fassung: dort stand, `graph-api-core` „spaltet Strings nicht". Das ist
> falsch — es spaltet sie, aber in einem Codepfad, den graphcode nicht benutzt. Die Aussage in
> CR-SM-320 §4 war richtig über den Code und falsch über seine Reichweite.

## 2. Impact

**Gemessen 2026-09-19** (`rig/sigllm-spezifikation`, Lauf 1): ein Opus-Arm autoriert 49 REQ über
`graph_mutate`, **49 von 49** tragen `kinds` als Zeichenkette, 0 Gate-Ablehnungen im ganzen Lauf.

**Minimale Reproduktion** (frischer Harness, ein Stapel, `tier: suggest`, 12 Mutationen):

| geschrieben | gespeichert | |
|---|---|---|
| `attributes: { kinds: 'functional' }` | `"functional"` | Defekt |
| `attributes: { kinds: 'functional,precondition' }` | `"functional,precondition"` | Defekt |
| `attributes: { kinds: ['functional'] }` | `["functional"]` | korrekt |

**Was bricht:** Sichten, die auf Listen-Mitgliedschaft filtern (NFR-Register, ConOps), verlieren
diese REQ still — kein Befund, kein Block (das ist ITEM-2026-007 unverändert). Dazu bietet R-02
Kandidaten nach `kinds` an (ITEM-2026-299), und eine Zeichenkette matcht dort nichts.

**Was nicht bricht:** die Regelurteile. Jeder Leser, der über `normalizeReqKinds` bzw. `kindsOf`
geht, sieht die richtige Menge. Es ist ein Persistenz-, kein Urteilsdefekt — deshalb ist er
zweieinhalb Wochen unentdeckt geblieben.

## 3. Fix

Am Produzenten, wie bei CR-SM-320, und an **einer** Stelle: `applyCommands` normalisiert
`attributes.kinds` über `normalizeReqKinds` aus `@sigloch/contracts/se`, bevor der Knoten in den
Graphen geht — für `add-node` **und** `update-node`, da beide durch denselben Merge laufen.

Keine Leser-Toleranz anfassen: die bleibt für Bestandsgraphen.

### Dateien (2)

| # | Datei |
|---|---|
| 1 | `src/kernel/apply-commands.ts` — `normalizeReqKinds` beim Attribut-Merge (`add-node`/`update-node`) |
| 2 | `tests/apply-commands.kinds.test.ts` — neu, die drei Fälle der Tabelle oben |

## 4. Nachweis

- [x] **Rot zuerst:** 3 von 5 Faellen rot vor dem Fix — die einzelne Zeichenkette, die
      kommagetrennte und `update-node`. Die beiden Gegenproben waren von Anfang an gruen, wie sie
      sollen.
- [x] Gegenprobe: `['functional']` bleibt unveraendert, `undefined` bleibt `undefined` (eine leere
      Liste waere eine andere Aussage als "nicht gesetzt").
- [x] Suite gruen (ausser den zwei erwarteten Link-Modus-Roten, s. CLAUDE.local.md).
- [x] **Bestand gemessen 2026-09-22 ueber die committeten Exporte der Familie: 20 von 926 REQ
      tragen den String** — 19 in graphify, 1 in graph-view-edit, 0 in den uebrigen zehn. Die 49
      aus dem Lauf vom 2026-09-19 stehen NICHT mehr im sigllm-Export (81 REQ, alle mit `kinds`,
      keiner als String) — dort hat ein spaeterer Schreibzug sie eingeebnet. **Keine Migration:**
      20 Elemente deckt die Leser-Toleranz, und der naechste Schreibzug ueber den reparierten Pfad
      normalisiert sie ohnehin. Ein Migrationslauf waere mehr Risiko als Nutzen.

## 5. Abgrenzung

`CR-SM-345` (aus demselben Item, Ziel `sigloch-modules`) wird **ohne Änderung geschlossen**:
`graph-api-core` normalisiert bereits korrekt, der Defekt liegt allein in graphcodes Apply-Pfad.
Ein zweiter Fix dort wäre ein paralleler Pfad.
