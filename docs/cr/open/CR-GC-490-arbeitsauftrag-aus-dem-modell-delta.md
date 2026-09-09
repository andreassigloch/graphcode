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

Eine reine Funktion über `(vorher, nachher, CodeFacts)`:

```
congruenceWorkOrder(before, after, facts) → {
  moves:  [{ file, fromMod, toMod, reason: 'FUNC-… allocate gewandert' }],
  drifts: [{ from, to, fromMod, toMod, rule: 'RC-05' }],
  blind:  [{ funcId, reason: 'kein realRef — nicht ableitbar' }],
}
```

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
| 3 | `src/kernel/conformance.ts` | `buildModResolver` exportfähig machen (kein zweiter Resolver) |
| 4 | `src/projections/report.ts` | Auftrag im Bericht |
| 5 | `tests/work-order.test.ts` (neu) | s. AC |
| 6 | `docs/cr/…` / Skill-Nachzug bei Bedarf | — |

## 4. Akzeptanzkriterien

- [ ] **Rot zuerst:** Fixture mit `FUNC-a -realRef-> src/a.ts`, `allocate` auf `MOD-x`; der Zug
      verlegt sie auf `MOD-y`. Erwartet: genau ein `move` für `src/a.ts`. Vorher rot, weil die
      Funktion nicht existiert — der Test ruft sie namentlich.
- [ ] Import `src/a.ts → src/b.ts` mit `b` bei `MOD-z` und ohne Modellkante `y↔z` erzeugt genau
      einen `drift` mit `rule: 'RC-05'`.
- [ ] Eine FUNC **ohne** `realRef` erscheint in `blind`, nicht in `moves` und nicht im Schweigen.
- [ ] `buildModResolver` wird **wiederverwendet** — `grep` zeigt genau eine Definition der
      Datei→MOD-Auflösung im Repo.
- [ ] Der Auftrag ist ein Advisory: ein Zug mit 12 offenen `moves` wird **nicht** blockiert.

## 5. Nicht im Scope

Ausführung, Rückbau, Auto-Apply. Der Agent arbeitet die Liste ab; die Abschlussbedingung dafür
steht in **`BOK-CR-033`**.
