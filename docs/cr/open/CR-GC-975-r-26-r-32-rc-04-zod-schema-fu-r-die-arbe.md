# CR-GC-975: R-26, R-32, RC-04: Zod-Schema für die Arbeitsmenge der Sitzung

**Typ:** aus Item ITEM-2026-1524 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1524.json (Lane: code)

---

## Befund

Zweiter Teil von CR-GC-973 (Entscheidung des Autors vom 2026-11-21: das Zod-Schema eines Datenvertrags ist Teil der Spezifikation). Dieser CR nimmt `SCHEMA-work-set` (Modul kernel). Das in CR-GC-973 als „CR-GC-974“ angekündigte Gegenstück trägt diese Nummer, weil 974 an einen anderen CR ging.

Stand graphVersion 1375: R-26 9, R-32 19, RC-04 23.

| SCHEMA | Code vorher | Beschreibung gegen Code |
|---|---|---|
| `SCHEMA-work-set` | Interface `Arbeitsmenge` in `src/kernel/measure/working-set.ts` | Beschreibung nannte „Spec-only, kein Zod-Datenvertrag“ und keine Felder: nachgezogen (uids, zuege). `FLOW-work-set` nannte als Beleg `src/projections/report.ts`; erzeugt wird die Arbeitsmenge in `src/surface/tool-context.ts` (`arbeitsmenge`): Beleg nachgezogen |

## Änderung

- `working-set.ts`: `ArbeitsmengeSchema` (uids: Liste nichtleerer Strings, zuege: ganze Zahl ab 0); `Arbeitsmenge` ist `z.infer` daraus, das Interface ist gelöscht. Die Verwender (`tool-contract.ts`, `tool-context-contract.ts`, `testreport.ts`, `report.ts`) importieren weiter den Typ aus derselben Datei, ohne Änderung.
- `tool-context.ts`: `arbeitsmenge()` gibt `ArbeitsmengeSchema.parse(arbeitsmengeAusAudit(...))` zurück. Das ist die Schnittstelle von `FUNC-tool-context` (realRef `createToolContext`, io auf `FLOW-work-set`).
- Modell: `realRef` am SCHEMA, Beschreibung und Beleg am FLOW nachgezogen, `TEST-vertrag-work-set` mit `verify` und `testRefs`, relation-Kanten dieses CR auf `SCHEMA-work-set` und `FUNC-tool-context` (CR auf FLOW ist nach R-18 nicht erlaubt).
- Tests: Generator `graphcode vertragstest SCHEMA-work-set` (5 Fälle) plus von Hand `tests/vertrag/SCHEMA-work-set.elemente.test.ts` (6 Fälle: leere Menge angenommen, negative und gebrochene Zugzahl, leere und falsch typisierte uid abgelehnt). Beide Dateien am selben TEST.

## Nachweis rot-zuerst

| Mutante (am Schema, zurückgenommen) | Ergebnis |
|---|---|
| `zuege` ohne `nonnegative` | 1 rot („negative Zugzahl“) |
| `uids` ohne `min(1)` je uid | 1 rot („leere uid“) |
| `zuege` ohne `int` | 1 rot („gebrochene Zugzahl“) |
| `uids` mit `min(1)` an der Liste statt je uid | 2 rot (leere Menge, leere uid) |
| Verdrahtung: `zuege` als String | `tests/read-tools.scope.test.ts` und `tests/working-set.test.ts`: 5 von 26 rot (der Parse läuft im Werkzeug-Kontext) |

## Nicht in diesem CR (an den Autor)

- `SCHEMA-suggest-answer`: Die Antwort von `graph_suggest` trägt `Suggestion`, `SuggestedEdit` und `SteerScore` aus dem Paket `@sigloch/se-engine` (TS-Interfaces, kein Zod). Ein Schema in graphcode wäre ein Nachbau eines fremden Vertrags. Varianten: (a) se-engine veröffentlicht die Zod-Schemas, graphcode importiert sie (Familien-Sache, Hüter sigloch-modules); (b) graphcode schreibt ein Spiegel-Schema mit `looseObject` für den Teil aus se-engine; (c) das SCHEMA wird geteilt: eigener Teil (layer, advisoryLayer, layerMismatch, verdict) als Zod, der se-engine-Teil `external`.
- `SCHEMA-steering-channel`: trägt `concept: true` und die Beschreibung „bewusst ohne Zod-Symbol, informationeller Prompt-Kontext, kein Wire-Format“ (CR-GC-573); `ChannelSlot<T>` ist generisch (`value: T | null | undefined`). Ein Schema wäre nur eine Fabrik `kanalSlot(wertSchema)`, und acht FLOW teilen das SCHEMA mit unterschiedlichem `T`. Varianten: (a) Fabrik, ein Schema je Verwendung ohne eigenen SCHEMA-Knoten; (b) das SCHEMA auf `{channel, text}` einengen, was `generate.ts` heute nur für den Text-Fall liefert; (c) das SCHEMA und die Entscheidung von CR-GC-573 aufheben (der Autor).
- `SCHEMA-audit-record`: `AuditEntry` in `@sigloch/graph-api-core` ist ein TS-Interface (`dist/audit.d.ts`), kein Zod-Schema, der Vertrag ist also nicht extern-mit-Zod. Das SCHEMA trägt `concept: true` und die Entscheidung von CR-GC-462 (WRITING is not DELIVERING: kein exportierter Typ, kein Liefervertrag). Der Leser `src/surface/audit.ts` castet (`as unknown as RawAuditEntry`). Varianten: (a) Zod-Schema für den Rohsatz am Leser (`audit-stats.ts`, `RawAuditEntry` wird abgeleitet), das CR-GC-462 aufhebt; (b) Schema im Paket graph-api-core (Familien-Sache); (c) bewusst ungebunden lassen, `concept` entfernen und R-26/R-32 offen halten.

## Akzeptanz

- [x] R-26 von 9 auf 8, R-32 von 19 auf 18, RC-04 nach Messung unten.
- [x] `npm run type-check` grün; Verträge grün, vorher rot gesehen.
- [x] `verify:code` und `verify:full CR-GC-975`: siehe Messung unten.

---

## Entscheidungen

keine

---

## Umfang laut `graph_impact`

`graph_impact(SCHEMA-work-set, 2)`: `FLOW-work-set`, `FUNC-tool-context` (realRef `createToolContext`), 8 Ketten über `compose` (Rand, nicht geöffnet).
