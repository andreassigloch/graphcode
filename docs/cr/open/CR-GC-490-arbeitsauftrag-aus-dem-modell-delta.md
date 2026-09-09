# CR-GC-490 — Der Modell-Zug erzeugt einen Arbeitsauftrag

**Status:** offen · **Angelegt:** 2026-09-09 · **Ring:** 1 (Kongruenz-Gate)
**Item:** [ITEM-2026-011](../../../../bok/items/ITEM-2026-011.json)
**Hängt an:** `CR-GC-489` (das Urteil muss zuerst einen Pfad haben)
**Grundlage:** `optimierungsring.md` §9.1/§9.2 (2); `contracts/src/se/conformance-rules.ts`
`buildModResolver` / `importDriftConformance`

---

## 1. Root Cause

Wandert eine `allocate`-Kante im Modell, **ist niemand zuständig zu sagen, welche Datei
mitwandern muss.** Das Gate prüft den Graphen, der Build prüft den Code — die Brücke dazwischen
ist heute der Mensch, der sich erinnert.

Die Ableitung ist klein und **vollständig aus vorhandenen Daten** möglich:

```
FUNC X -realRef-> Datei F        (Bindung)
FUNC X -allocate-> MOD A          (Zuordnung)
⇒ F gehört zu A

Import F → G,  G gehört zu B,  Modell kennt keine Kante A↔B
⇒ RC-05: cross-module drift
```

Beide Hälften existieren bereits: `buildModResolver` (Datei→MOD) und `extractImportEdges`
(realer Import-Graph). RC-05 nutzt sie **nach** dem Zug, um Drift zu melden. Was fehlt, ist
dieselbe Rechnung **auf das Delta angewandt** und als Auftrag formuliert.

## 2. Impact

**Bricht:** die Arbeitsteilung aus `optimierungsring.md` §9.1. graphcode soll **Spezifikation
und Verdict** liefern, der Coding-Agent die Hände sein. Ohne Spezifikation hat der Agent nur das
Verdict — er erfährt nach dem Zug, dass etwas quersteht, nicht vorher, was zu tun ist.

**Bricht nicht:** irgendeinen laufenden Pfad. Das ist eine **Ergänzung**, kein Umbau.

**Ausdrücklich nicht der Umfang:** eine Operator-Bibliothek in graphcode (Datei verschieben,
Imports nachziehen, Symbol umbenennen, Funktion teilen). Das kann der Coding-Agent bereits; ein
zweiter Pfad dorthin würde altern, während der Agent besser wird. **Das Ergebnis dieses CRs ist
eine Liste, kein Refactoring.**

## 3. Fix

Eine reine Funktion über `(vorher, nachher)` — **ohne `CodeFacts`**:

```
congruenceWorkOrder(before, after) → {
  moves: [{ file, funcId, fromMod, toMod }],
  blind: [{ funcId, reason: 'kein realRef — die Datei ist nicht ableitbar' }],
}
```

**`drifts` ist gestrichen, und das ist die wichtigste Entscheidung dieses CRs.** Der erste
Entwurf wollte „Import steht quer" hier mitrechnen — das ist **RC-05**, und es gibt sie schon
aus `conformanceEvaluation`. Sie hier nachzubauen wäre eine zweite Definition derselben Frage,
mit einem zweiten `buildModResolver` (der dafür aus contracts hätte exportiert werden müssen —
ein Release quer durch die Familie für eine Rechnung, die es gibt).

Damit sagt der Auftrag genau das, was **RC-05 nicht sagen kann**: *welche Datei wegen des
Modell-Zugs wandern muss*, **bevor** irgendein Import quersteht. Die beiden ergänzen sich —
Auftrag vorher, Verdict nachher — statt sich zu überlappen.

`blind` ist Pflicht, nicht Kür: eine FUNC ohne `realRef` erzeugt **keinen** Auftrag und muss
deshalb als *nicht ableitbar* im Ergebnis stehen. Eine leere `moves`-Liste bei 30 blinden FUNCs
ist sonst dieselbe Fail-Open-Lüge wie in `CR-GC-489`.

Ausgabe an den bestehenden Mutations-Rückgabewert (`harness.mutate`, neben `fitAdvisory` /
`steerAdvisory`) — **als Advisory, nicht als Gate.** Ein Zug wird davon nicht blockiert; er
hinterlässt eine Liste.

### Dateien (max 6)

| # | Datei | Was |
|---|---|---|
| 1 | `src/kernel/measure/work-order.ts` (neu) | die Ableitung, rein |
| 2 | `src/kernel/harness.ts` | `workOrder` im Mutations-Ergebnis |
| 3 | `tests/work-order.test.ts` (neu) | s. AC |
| 4 | `scripts/model-test-set.mjs` | Registrierung von (3), von CR-GC-399 erzwungen |

**Vier statt sechs.** Weggefallen: der contracts-Export von `buildModResolver` (siehe oben — RC-05
rechnet das bereits) und der Bericht in `report.ts` — der Auftrag steht am **Mutations**-Ergebnis
neben `fitAdvisory`/`steerAdvisory`, dort wo der Zug stattfindet. Eine Berichtsfläche für einen
Zug, der schon vorbei ist, wäre eine zweite Wahrheit. `WorkOrder` bleibt aus dem Paket-Barrel
draußen, wie `FitAdvisory` und `SteerAdvisory` auch — die Typen reisen am Ergebnis mit.

## 4. Akzeptanzkriterien

- [ ] **Rot zuerst:** Fixture mit `FUNC-a -realRef-> src/a.ts`, `allocate` auf `MOD-x`; der Zug
      verlegt sie auf `MOD-y`. Erwartet: genau ein `move` für `src/a.ts`. Vorher rot, weil die
      Funktion nicht existiert — der Test ruft sie namentlich.
- [ ] Eine FUNC **ohne** `realRef` erscheint in `blind`, nicht in `moves` und nicht im Schweigen.
- [ ] Die Randfälle stehen als eigene Fälle: neue Zuordnung (`fromMod: null`), entfallene
      Zuordnung (`toMod: null`), unveränderte Zuordnung trotz anderer Änderung (kein Auftrag).
- [ ] Zwei Läufe sind zeichengleich — die Liste ist nach `funcId` sortiert.
- [ ] **Verdrahtungs-Nachweis:** ein echter `harness.mutate()`-Zug durch `openMeasured`
      (CR-GC-491) hinterlässt genau eine Zeile. Eine Ableitung ohne Pfad ist keine.
- [ ] Der Auftrag ist ein Advisory: der Zug wird **nicht** blockiert.

## 5. Nicht im Scope

Ausführung, Rückbau, Auto-Apply. Der Agent arbeitet die Liste ab; die Abschlussbedingung dafür
steht in **`BOK-CR-033`**.
