# CR-GC-302 — Auto-SYS-Node bei jedem Import

**Status:** done · **Angelegt:** 2026-08-05 · **Geschlossen:** 2026-08-07

> ## Abschluss 2026-08-07
>
> **Umgesetzt:** `ensureSystemNode(nodes, systemId)` in `harness-import.ts` — eine
> Entscheidungsstelle, aufgerufen im **Choke-Point** `importOntologyGraph`, durch den
> alle Bulk-Pfade laufen (`seedFromJsonFile` → `importOntologyGraph`, `applyReseed` →
> `seedFromJsonFile`). Es gibt also keinen zweiten Ort, an dem man es vergessen kann.
> `ImportTarget` trägt dafür neu `systemId`. Für `import-code` liegt die Anlage als
> `add-node` **im selben Gate-Batch** (auditiert als `consumerId: import-code`).
>
> **Zusätzlicher Fund, mitgefixt:** der `import-code`-Reseed hätte einen vorhandenen
> SYS **gelöscht**. Der Stale-Filter räumt alles weg, was die Extraktion nicht wieder
> anlegt — und graphify liefert nie ein SYS. Ein Repo mit gepflegter Intention und
> gesetzten `analysisFreshness`-Stamps hätte beide beim nächsten Code-Import verloren.
> SYS ist jetzt vom Stale-Filter ausgenommen; Test `der Reseed loescht einen
> vorhandenen SYS NICHT` pinnt es.
>
> ### Abweichung von AC 2 („Anlage läuft durchs Apply-Gate"), bewusst
>
> Für `import-code` gilt es (Gate-Batch). Für den **Bulk-Pfad nicht** — und das ist
> Absicht, kein Versäumnis: `importOntologyGraph` ist per Konstruktion gate-frei. Der
> Modulkopf sagt es, und `ImportTarget` schneidet den Gate-Zugriff bewusst weg
> („keeps the gate out of reach from here by construction"); dieser Pfad umgeht auch
> R-01. Sein Kontrakt ist „Store ← materialisiertes SSOT", nicht „Mutation". Einen
> Gate-Aufruf dort einzubauen hätte eine dokumentierte Architektur-Invariante
> gebrochen (und eine Zirkel-Abhängigkeit erzeugt), um ein Häkchen zu erfüllen. Der
> eine zusätzliche Knoten reist im selben, ohnehin ungegateten Bulk-Load mit.
>
> ### AC 3 („AF-01..05 feuern als Warning") — messbar, aber nicht dort, wo der CR es vermutete
>
> `harness.evaluateRules()` (L2-Gate) evaluiert AF **überhaupt nicht**: `SE_DESCRIPTOR`
> ist `[...V3_RULES, ...MT_RULES]`, und `AF_RULES` stecken nur in `evaluateAllRules`
> (Voll-/Steering-Katalog). Der Test misst deshalb über `takeSteeringSnapshot` — dort,
> wo AF tatsächlich läuft. Der Kontrastfall (Graph ohne SYS ⇒ AF schweigt vakuös) ist
> als eigener Test gepinnt, damit die Failure-Mode, die dieser CR entfernt, sichtbar
> dokumentiert bleibt.
>
> ### Vier fremde Tests angepasst — Fixtures statt hochgezählter Zahlen
>
> `perf.batch-seed`, `graph-timetravel` und `harness.import-invariant` (×2) prüften
> exakte Knotenzahlen auf SYS-losen Fixtures und wurden durch den Anker um 1 zu hoch.
> **Nicht** die Erwartungen inkrementiert (das hätte die Off-by-one nur verschoben),
> sondern die Fixtures tragen jetzt ihren eigenen SYS — die realistische Form eines
> governten Graphen. Die Zählungen leiten sich zudem aus `FIXTURE.elements.length`
> ab statt aus Literalen, damit die nächste Fixture-Änderung nicht wieder als
> Zahlen-Drift auftaucht.
>
> **Neu:** `tests/harness.import-sys-anchor.test.ts` (7 Tests, realer Disk-Kuzu) +
> 2 Tests in `tests/import-code-verb.test.ts`. Vor dem Fix rot: 4 von 6.
> `npm run build` grün, **74 Testdateien / 489 Tests grün**.

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
