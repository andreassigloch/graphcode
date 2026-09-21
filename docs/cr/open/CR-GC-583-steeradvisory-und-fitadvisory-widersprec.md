# CR-GC-583: steerAdvisory und fitAdvisory widersprechen sich ohne Rang: RD-04-Fix (Zwischenebene) verschlechtert modifiability/coherence — opus5-6 zieht die Ebene ein, opus5-7 verwirft sie per Delta-m (runde7)

**Status:** ✅ Umgesetzt und am Bestaetigungslauf gemessen
**Typ:** aus Item ITEM-2026-431 (finding)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-431.json (Lane: graph)

---

## 1 Befund (Runde 7)

`opus5-6` zog fuer RD-04 eine Zwischenebene ein (24 FUNCs unter 5 Wertbloecken). `opus5-7` verwarf
denselben Zug per Δm, weil `modifiability` und `coherence` fielen, und liess **28 Bloecke auf einer
Ebene** stehen (RD-04 Ueberschreitung 2,1). Gleiches Modell, gleiche Lage, gegensaetzlich.

## 2 Ursache — die Entscheidung gab es schon, nur nicht fuer Claude Code

CR-GC-483 hat fuer den Executor entschieden: `rankCandidates` rankt nach Steuerwert
(`steerImprovement`), der ℝ⁶ aus `fitAdvisory` ist nur noch Bericht — er "nannte die eine
bestaetigte Umstrukturierung eine Regression" (CR-SM-281/287). Der Host-Prompt fuer MCP-Clients
sagte weiter "vergleiche tier und fitAdvisory (Δm, regressions)", der Skill `se:generate` zweimal
"Δm-Vergleich entscheidet", die alloc-Vorlage ebenso. Zwei Treiber, zwei Rangfolgen.

Die Leitlinie stuetzt die Richtung: Satz 3 — "Das Guetemass ist Verstaendlichkeit: wenige Bloecke
pro Ebene … Die Schwellen stehen in den Regeln." RD-04 ist diese Regel.

## 3 Umsetzung

- `GATE_PROTOCOL.host`: block verwerfen → steeringDelta der Fokus-Dimension →
  `steerAdvisory.improvement` → tier; "fitAdvisory ist nur Bericht und entscheidet nicht".
  `driver` nennt dieselbe Ordnung.
- `.claude/commands/se/generate.md` und die alloc-Vorlage: "der Steuerwert entscheidet".
- Abnahme `tests/generate.test.ts`: die Reihenfolge im Prompt, der Bericht-Satz, der alte Satz fehlt.

**Offen:** `se:top-level` liest `fitAdvisory` gegen ein Zielprofil — das ist die ℝ⁶-Optimierung
nach der Freigabe, ein eigener Fall. `fitAdvisory` wird weiter ausgeliefert.

## 4 Kriterien

| # | Kriterium | Ergebnis |
|---|---|---|
| 1 | Eine Rangfolge fuer Host und Executor, im Prompt und im Skill | erfuellt |
| 2 | Bestaetigungslauf: RD-04 bleibt nicht ueber der Schwelle stehen | erfuellt (n = 1) |

## 5 Bestaetigung

Bestaetigungslauf `opus5-9` (2026-09-21, sigllm-Prosa, Claude Code, 1 Lauf): 265 Elemente, Konformitaet 1,0, 10,85 $, 22 min.

8 Wurzel-FUNCs mit je 3–5 Kindern, jede Wurzel mit ihren Kindern im selben MOD (8 MODs zu 4–6
FUNCs). RD-04 steht nicht mehr unter den offenen Regeln; der schlimmste Steuerterm am Ende ist
R-04 auf einem MOD mit Ueberschreitung 1,0. Ein Lauf — die Richtung, kein Beweis.

**Kongruenz:** RC-* nicht aus dieser Session geprueft — benannte Ausnahme wie bei CR-GC-570.
