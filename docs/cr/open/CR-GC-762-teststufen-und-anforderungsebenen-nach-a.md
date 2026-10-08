# CR-GC-762: Teststufen und Anforderungsebenen nach Automotive SPICE benennen (Software und Hardware), Modul-Stufe ergänzen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-785 (idea)
**Erstellt:** 2026-10-08

---

## Entscheidung des Autors (2026-10-08, zu CR-GC-760 Frage 1)

„ich bleibe bei der lage, das ist eindeutiger, gleiche die teststufen nochmal mit a-Spice und SE Normen ab" —
danach: „benennung nach norm macht am meisten sinn, bitte beachten dass es auch Hardware sein kann."

## Befund

Die Stufe eines Tests kommt aus der Lage der geprüften Anforderung. Das entspricht der Norm: Automotive SPICE
ordnet eine Verifikation danach ein, WAS sie prüft. Die Benennung in der Testübersicht passte nicht dazu:

| Lage | vorher | jetzt (Automotive SPICE 4.0) |
|---|---|---|
| REQ unter dem SYS | „E2E" | Systemverifikation (SYS.5) |
| REQ unter einem UC | „acceptance / integration" | Anforderungsverifikation (SWE.6 · HWE.4) |
| REQ, die eine FCHAIN erfüllt | „integration" | Integrationsverifikation (SYS.4 · SWE.5) |
| SCHEMA | keine Stufe | Integrationsverifikation — Schnittstelle (SYS.4 · SWE.5) |
| REQ, die ein MOD erfüllt | keine Stufe | Komponentenverifikation (SWE.5 · HWE.3) |
| REQ, die eine FUNC erfüllt | „unit" | Unit-Verifikation (SWE.4 · HWE.3) |
| — | — | Validierung (VAL.1): keine Lage im Modell |

„E2E" benannte eine Technik; die Lage sagt nur „Systemanforderung". Am energymanager meldete die Übersicht
„26 E2E-Tests ✓", ohne dass ein Test etwas durchspielte.

In der Anforderungsmatrix stand „Integration (SWE.4)" — SWE.4 ist die Unit-Verifikation. Jetzt:
Architektur (SYS.3 · SWE.2) und Entwurf (SWE.3 · HWE.2), funktional (SWE.1 · HWE.1).

## Was gestrichen wird

- Die Wörter „E2E", „acceptance / integration", „scenario test" aus der Testübersicht.
- Die feste Angabe `n / n ✓` in der Funktionszeile — sie zählte nichts.

## Was dazukommt

- Stufen `component` (MOD) und `interface` (SCHEMA) in `levelsOfTest`; Zeilen „Module" und „Interface".
- Abdeckung je Zeile gezählt: geprüfte Systemanforderungen, Module und Funktionen mit geprüfter Anforderung,
  Schemas mit Test.
- Eine Zeile „validation (VAL.1) — no position in the model".

## Geprüft und verworfen

Durchspiel als „ein Test prüft alle Anforderungen eines Anwendungsfalls": am Bestand 18 von 161 Anwendungsfällen
(ohne solche mit nur einer Anforderung), im energymanager 1 von 11 — obwohl dort je Anwendungsfall ein Durchspiel
gebaut wurde. Das Merkmal trägt nicht.

## Umfang

`src/projections/helpers.ts`, `src/projections/incose.ts`, `tests/exporter.test.ts`, `tests/views.auditor.test.ts`,
erzeugte Sichten `docs/views/testconcept.md`, `docs/views/rtm.md`.

## Abnahme

`verify:full CR-GC-762`; im Link-Modus bleibt `distribution` bis zum Publish rot.
