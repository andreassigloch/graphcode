# CR-GC-666: graph_mutate dryRun wirft auf Altbestand: Vorher-SteeringSnapshot parst den Ausgangsgraphen (CR-GC-646) - Probelauf einer Migration unmoeglich

**Status:** ✅ Done (2026-09-25)
**Typ:** aus Item ITEM-2026-570 (bug)
**Erstellt:** 2026-09-25
**Item:** bok/items/ITEM-2026-570.json (Lane: code)

---

_(kein Body im Item — Befund/Zielbild hier ausarbeiten, BEVOR die Lane startet)_

---

## Umfang

`FUNC-take-steering-snapshot` (steering-snapshot.ts), der dryRun-Zweig von `graph_mutate` (write.ts).

## Umsetzung (2026-09-25)

**Ursache.** Der dryRun misst vorher und nachher den Steuerraum mit `takeSteeringSnapshot`, und seit
CR-GC-646 prueft dieser den Element-Vertrag und wirft. Auf Altbestand — genau dem Graphen, dessen
Migration man probt — brach damit die ganze Probe ab, obwohl das Gate-Verdict berechenbar war.

- `measureSteering(graph, policy)`: dieselbe Messung per `safeParse`; liefert `{snapshot}` oder
  `{unmeasurable}` mit Befundzahl und erstem Pfad. `takeSteeringSnapshot` wirft weiter (Fuehrung,
  Bericht) — beide bauen ueber dieselbe `buildSnapshot`.
- dryRun: `steeringDelta` nur, wenn beide Seiten messbar sind, sonst `steeringUnmeasurable` mit
  Grund. Das Gate-Verdict (success/tier/violations) ist unberuehrt.

**Nachweis.** Neuer Fall in `tests/mutate.schema-guard.test.ts`: Import eines `dropped`-CR, dryRun
der Migration liefert success + `steeringUnmeasurable`, nach der Migration wieder `steeringDelta`.
Positivkontrolle: mit `takeSteeringSnapshot` im dryRun-Zweig wird der Fall rot. VOLL 1598/1598.
