# CR-GC-786: graph_readiness bricht an Anforderungen mit Art-Werten vor contracts 10 ab (siconizer)

**Status:** ✅ Done (2026-10-12)
**Typ:** aus Item ITEM-2026-823 (bug)
**Erstellt:** 2026-10-11
**Item:** bok/items/ITEM-2026-823.json (Lane: code)

---

**Bezug:** Hygiene; aufgefallen im Spike Gesamt-Impact, Fall 3 (graphanalyze
`docs/messung/gesamt-impact-fall3-2026-10-10/verworfen-siconizer/`).

## Befund

`graph_readiness` bricht am siconizer-Modell mit einem Schemafehler ab, statt zu berichten.

- Stelle: `takeSteeringSnapshot` (`dist/kernel/measure/steering-snapshot.js`), `SteeringSnapshotSchema.parse`.
- Meldung: an 12 Elementen `kinds[0]` außerhalb von funktional und nicht-funktional.
- Ursache der Daten: das Modell trägt Art-Werte aus der Zeit vor contracts 10 (CR-SM-366 hat die Werte auf zwei
  verkürzt).
- `graph_metrics` und `rules_evaluate` laufen am selben Modell durch; `rules_evaluate` meldet 88 Fehler.

## Offene Frage vor dem Bau

Wo gehört die Meldung hin? Zwei Lesarten, zu entscheiden an der Ursache und nicht am Symptom:

1. Der Stand ist ein Datenfehler, den eine Regel als Befund nennen muss; `graph_readiness` berichtet dann mit
   diesem Befund und rechnet, was rechenbar ist.
2. Der Stand darf gar nicht geladen werden; dann fehlt die Ablehnung beim Laden mit benanntem Grund.

Kein Abfangen der Ausnahme ohne diese Entscheidung.

## Umfang

Reproduktion als Test (kleines Modell mit einem alten Art-Wert, auf Disk), dann die Ursache nach der
Entscheidung oben. Voraussichtlich `src/kernel/measure/steering-snapshot.ts`, der Lader und ein Test.

## Abnahme

- Der Test bildet den Abbruch nach und ist danach grün.
- Am siconizer-Modell antwortet `graph_readiness` mit einem benannten Befund oder lehnt mit benanntem Grund ab.

## Entscheidung (Autor, 2026-10-12)

Lesart 1. Der Stand ist ein **Fehler, den eine Regel meldet**; das Modell wird nicht beim Laden abgelehnt;
die Werkzeuge berichten mit dem Befund und rechnen, was rechenbar ist.

Die Regel liefert contracts 12.5.0 (CR-SM-411, `RULES_VERSION` 47.0.0): R-08 („Data integrity", Fehler,
Stufe `immer`) hat einen zweiten Fall, jedes Feld eines Elements gegen `OntologyElement`, an REQ zusätzlich
`attributes.role`. Ein Befund je Element und Feld, Text `<uid>.<feld> = <Wert als JSON> is outside the
element contract`.

## Umsetzung (2026-10-12)

**Ursache:** `takeSteeringSnapshot` prüfte den Messpunkt gegen `SteeringSnapshotSchema` und warf, sobald ein
Element im Bestand außerhalb des Element-Vertrags lag. Keine Regel nannte diesen Bestand.

- **Ein Messweg.** `takeSteeringSnapshot` rechnet ohne Schema-Prüfung; der Bestand ist ein R-08-Befund im
  Regelstrom, in der Stufe `immer` und in der Fokusmenge. `measureSteering` (die Fassung „nicht messbar" für
  den Trockenlauf) und das Feld `steeringUnmeasurable` an der Antwort von `graph_mutate` sind gelöscht; der
  Trockenlauf misst über `takeSteeringSnapshot` und trägt immer `steeringDelta`. Streichfrage: „nicht
  messbar" war nur nötig, weil die Messung selbst prüfte. Mit der Regel ist der Steuerraum rechenbar, und
  das Delta einer Migration zeigt genau den Befund, den sie schließt (Test: `blockingErrors` 1 → 0).
- **Gate.** Die lokale Prüfung `SCHEMA-02` mit `elementFieldIssues` und `ELEMENT_FIELDS` ist aus
  `src/kernel/gate.ts` gelöscht. R-08 steht im Gate-Katalog; das Gate weist ab, was ein Zug neu einführt.
  `SCHEMA-01` bleibt.
- **Verhaltensunterschied (gewollt):** `[kinds:functional]` als einzelner String wurde von `SCHEMA-02`
  abgewiesen. Jetzt hebt der Schreibpfad ihn zur Liste (`apply-commands.ts`, CR-GC-551) und der Zug geht
  durch; im Store steht `["functional"]` (Test).
- **Peer-Floor:** `@sigloch/contracts` `>=12.5 <13`. Ohne den zweiten Fall an R-08 prüft nach dem Wegfall
  von `SCHEMA-02` nichts mehr den Element-Vertrag. contracts 12.5.0 ist unveröffentlicht: bis zum Release
  ist das Repo nur im Link-Modus lauffähig; `package-lock.json` ist nicht nachgezogen (kein `npm install`).
- **Modell:** `REQ-element-contract-finding` mit `TEST-readiness-altbestand` und `TEST-mutate-schema-guard`,
  erfüllt von `FUNC-take-steering-snapshot` und `FUNC-mutate`; Beschreibungen von
  `FUNC-take-steering-snapshot` und `SCHEMA-steering-snapshot` nachgezogen.
- **Regelmatrix** neu erzeugt (R-08 heißt „Data integrity").

**Dateien:** `src/kernel/measure/steering-snapshot.ts`, `src/kernel/measure/focus-set.ts` (Kommentar),
`src/kernel/gate.ts`, `src/surface/write.ts`, `tests/readiness.altbestand.test.ts` (neu),
`tests/mutate.schema-guard.test.ts`, `package.json`, `docs/views/regel-matrix.{md,csv}`, dieser CR; dazu die
vom Export erzeugten Dateien unter `docs/graph` und `docs/views`.

## Abnahme (2026-10-12)

- `tests/readiness.altbestand.test.ts`: vor dem Fix rot mit `ZodError` an `og.elements.0.kinds.0` in
  `graph_readiness` und `graph_generate`, danach grün.
- siconizer-Modell (`siconizer/docs/graph/siconizer.graph.json`, gelesen über `openMeasured` in einen
  Wegwerf-Store): `graph_readiness` antwortet, `violationsByRule["R-08"] = 12`, alle 12 an `kinds`
  (6 × `["risk"]`, 6 × `["mitigation"]`), z. B.
  `REQ-risk-clipped-content.kinds = ["risk"] is outside the element contract`. Stufe `immer`: 54 Befunde.
  Die Marke SRR nennt den Befund unter `holding`. `graph_generate` antwortet mit Phase `expand` und führt
  die R-08-Befunde im Schritt.
- `npm run build` grün. `npm run verify:full CR-GC-786`: 185 von 187 Dateien grün, Schlupf 0. Rot:
  `tests/distribution.test.ts` und `tests/lockfile-sync.test.ts` (Link-Modus und gehobener Floor ohne
  nachgezogenes Lock, erwartet bis zum Release von contracts 12.5.0).

## Offen

- Release von contracts 12.5.0, danach `npm install` (Lock) im Release-Zug.
- Das siconizer-Modell trägt die 12 Altwerte weiter; die Migration (`kinds` → `role`) ist Sache des
  siconizer-Repos.
