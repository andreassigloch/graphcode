# CR-GC-640: Extraktor liefert zodSymbols und fileScope fuer RC-08/RC-09, Messung am eigenen Modell

**Status:** ✅ Done (2026-09-24)
**Typ:** aus Item ITEM-2026-529 (idea)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-529.json (Lane: code)

---

Erster Schnitt aus ITEM-2026-528. conformance.ts liefert die zwei neuen CodeFacts-Felder aus CR-SM-358: zodSymbols je Datei (export const X = z.… bzw. Ableitung eines Zod-Symbols derselben Datei) und fileScope 'all' - dafuer werden neben den gebundenen Dateien alle Quelldateien unter src/ extrahiert. Danach Gate 7 fuer RC-08/RC-09 am eigenen Modell messen; die Zahl schliesst CR-SM-358 und bestimmt den Umbinde-Schnitt aus ITEM-2026-528. Floor folgt den Imports: @sigloch/contracts >=10.12 (bis zum Publish Link-Modus).

---

## Umsetzung (2026-09-24)

`src/kernel/conformance.ts` liefert die zwei Felder aus CR-SM-358:

- **`zodSymbols` je Datei:** Top-Level-`const`, deren Aufrufkette bei `z` beginnt — oder bei einer
  zuvor in derselben Datei deklarierten Zod-Konstante (`Base.extend(…)`). Nur die exportierten
  werden gemeldet. Typen und Interfaces zaehlen nicht.
- **`fileScope`:** Neben den gebundenen Dateien wird jede Quelldatei unter `src/` extrahiert, dann
  gilt `'all'`. Ohne `src/` bleibt der Lauf bei `'referenced'`, und RC-09 schweigt, statt zu melden,
  was es nie gesehen hat. Genau diese Luecke hat CR-GC-627 den zweiten Weg stehen lassen:
  `bootstrap.ts` war an keine Bindung angeschlossen.

**Nebenbefund, mitrepariert:** Der Test „SSOT ist RC-sauber“ filterte auf `severity === 'error'`.
Seit CR-SM-353 sind alle RC-Regeln `warning`, der Test war also leer und haette jede kaputte
Bindung durchgewinkt. Er filtert jetzt nach Regel (RC-01/02/03 = 0).

## Messung (Gate 7 fuer CR-SM-358)

| Repo | SCHEMA | fileScope | RC-04 | RC-08 | RC-09 |
|---|---:|---|---:|---:|---:|
| graphcode | 58 | all | 16 | **5** | 0 |
| siconizer | 7 | all | 1 | 0 | 0 (vor der Trennung: 1, siehe unten) |
| moneyflow | 122 | all | 0 | 0 | 0 |
| sirail | 11 | all | 0 | 0 | 0 |
| graph-view-edit | 8 | all | 0 | 0 | 0 |
| sigloch-modules, bok | 5 / 11 | referenced | 3 / 0 | 0 | — |

- **RC-08 = 5 in graphcode:** `AuditStats`, `GraphDelta`, `OntologyJson`, `RejectedTrace`,
  `SteeringSnapshot` sind an TS-Typen gebunden. Die 6 Typ-Bindungen auf `packages/…` (sigloch-modules)
  sind von hier aus nicht beurteilbar. Festgehalten als Ratsche in `tests/conformance.test.ts`
  (≤ 5, darf nur sinken); ITEM-2026-528 baut sie ab.
- **RC-09 = 0 in graphcode ist echt:** Jeder gebundene Zod-Vertrag wird nur in seiner modellierten
  Datei geparst, auch `MutateCommandSchema` (`gate.ts` und `preflight.ts`, beide modelliert).
  Die Vertraege, ueber die die bekannten Parallelpfade liefen (Format-E, `testRefs`), haben **keine
  Zod-Tuer**, deshalb sieht RC-09 sie heute nicht. Sichtbar werden sie mit dem Umbinden (ITEM-2026-528).
- **siconizer hat die Regel geschaerft:** `Config` wird nur in `src/cli/config.ts` geparst, das Modell
  nennt `src/cli/index.ts`. Das war zunaechst RC-04 **und** RC-09 fuer eine Ursache. Jetzt meldet es
  nur RC-04, mit dem Fundort („it is parsed in: src/cli/config.ts“). RC-09 bleibt dem echten zweiten
  Weg vorbehalten (modellierter Parser **und** fremder).

## Mitgezogen: Regelkatalog-Waechter

Zwei Waechter wurden rot und taten genau, wofuer sie da sind:
- `readiness.model` („phase gates + impl gates EXHAUSTIVELY span all V3_RULES“): RC-08/RC-09 hatten
  kein Gate. Die Zuordnung liegt in `@sigloch/graphcode-client` (`RC_PRESENCE_PARTNER`), jetzt beide
  auf R-26 wie RC-03/RC-04 (sigloch-modules `5c18bd2`).
- `evaluation.rule-catalog` (akzeptierte Differenz Gate-Katalog ↔ Voll-Katalog): RC-08/RC-09 stehen
  in `NOT_IN_GATE`, weil der Gate-Katalog keine CodeFacts hat. Das ist derselbe Grund wie bei RC-01…07.

VOLL: 1534/1536. Rot sind nur `distribution` und `lockfile-sync`, das bekannte Paar im Link-Modus
(contracts und graphcode-client liegen als Symlink auf der Arbeitskopie).

## Floor

`@sigloch/contracts` `>=10.11 <11` → `>=10.12 <11` und `@sigloch/graphcode-client` `^1.4.0` → `^1.5.0`
(Floor folgt den Imports: `zodSymbols`/`fileScope` und die RC-08/09-Gates gibt es erst ab dem naechsten Minor). Bis zum Publish ist graphcode nicht aus der Registry
installierbar, entwickelt wird im Link-Modus. `lockfile-sync`/`distribution` rot bis dahin — erwartet.

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
