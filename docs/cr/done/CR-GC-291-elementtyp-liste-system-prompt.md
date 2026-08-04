# CR-GC-291 — Elementtyp-Liste im SYSTEM-Prompt (gegen STRUCT-Halluzination)

**Status:** done (2026-08-04)
**Datum:** 2026-08-03
**Kontext:** CR-GC-283-Folgechat, Audit-Analyse über alle Greenfield-Systemtest-Läufe.

## Ausgangslage

`STRUCT`-Fehler ("Unknown node type") — 18 Treffer aggregiert, error-severity, z.B.
`Unknown node type "DOC" for node "DOC-audit-log-spec"`. Kein Preflight-Fall: der
Command kommt formal gültig durch `MutateCommandSchema.safeParse` (`node.type` ist im
Schema `z.string()`, nicht der geschlossene `ElementType`-Enum — der Preflight prüft
Kantenlegalität, nicht Typlegalität), geht unverändert ans Gate und scheitert erst dort.
Das Modell erfindet einen plausibel klingenden, aber nicht-existenten Elementtyp (`DOC`
für ein Dokument/Spec-Artefakt, das es beim Lesen von `./material` gefunden hat) — der
SYSTEM-Prompt (`src/executor.ts`) nennt aktuell nur EIN Beispiel-Typ (`"type":"UC"` im
`graph_mutate`-Formatbeispiel), nirgends die vollständige Liste der 13 legalen Typen.

## Ziel

Eine Zeile im SYSTEM-Prompt (`src/executor.ts`), die die 13 Elementtypen aus
`@sigloch/contracts/se` (`ElementType`-Enum) einmal vollständig nennt:

```
Legale Elementtypen (NUR diese 13): SYS, ACTOR, UC, FCHAIN, FUNC, FLOW, REQ, TEST, MOD,
SCHEMA, SESSION, CR, MS. Kein anderer Typ existiert — auch nicht für Dokumente/Specs
(die bleiben Prosa, kein Graph-Knoten).
```

Import der Liste **aus `ElementType.options` zur Laufzeit** (nicht als separates
Hardcode-Array) — ein Contracts-Version-Bump aktualisiert die Prompt-Zeile automatisch
mit, kein zweiter Pflegepunkt.

## Abgrenzung

- Keine Änderung an `ElementType` selbst, an Preflight, am Gate. Reiner Prompt-Text in
  `executor.ts`, dynamisch aus dem bestehenden Contracts-Export gerendert.
- Kein Preflight-Typ-Check ergänzt (wäre ein zweiter Ort, der die Ontologie kennen
  müsste) — die Prompt-Aufklärung ist der günstigere Hebel, da STRUCT ohnehin
  error-severity ist und sofort blockt (kein stiller Schaden, nur ein vermeidbarer
  Retry-Zyklus).

## Umsetzung

- `src/executor.ts`: `SYSTEM`-Prompt exportiert (Test-Zugriff) und um die Zeile
  `Legale Elementtypen (NUR diese ${ElementType.options.length}): ${ElementType.options.join(', ')}. ...`
  ergänzt — `ElementType` aus `@sigloch/contracts/se` importiert, keine Hardcode-Liste.

## Validierung

- Unit (`tests/executor.test.ts`): SYSTEM-Prompt-String enthält alle 13
  `ElementType.options`-Werte (Regressionsschutz gegen Contracts-Drift — ein neuer Typ
  in contracts, der NICHT im Prompt auftaucht, lässt den Test fehlschlagen).
- `npm run build` + volle Suite (68 Dateien / 427 Tests) grün.
- Messlauf (optional, günstig) nicht separat gefahren — kein STRUCT-Treffer in den
  CR-GC-290-Nachtrag-Messläufen (devstral, v18-bo3-Konfiguration) beobachtet.

## Dateien (≤6)

- `src/executor.ts`
- `tests/executor.test.ts`

## Akzeptanzkriterien

- [x] SYSTEM-Prompt nennt alle 13 Elementtypen, dynamisch aus `ElementType.options`
- [x] Unit-Test verifiziert Vollständigkeit gegen den Contracts-Enum (Drift-Schutz)
- [x] `npm run build` + Tests grün
