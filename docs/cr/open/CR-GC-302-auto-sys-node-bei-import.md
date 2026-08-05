# CR-GC-302 — Auto-SYS-Node bei jedem Import

**Status:** open · **Angelegt:** 2026-08-05

## Problem

Die Import-Pfade (`se:import-code` / `graphcode import-code`, `importGraph`
Format-E-Bulk, `seedFromJson`/`reseed`) erzeugen Graphen **ohne SYS-Element**,
wenn die Quelle keins mitbringt. Der SYS-Knoten ist aber der Anker für:

- **AF-01..05** (contracts 3.1.0, CR-SM-227): Analysis-Freshness-Stamps leben in
  `SYS.attributes.analysisFreshness.<artifact>.graphVersion`. Ohne SYS greifen
  die Regeln in die Vacuous-Exemption („nothing to anchor on yet") — die
  fehlende Analyse wird **unsichtbar** statt laut.
- **Intent** (CR-GC-295/296): `graph_generate` liest die Intention aus
  `SYS.description`; ohne SYS fällt der Loop auf leere Intention zurück.
- **R-28-Familie**: gleiche Anker-Semantik.

Ein importierter Graph ohne SYS ist damit still un-governbar in genau der
Dimension, die die GVE-Parallel-Semantik-Entfernung (CR-GVE-224..229) jetzt vom
Substrat bezieht.

### Architektur-Entscheidung

Der SYS-Knoten wird bei **jedem** Import vom Substrat selbst sichergestellt
(ensure-Semantik, kein Overwrite): existiert kein Element vom Typ SYS, legt der
Import-Pfad `SYS-<scope.systemId>` an (name = systemId, description = leer bzw.
Import-Quelle als Hinweis) — **durchs Gate**, im selben Batch wie der Import
(Autor = Import-Verb, auditiert). Bringt die Quelle ein SYS mit, wird nichts
angelegt und nichts überschrieben.

## Scope (≤ 6 Dateien)

1. `src/import-code-verb.ts` — ensure-SYS im import-code-Batch
2. `src/harness-import.ts` (bzw. `harness.importGraph`) — ensure-SYS bei
   Format-E-Bulk-Import (replace **und** merge)
3. `src/harness.ts` — falls `seedFromJson`/`reseed` den Pfad nicht schon über
   importGraph teilen: gleiche Ensure-Stelle, kein Parallelpfad
4. `tests/harness.import.test.ts` — Import ohne SYS → SYS-`<systemId>` existiert;
   Import mit SYS → unverändert (kein Overwrite)
5. `tests/cli.run.test.ts` o. `tests/import-code.*` — import-code-Verb-Variante

## Akzeptanzkriterien

- [ ] Nach jedem Import (import-code, Format-E replace/merge, reseed) existiert
      genau **ein** SYS-Element; mitgebrachtes SYS bleibt byte-identisch
- [ ] Anlage läuft durchs Apply-Gate (Audit-Eintrag, kein Direkt-Write)
- [ ] AF-01..05 feuern nach Import ohne Stamps als Warning (kein Vacuous-Skip mehr)
- [ ] `npm test && npm run build` grün

## Folge-Punkte (nicht dieser CR)

- **Stamp-Writer in den Analyse-Skills** (Familie/claude-plugin): se-conops,
  se-fmea, se-trade, se-irr, se-plan setzen im Abschluss-Batch
  `SYS.attributes.analysisFreshness.<artifact>.graphVersion` — atomar mit den
  Findings (Entscheidung 2026-08-05: skill-seitig, fail-visible statt
  zentral-false-green).
- **Attribut-Abflachungs-Lücke:** `exportGraphJson` flacht `node.attributes` auf
  Top-Level ab; contracts-Regeln (R-19/VR-01/SC-04, jetzt auch AF-01..05) lesen
  `element.attributes.x` und sehen die Werte im Steering-/Generate-Pfad nie
  (dokumentiert in `tests/generate.test.ts`). Eigener CR nötig (Encoding-
  Entscheidung, Format-E-/Conformance-sensibel).
