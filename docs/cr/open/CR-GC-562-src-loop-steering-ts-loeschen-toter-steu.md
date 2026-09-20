# CR-GC-562: `src/loop/steering.ts` löschen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-382 (idea)
**Erstellt:** 2026-09-20
**Item:** bok/items/ITEM-2026-382.json (Lane: graph)

---

## 1 Befund

Dritter und letzter Schritt. Nach CR-GC-561 ruft niemand mehr `nextStep()`. Die Datei
trägt die zweite Rangwahl (denselben Filter und Komparator wie `generate.ts`) und
`DIMENSION_ACTION`, die acht Lese-Zwillinge von `GENERATION_TEMPLATE`. Beides tot.

Auskommentieren oder „deprecated" stehenlassen wäre genau der Zustand, den die
Guardrails verbieten. Löschen.

## 2 Zielbild

Die Datei ist weg. Die Rangwahl existiert genau einmal, in `generate.ts`, und kann nicht
mehr auseinanderlaufen.

`tests/steering.measurement-path.test.ts` prüft heute, dass `nextStep` und
`generationStep` DENSELBEN Messpfad benutzen — die Zusicherung aus CR-GC-324. Mit nur
einem Pfad ist der Vergleich gegenstandslos; was bleibt, ist die Zusicherung, dass
`generationStep` über `takeSteeringSnapshot` misst und nicht über eine eigene Abbildung.
Die bleibt geprüft, der Vergleich fällt weg.

Die Zeile in den generierten Repo-Dokumenten („What should I do next?") zeigt danach auf
`graph_generate`.

## 3 Umfang

- `src/loop/steering.ts` — gelöscht
- `tests/steering.measurement-path.test.ts` — Vergleich raus, Messpfad-Zusicherung bleibt
- `src/surface/scaffold-docs.ts` — die Zeile im generierten Einstieg
- `tests/cli.scaffold.test.ts` — falls sie den Text festnagelt

Vier Dateien.

## 4 Abnahme

1. `grep -rn "nextStep\|graph_next_step" src/` findet nichts mehr.
2. `generationStep` misst weiterhin nachweislich über `takeSteeringSnapshot`.
3. Der generierte Einstieg nennt `graph_generate`.
4. Suite grün.
