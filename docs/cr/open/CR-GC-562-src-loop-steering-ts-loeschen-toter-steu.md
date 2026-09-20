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
- `tests/cli.scaffold.test.ts` — sie nagelt den Text fest
- `tests/steering.test.ts` — gelöscht: die Datei testete ausschliesslich `nextStep`
- `src/loop/generate.ts` — zwei Kommentare, die das Werkzeug als lebend führten
- **Das Modell** (`docs/graph/graphcode.graph.json` + die gerenderten Views): drei Züge
  durchs Gate, keiner von Hand

**Acht Dateien plus generierte — benannte Abweichung**, wie in CR-GC-561. Die Ursache ist
dieselbe: eine Löschung zieht ihre Konsequenzen in einem Zug nach sich, sonst ist die Suite
dazwischen rot. Der Blast Radius bleibt ein Symbol.

## 3a Was die Kongruenzprüfung erzwungen hat

Der Codeschnitt allein hätte RC-02 gebrochen — genau der Fall, vor dem die Guardrails warnen
(„Build grün, Tests grün, Modell und Code auseinandergelaufen"). Drei Züge durchs Gate:

1. **`FUNC-next-step` gelöscht** samt seiner acht Kanten.
2. **`FLOW-next-step-advice` umgehängt** statt gelöscht: der Rückweg an `ACTOR-agent` trägt
   `SCHEMA-generation-step` und existiert weiter — seit CR-GC-561 beantwortet
   `graph_generate` die Frage. Ohne diesen Zug hätte R-10 einen FLOW ohne Produzent gemeldet.
3. **`TEST-steering-loop` in `TEST-single-measurement-path` zusammengelegt.** Löschen ging
   nicht: er war der einzige Verifizierer von `REQ-steering-pre`/`-post`. Das Gate hat den
   ersten Versuch abgewiesen („A test file belongs to at most one TEST") und damit die
   richtige Lösung erzwungen.

Und eine Zusicherung wäre mit `tests/steering.test.ts` ersatzlos gefallen:
`REQ-steering-post` wörtlich — *derselbe Graph liefert dieselbe Empfehlung*. Sie steht jetzt
in `steering.measurement-path.test.ts` an `generationStep`, wo sie hingehört. Ohne diesen
Schritt wäre der Knoten umgehängt und die Evidenz weg gewesen.

## 4 Abnahme

1. `grep -rn "nextStep\|graph_next_step" src/` findet nichts mehr.
2. `generationStep` misst weiterhin nachweislich über `takeSteeringSnapshot`.
3. Der generierte Einstieg nennt `graph_generate`.
4. RC-* sagt kongruent: `conformance.test.ts` grün, keine RC-Errors im Selbstmodell.
5. Suite grün.
