# CR-GC-992: graph_test_ingest: Eingabe in drei Varianten, ohne refine

**Typ:** aus Item ITEM-2026-1560 (idea)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1560.json (Lane: code)

---

## Befund

Entscheidung des Autors vom 2026-11-21: In einem Vertrag gibt es kein `z.custom`, kein `refine`, kein `superRefine`; der Vertragstest entsteht aus dem Generator. `GraphTestIngestInputSchema` (SCHEMA-test-ingest-input) war die letzte Stelle: zwei `.refine` („höchstens eines von report und results“, „mindestens eines von report, results und changeSet“), ein Handtest mit 23 Fällen, der Generator brach ab (`kein angenommenes Beispiel`).

## Änderung

Die Eingabe bleibt ein Objekt (die Tool-Registry verlangt ein Objekt-Schema, `strengesSchema`). Das Pflichtfeld `ingest` trägt genau eine von drei Varianten, gewählt über `art`:

```ts
z.strictObject({
  ingest: z.discriminatedUnion('art', [
    z.strictObject({ art: z.literal('report'),   report: z.string(),                    changeSet: GeaenderteKnoten.optional() }),
    z.strictObject({ art: z.literal('results'),  results: z.array(<file, result, tool?, evidence?>), changeSet: GeaenderteKnoten.optional() }),
    z.strictObject({ art: z.literal('withdraw'), changeSet: GeaenderteKnoten }),
  ]),
  consumerId: z.string().default('test-ingest'),
  dryRun: z.boolean().default(false),
})
```

Die alte flache Form wird nicht mehr angenommen (kein paralleler Pfad). Aufrufe:

| Variante | Aufruf |
|---|---|
| Bericht | `{ ingest: { art: "report", report: "<vitest json>", changeSet: ["FUNC-a"] } }` |
| Ergebnisse | `{ ingest: { art: "results", results: [{ file: "tests/a.test.ts", result: "passed" }] } }` |
| Rücknahme | `{ ingest: { art: "withdraw", changeSet: ["FUNC-a"] } }` |

**Code (3 Dateien).** `src/projections/testreport.ts` (Schema, Handler), `scripts/aenderung-melden.mjs` (die Spuren `verify:code` und `verify:full` rufen es über `meldeZurueck`; mit Bericht `report`, sonst `withdraw`), `src/projections/vertragstest.ts` (der erzeugte Hinweistext der Testdatei von Hand nennt die neue Form). `scripts/verify-code.mjs` und `verify-full.mjs` rufen nur `meldeZurueck` und bleiben unverändert. Texte in `README.md`, `CLAUDE.md`, `.claude/commands/se-bau.md`, `se/author-req.md` nennen `graph_test_ingest` ohne Aufrufform: keine Änderung nötig.

**Tests (6 Dateien).** Aufrufe nachgezogen in `testreport.test.ts`, `testreport.kopf-bindung.test.ts`, `test-von-hand.test.ts`, `testreport.ruecknahme.test.ts` (dort der Schematest, der „keins“ und „beides“ abwies, ist jetzt „genau eine Variante; alte Form abgelehnt“). `mcp.agent-agnostic.test.ts` (c2): `tools/list` zeigt `ingest` als Pflichtfeld mit `oneOf` über die drei Varianten und ihren Texten, für beide Clients. `vertragstest.test.ts`: der Hinweistext nennt `art: "withdraw"`.

**Vertragstest.** `tests/vertrag/SCHEMA-test-ingest-input.vertrag.test.ts` aus dem Generator, 73 Fälle; die Handdatei (23 Fälle) ist ersetzt. Deckung Fall für Fall und Mutanten: `docs/messung/vertragstest-mutanten-cr-gc-992.md`.

Aussagen der Handfälle ohne Ersatz: (1) der Wortlaut der beiden Fehlermeldungen („supply report, results or changeSet“, „at most one of report or results“): es gibt sie nicht mehr; die Fälle sind nicht ausdrückbar, Zod meldet den Strukturfehler. (2) „report und results zugleich“ als genau diese Kombination: der Generator prüft je Variante ein Zusatzfeld (strikt), nicht gerade `results` an `report`; der Schematest in `testreport.ruecknahme.test.ts` prüft diese Kombination.

**Platz in `tools/list`.** Die Vereinigung braucht mehr Zeichen als das flache Objekt; Schranke 28.300 unverändert, Platz aus CR-GC-995. Stand danach gemessen.

**Voraussetzungen.** CR-GC-994 (Generator friert die Werteliste des Art-Felds ein), CR-GC-995 (Platz in `tools/list`). Folge-Item für die Aufrufer außerhalb dieses Repos: ITEM-2026-1562.

**Modell.** `SCHEMA-test-ingest-input` und `TEST-vertrag-test-ingest-input`: Beschreibung nachgezogen.

Gezählt: 3 Quell-, 6 Test- und 1 Messdatei, zusammen 10, dazu 1 erzeugte.

## Selbstbezug der Spuren

`verify:code` und `verify:full` rufen `graph_test_ingest` über den laufenden Host. Nach dem Build lief der Host mit der alten Form: `owner.lock`-pid 21175 beendet, der nächste Aufruf startete pid 80287 mit dem neuen `dist`. Danach meldete `verify:code`: 53 Ergebnisse geschrieben, im Audit-Log ein Eintrag `verify-lane` mit 53 Kommandos (graphVersion 1469), `TEST-vertrag-test-ingest-input` trägt `result: passed` mit neuem `ranAt`.

## Akzeptanz

- [x] `npm run build` grün; `verify:code`: 69 Dateien, 928 Tests grün, Rückmeldung 53 Ergebnisse.
- [x] Mutanten V1–V6, S1–S4 im erzeugten Test rot.
- [x] `grep` nach `z.custom`, `.refine(`, `.superRefine(` in `src/`: nur Kommentare.

---

## Entscheidungen

Keine: der CR wendet die Entscheidung des Autors vom 2026-11-21 an.

## Umfang laut `graph_impact`

Wurzeln: `SCHEMA-test-ingest-input`, `FUNC-test-ingest`, `FUNC-aenderung-melden`. Berührt: `FLOW-test-ingest-call`, `FLOW-test-run-report-code`, `FLOW-test-run-report-full`, `FUNC-verify-lane-code`, `FUNC-verify-lane-full`, `TEST-vertrag-test-ingest-input`.
