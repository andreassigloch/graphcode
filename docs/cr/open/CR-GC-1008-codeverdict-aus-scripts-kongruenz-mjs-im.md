# CR-GC-1008: codeVerdict aus scripts/kongruenz.mjs im Paket exportieren

**Typ:** aus Item ITEM-2026-1594 (idea)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1594.json (Lane: graph)

---

Voraussetzung für ITEM-2026-1587 (aise-bok). Der Nachtlauf von aise-bok soll das Code-Urteil (kongruent · gedriftet · nicht prüfbar) je Repo der Familie lesen, ohne Host: openMeasured + graph_readiness + codeVerdict. `codeVerdict` und `binding` liegen heute in scripts/kongruenz.mjs (CR-GC-574, CR-GC-740), nicht im Paket. aise-bok darf sie nicht kopieren (FAQ familienfunktion-nicht-kopieren, berechnung-einmal-im-paket).
Umfang: die Rechnung in den Quellbaum (src/projections), Export aus @sigloch/graphcode, scripts/messung.mjs (T-V4) liest sie von dort, scripts/kongruenz.mjs entfällt (kein paralleler Pfad). Release bündeln (Memory: Release nur bei Bedarf).
Probe 2026-11-22 aus aise-bok mit dem Skript: 10 Repos in rund 14 s, 9 gedriftet, 1 nicht prüfbar. Autor, 2026-11-22: „Export, dann Nachtlauf“.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| Wie liest ein Repo außerhalb von graphcode das Code-Urteil? | Über den Paketexport `codeVerdict` (mit `binding`, `CodeVerdictSchema`) aus `@sigloch/graphcode`, angewendet auf `graph_readiness` aus `openMeasured`; kein Host, keine Kopie der Rechnung. | Autor, 2026-11-22 („Export, dann Nachtlauf“). Probe aus aise-bok: 10 Repos in rund 14 s. FAQ familienfunktion-nicht-kopieren. |

---

## Umsetzung

- Neu `src/projections/kongruenz.ts`: `binding`, `codeVerdict` (aus `scripts/kongruenz.mjs`, unverändert in der Rechnung) und `CodeVerdictSchema`; die Typen kommen aus dem Schema, der Erzeuger parst seinen Vertrag.
- `src/index.ts` exportiert `binding`, `codeVerdict`, `CodeVerdictSchema` und die Typen.
- `scripts/messung.mjs` (T-V4) nimmt `codeVerdict` aus `dist`. `scripts/kongruenz.mjs` ist gelöscht, kein zweiter Pfad.
- `tests/kongruenz.test.ts` importiert aus dem Paketeinstieg; `tests/vertrag/SCHEMA-code-urteil.vertrag.test.ts` erzeugt mit `graphcode vertragstest`.

## Modell

`FUNC-code-urteil` (realRef `kongruenz.ts#codeVerdict`) auf `MOD-projections`, in `FCHAIN-skill-report` (teilt `FLOW-readiness-report` mit `FUNC-graph-readiness`, FAQ func-an-welche-kette Punkt 1); Ausgang `FLOW-code-urteil` (sync) an `ACTOR-auftraggeber` mit `SCHEMA-code-urteil`. `REQ-code-urteil-mit-reichweite`, verifiziert von `TEST-kongruenz`; `TEST-vertrag-code-urteil` verifiziert das SCHEMA. Der Zug lief über den Host einer anderen Sitzung (pid 20404) per Proxy, dann `graph_export`.

## Nachweis

- `tests/kongruenz.test.ts` rot gesehen ohne den Export (`codeVerdict is not a function`), grün mit.
- `tsc --noEmit` ohne Fehler; Kongruenz- und Vertragstest 37 von 37 grün.
- `npm run verify:code`: volle Spur, 7.357 von 7.358 grün. Rot: `tests/distribution.test.ts` (Fremd-Install des Pakets), weil `@sigloch/contracts@^12.17.0` noch nicht veröffentlicht ist (offener Release-Zug seit 2026-11-22 15:31). Vorbestand, nicht von diesem CR.
- Nicht veröffentlicht. aise-bok braucht für ITEM-2026-1587 ein Release von graphcode; das gibt der Autor frei.
