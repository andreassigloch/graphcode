# Kennzahlen-Verlauf

Eine Zeile je Zug, geschrieben von `scripts/kennzahlen.mjs` — nie von Hand.
`MESSGROESSEN.md` trägt die Definitionen, hier steht der Verlauf. Der Verlauf ist nur
so viel wert wie seine Vergleichbarkeit: Steuerung und Befunde kommen vom laufenden Host
(derselbe Pfad wie das Gate), die Grenzmenge aus `grenzmenge.mjs` (CR-GC-545).

**ℝ⁶ (arch)** = modifiability / faultTolerance / flowEfficiency / coherence / viability / scalability.
**Steuerung** = Chebyshev-Score über die Regelüberschüsse; `worstAt` ist der dominierende Term.
**Grenzmenge** = modellierte von pflichtigen Schnittstellen (Symbole, die eine MOD-Grenze kreuzen).

_Die ersten beiden Zeilen (v284, v285) hat derselbe Recorder erzeugt, damals noch nach
`docs/records/` — das Verzeichnis ist git-ignored, ein Verlauf ohne History waere keiner.
Sie sind unveraendert uebernommen, als die Datei hierher gezogen ist (CR-GC-546)._

| Datum | v | Anlass | Knoten | ℝ⁶ (arch) | Steuerung | dominant | error | warning | FUNC-Grenze | SCHEMA-Grenze |
|---|---:|---|---:|---|---:|---|---:|---:|---:|---:|
| 2026-09-16 | 284 | Ausgangslage — vor dem ersten Grenzvertrag | 761 | 3.066 / 5.000 / 0.729 / 3.907 / 4.982 / 3.915 | 3.501 | R-04@MOD-kernel | 4 | 145 | 15/44 | 7/49 |
| 2026-09-16 | 285 | Modul 1: tool-contract.ts — drei Grenzvertraege (ToolPort, MCPTool, MCPToolRegistry) mit FLOW und io | 767 | 3.078 / 5.000 / 0.734 / 3.922 / 4.983 / 3.948 | 3.501 | R-04@MOD-kernel | 4 | 151 | 15/44 | 10/49 |
| 2026-09-16 | 287 | Modul 1 abgeschlossen: drei Grenzvertraege + Umfang am CR-Knoten | 768 | 3.078 / 5.000 / 0.734 / 3.922 / 4.983 / 3.948 | 3.501 | R-04@MOD-kernel | 4 | 151 | 15/44 | 10/49 |
