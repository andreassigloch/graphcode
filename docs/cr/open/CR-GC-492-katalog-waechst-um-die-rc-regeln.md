# CR-GC-492 — Der Katalog wächst um die Kongruenz-Regeln

**Status:** erledigt · **Angelegt:** 2026-09-09 · **Abgeschlossen:** 2026-09-09 · **Art:** Consumer-Nachzug
**Auslöser:** `CR-SM-305` (contracts 10.1) — `ALL_RULE_DEFS` 63 → 69
**Verwandt:** `CR-GC-428` (abgeleitete Auslassungsliste), `CR-GC-340` (Zahlen-Kanarie)

---

## 1. Root Cause

contracts 10.1 nimmt die sechs Kongruenz-Regeln `RC-01…RC-06` in `ALL_RULE_DEFS` auf — mit
eigenem Profil `conformance`, und **ohne** sie in `evaluateAllRules` auszuführen: ihre Signatur
ist `(graph, CodeFacts)`, und die Facts hat nur ein Host mit Repo-Wurzel.

Zwei graphcode-Prüfungen sind darüber rot geworden, und **beide zu Recht** — sie sind genau dafür
gebaut:

| Test | Was er sagt |
|---|---|
| `evaluation.rule-catalog` (CR-GC-428) | die akzeptierte Katalog-Lücke ist gewachsen |
| `claims.conformance` (CR-GC-340) | eine veröffentlichte Zahl passt nicht mehr zur Quelle |

## 2. Impact

**Der Zuwachs ist der erwünschte Ausfall.** Vorher standen die RC-Regeln überhaupt nicht im
Katalog: ein Modell-Zug, der die Bindung an den Code bricht, ging lautlos durch jedes Gate. Jetzt
steht die Nicht-Auswertung als **Aussage** da — `unevaluatedRuleIds` liefert sie von selbst.

**Die eigentliche Frage steckt in der Severity:** `RC-01/02/03` sind `error`, und der Wächter hielt
bisher fest, dass **kein `error` still aus dem Gate fällt**. Der Satz bleibt richtig, seine
Begründung wird zweiteilig:

- **ND-01/ND-02** *könnten* das Gate fahren und werden lokal nachgeholt (CR-GC-442).
- **RC-01…06** können es hier gar nicht — die Eingabe fehlt — und **sagen es**.

Beides ist erlaubt; *stillschweigend* ist keins von beidem. Ein `error` in der Lücke **ohne** einen
dieser zwei Gründe ist der Zustand, gegen den der Test gebaut ist, und er wird jetzt genau so
geprüft statt über eine gepinnte Namensliste.

## 3. Die Zahl in der Prosa bleibt 63 — der Messpunkt war falsch

Drei Artikel schreiben *„63 engine rules feed 8 readiness dimensions"*. Die Kanarie las
`ALL_RULE_DEFS.length` und verlangte **69**.

**Der Satz ist weiterhin wahr.** Genau 63 Regeln füttern die readiness-Dimensionen; die sechs RC
tun es ausdrücklich nicht (CR-SM-305: eine deklarierte, nicht ausgewertete Regel im Nenner
**hebt** den Score — an graph-view-edit wären das +5,0 Punkte `schema` gewesen). Die Kanarie liest
deshalb jetzt die **scorenden** Regeln (`READINESS_SCORED_PROFILES`), nicht die Katalogzahl.

Wäre der Messpunkt stehengeblieben, hätte die Prosa auf 69 gehoben werden müssen — und damit eine
Aussage behauptet, die falsch ist. Ein Zahlen-Wächter, der die falsche Zahl misst, erzwingt eine
Lüge, statt sie zu verhindern; das ist teurer als gar keiner.

## 4. Änderung

| # | Datei | Was |
|---|---|---|
| 1 | `tests/evaluation.rule-catalog.test.ts` | `NOT_IN_GATE` + 6; die `error`-Invariante prüft den GRUND statt der Namen |
| 2 | `tests/claims.conformance.test.ts` | `engine rules` = die scorenden Regeln, nicht `ALL_RULE_DEFS.length` |
| 3 | `package.json` | `@sigloch/contracts` `>=10 <11` → `>=10.1 <11` |
| 4 | `package-lock.json` | Spiegel |

Kein Produktionscode. Die Artikel bleiben unangetastet.

## 5. Akzeptanzkriterien

- [x] `unevaluatedRuleIds` nennt `RC-01…RC-06` — abgeleitet, nicht notiert.
- [x] Die `error`-Invariante hält ohne gepinnte Namensliste: jeder `error` in der Lücke ist
      entweder lokal ausgewertet oder eine Conformance-Regel.
- [x] Die drei Artikel behalten **63**, und die Kanarie bestätigt es.
- [x] Volle Suite grün: **1047 / 1047** über 131 Dateien — darin auch `lockfile-sync` und
      `distribution`, die seit dem Floor-Bump auf `>=10.1 <11` auf den publizierten Peer warteten.
