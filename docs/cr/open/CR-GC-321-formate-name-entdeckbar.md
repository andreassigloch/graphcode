# CR-GC-321 — `__name` in Format-E entdeckbar machen, stillen `name = uid`-Fallback laut machen

**Status:** open · **Datum:** 2026-08-10
**Ziel:** graphcode 0.12.x
**Ontologie:** v4.0.0 — **unverändert** (kein Contracts-Bump, siehe §3)
**Bezug:** CR-GC-276 (formatE als Input-Codec), CR-GC-310 (resolveType), CR-GC-231 (`graph_authoring_guide`)

---

## 1. Problem

Format-E **kann** Namen setzen — nur nicht positional. `+ uid|text` hat zwei Felder; der Name reist
als Attribut, inline `[__name:…]` oder als Folgezeile `@__name …`, wenn der Wert Kommas oder
Klammern enthält. Beides funktioniert, encode wie decode (`src/codec.ts:154` / `src/codec.ts:279`).

Nur weiß das niemand. `__name` steht in **keiner** Tool-Beschreibung:

| Oberfläche | erwähnt `__name`? |
|---|---|
| `graph_mutate`, Feld `formatE` (`src/tools/write.ts:47-53`) | nein |
| `graph_authoring_guide` (`src/tools/report.ts:469-476`) | nein |
| `src/bootstrap.ts:69` (Cold-Start-Template) | ja — die einzige Fundstelle im Repo |

Und der Fallback schweigt: fehlt `__name`, setzt `src/codec.ts:279` `name = uid` — ohne Violation,
ohne Warnung, `tier` bleibt `pass`. Ein Autor, der ohne vorheriges Read-Slice schreibt, hat keine
Chance, das zu bemerken; wer stattdessen `+ uid|Name|Beschreibung` schreibt, bekommt Name **und**
Beschreibung in die Beschreibung und den uid als Namen.

**Realer Schaden (Session 2026-08-10, Fremdrepo):** 87 von 134 Knoten trugen ihren uid als Namen.
Sichtbar erst in den generierten Sichten — `implplan.md` zeigte „CR-002" statt „Markdown dialect and
slide model", und jede andere Sicht dasselbe. Reparatur: 87 Knoten in drei Gate-Batches.

Kein Datenverlust, kein Store-Problem — eine reine Namensdegradierung, die erst mehrere
Arbeitsschritte später auffällt.

---

## 2. Ziel

1. `__name` ist aus den Tools heraus entdeckbar, ohne dass man ein Read-Slice gelesen haben muss.
2. Ein formatE-Batch, der Knoten ohne `__name` anlegt, sagt das im Ergebnis — statt still `uid` als
   Namen einzusetzen.

---

## 3. Nicht-Ziele

- **Kein drittes positionales Feld** in Format-E. `+ uid|text` bleibt; ein `|`-getrenntes Namensfeld
  bräche jedes bestehende Slice und jeden Conformance-Fixture.
- **Keine Contracts-Regel** (`name === uid` → warning) in diesem CR. Sie wäre die stärkere Variante —
  sie griffe auf *jedem* Schreibweg statt nur auf dem formatE-Weg, „enforce, don't document" im
  Wortsinn. Sie kostet aber Familie-Review + Version-Bump von `@sigloch/contracts/se` und ist damit
  ein eigener CR. Entscheidung: erst die billige Hälfte, die den gemessenen Fall abdeckt.
- **Kein Block.** `name = uid` ist legitim für technische Knoten; das Verdict bleibt `pass`.
- Keine Migration bestehender Graphen — betroffene Knoten repariert man durchs Gate.

---

## 4. Anforderungen

| REQ | Kind | Anforderung | Verification |
|---|---|---|---|
| REQ-N01 | functional | Die `formatE`-Feldbeschreibung nennt `__name` mit beiden Formen (`[__name:…]` inline, `@__name …` bei Komma/Klammer) und sagt, dass ohne `__name` der uid zum Namen wird. | test (String-Assertion auf die Tool-Beschreibung) |
| REQ-N02 | functional | `graph_authoring_guide` liefert je Typ ein `formatEExample` — eine gültige Format-E-Zeile inkl. `[__name:…]`, mit dem angefragten Typ interpoliert. | test |
| REQ-N03 | functional | `formatEExample` ist **decodierbar**: durch `GraphCodeCodec.decode()` gejagt ergibt es einen Knoten des angefragten Typs mit `name !== uid`. | test |
| REQ-N04 | functional | Ein formatE-Batch, der ≥1 Knoten ohne `__name` anlegt, liefert `nameWarning` mit der Liste der betroffenen uids. | test |
| REQ-N05 | negative | `nameWarning` fehlt, wenn alle Knoten `__name` tragen, wenn der Batch nur Kanten enthält, und auf dem `commands`-Pfad (dort ist `name` explizite Autorenabsicht, kein Fallback). | test |
| REQ-N06 | non-functional | `nameWarning` ändert `success`, `tier`, `violations` und die persistierten Daten nicht — reine Zusatzinformation, Muster `occWarning` (`src/tools/write.ts:307`). | test |
| REQ-N07 | negative | Der Fall greift auch im `dryRun` — sonst meldet der Preview sauber und der Apply verliert die Namen. | test |

---

## 5. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/tools/write.ts` | `formatE`-Beschreibung (REQ-N01); `formatEToCommands` gibt zusätzlich die uids ohne `__name` zurück; `nameWarning` im Ergebnis, Apply- **und** dryRun-Zweig |
| `src/tools/report.ts` | `graph_authoring_guide`: Feld `formatEExample` + Beschreibungssatz |
| `tests/mutate.formate-name.test.ts` | neu — REQ-N01..N07 |

Drei Dateien, unter dem 6-Datei-Limit.

**Umsetzungsnotiz:** `formatEToCommands` erkennt den Fall exakt, weil es den Decode selbst fährt —
`__name` fehlt genau dann im geparsten Attributsatz, wenn der Autor ihn nicht geschrieben hat. Ein
nachgelagerter `name === uid`-Vergleich auf dem Ergebnis wäre unschärfer (er träfe auch bewusst
gleichnamige Knoten) und gehört in die Contracts-Regel, nicht hierher.

---

## 6. Akzeptanzkriterien

1. [ ] Ein formatE-Batch ohne `__name` liefert `nameWarning` mit den uids; `tier` bleibt `pass`.
2. [ ] `graph_authoring_guide('REQ')` liefert ein `formatEExample`, das der Codec zu einem REQ mit
   lesbarem Namen decodiert (REQ-N03 — der Beispiel-String ist geprüft, nicht behauptet).
3. [ ] Reiner Kanten-Batch (CR-GC-310) erzeugt **kein** `nameWarning`.
4. [ ] `npm run build` + volle Suite grün.
5. [ ] Mutationsprobe: `__name` aus einem Test-Batch entfernt → REQ-N04 rot; `nameWarning` fest auf
   `undefined` verdrahtet → REQ-N04 rot, REQ-N05 grün (die beiden Tests laufen gegenläufig).
