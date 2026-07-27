# CR-GC-259: Creation-Enforcement sichtbar machen (kein stilles OFF)

**Status:** done (2026-07-26) · **Max Files:** 2 (graphcode)
**Kontext:** Audit 2026-07-26. CR-GC-221 baute das Interface für Creation-Currency, CR-GC-222
lieferte den *konsumenten-gefütterten* Provider (`creationCurrencyProvider` in
`src/viewer/panels.ts`). Ein **Klassifikator**, der die Currency selbst berechnet, existiert in
graphcode nicht — und der Produktpfad reicht folglich keinen Provider durch.

## Problem (Why)

`scoreReadinessWithConformance` (`src/conformance.ts`) — die Funktion, über die **jede**
Readiness-Oberfläche läuft (`graph_readiness`, `graph_help`, Dashboard) — ruft
`computeReadiness(violations, graph)` ohne dritten Parameter. Damit ist
`creationCurrency === undefined`, und in `scorePhaseGate`/`scoreImplGate` gilt:

```
const creationBlocking = currency ? creations.filter(...) : [];
```

Enforcement ist also **aus**. Die Gates melden ihre `creationArtifacts` weiter als Metadaten, aber
niemand prüft sie. Konkret: PDR liest `passed: true` bei nie durchgeführter FMEA und Trade Study.

Das ist als Back-Compat-Default dokumentiert (`readiness.ts` §CreationCurrencyProvider) — aber der
Report sagt es dem Konsumenten nicht. Genau die False-Green-Klasse, die CR-GC-250 für
Completeness geschlossen hat: aus `blocking: []` ist nicht ableitbar, ob es keine Blocker *gibt*
oder ob nicht *geprüft* wurde. Ein Dashboard, das „PDR grün" zeichnet, hat keine Möglichkeit, den
Unterschied zu sehen.

## Decision

1. **`ReadinessReport.creationEnforcement: 'on' | 'off'`** — gesetzt in `computeReadiness` aus
   `creationCurrency ? 'on' : 'off'`. Ein Feld, additiv, keine Semantik-Änderung an Gates.
2. **Bewusst NICHT: einen Klassifikator erfinden.** Die 5 Creations (`conops`, `fmea`, `trade`,
   `implplan`, `assumption-review`) sind „Judgment Work" und werden per **Scope-Currency**
   klassifiziert, nie per mtime (`panels.ts` §artifactsPanel). Wie Scope-Currency berechnet wird,
   ist eine offene Design-Frage; sie im Rahmen eines Audit-Cleanups zu entscheiden würde Gates
   nach falschen Kriterien rot/grün färben. Der Kommentar in `readiness.ts` benannte CR-GC-222 als
   Lieferant — der lieferte aber nur den Provider-*Bau* aus fremden Signalen, nicht die Messung.
   → Folge-CR.
3. **Kein Default auf `ABSENT_CREATION_PROVIDER`** (was Enforcement scharf schalten würde): das
   färbt schlagartig jedes Phase-Gate rot, weil per Definition alles `absent` ist. Ein
   Sichtbarkeits-Fix darf keine stillen Gate-Flips auslösen — das wäre die Umkehrung desselben
   Fehlers.

## Betroffene Dateien (2)

1. `src/readiness.ts` — Feld + Doc-Kommentar, gesetzt in `computeReadiness`
2. `tests/readiness.model.test.ts` — Test

## Akzeptanz

- [x] `computeReadiness([], graph)` ⇒ `creationEnforcement: 'off'`, und PDR liest im **selben**
      Report `passed: true` — der Test hält beide Aussagen zusammen, weil erst die Kombination den
      Befund zeigt.
- [x] `computeReadiness([], graph, ABSENT_CREATION_PROVIDER)` ⇒ `'on'` + PDR `passed: false`.
- [x] `summarizeReadiness()` erhält das Feld — `graph_readiness` liefert diese Projektion
      standardmäßig, das Flag darf nicht nur im `detail:true`-Pfad sichtbar sein.
- [x] Keine bestehende Gate-Assertion geändert (reiner Zusatz): `npm test` grün, 308 Tests.

## Folge-CR (offen, nicht in diesem CR)

**Creation-Currency-Klassifikator:** entscheiden, woran „current / stale / absent" für eine
Creation gemessen wird (Kandidaten: Existenz + Abdeckung der aktuellen Graph-Scope gegen den
Zeitpunkt der letzten Analyse; Record-Commit-Pin wie bei `se-irr`), dann in
`scoreReadinessWithConformance` durchreichen und `creationEnforcement` auf `'on'` bringen.
Erst dann ist CR-GC-221 vollständig eingelöst.
