# CR-GC-352 — Auf der Architektur-Ebene ist keine Suggestion anwendbar

**Status:** open · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **Sibling-CR + Nachzug**)
**Ziel:** `graph_suggest` liefert auf seiner Default-Messebene Vorschläge, die man auch anwenden kann.
**Herkunft:** Befund beim Bau von CR-GC-340 (T-C2). Gemessen, nicht vermutet.

---

## 1. Root Cause

`@sigloch/se-optimizer` liefert konkrete Edits nur aus `FIX_TEMPLATES` — heute **vier** Regeln:
`CR-R01`, `CR-R04`, `MS-03`, `UC-02`. Alle vier hängen an CR-, MS- oder UC-Knoten.

`graph_suggest` misst per Default auf `layer: 'arch'`, und der Architektur-Teilgraph enthält genau
`FUNC/FLOW/MOD/SCHEMA/ACTOR`. CR/MS/UC sind darin nicht enthalten — auch `UC-02`s Kante
(`ACTOR ─io→ UC`) fällt heraus, weil ihr Ziel kein Arch-Typ ist.

**Folge:** auf der Default-Ebene hat **jeder** Template-Edit Δm = 0. Gemessen über alle sechs
Zieldimensionen, in beide Richtungen: die vier anwendbaren Suggestions scoren ausnahmslos 0.000,
während die hoch bewerteten Funde (`R-10`, `R-22`, `SC-04`) **kein** Template tragen.

---

## 2. Impact

- Ein Treiber, der auf `layer: 'arch'` rankt und den bestbewerteten *anwendbaren* Vorschlag nimmt,
  bekommt eine Zufallsauswahl unter lauter Nullen — die Zielrichtung erreicht die Auswahl nicht.
- Der Steuerungsnachweis T-C2 (CR-GC-340) musste deshalb auf `layer: 'all'` geführt werden. Dort
  funktioniert die Kette vollständig und ist bewiesen: Ziel → Ranking → echte Mutation → ℝ⁶ bewegt
  sich in Zielrichtung, um exakt den vorhergesagten Betrag.
- **Zweite Falle, gleiche Wurzel:** wer auf `layer: 'all'` rankt, aber das `fitAdvisory` des Gates
  liest, sieht Δ = 0 — das Advisory misst **immer** `layer: 'arch'`. Ranking-Ebene und Messebene
  müssen dieselbe sein; heute sagt das nur ein Kommentar im Test.

---

## 3. Fix-Vorschlag

1. **Templates für die Architektur-Operatoren** — `R-22` (FUNC ─allocate→ MOD), `R-10` (fehlende
   io-Kanten des FLOW), `SC-02`/`SC-04` (FLOW ─relation→ SCHEMA) sind alle additiv und
   template-fähig. Gehört nach `@sigloch/se-optimizer` → **CR-SM-xxx**, Version-Bump.
2. **Ebenen-Konsistenz sichtbar machen:** entweder `fitAdvisory` misst auf der Ebene, auf der
   gerankt wurde, oder die Tool-Antwort benennt die Messebene beider Zahlen. Heute können sie
   auseinanderlaufen, ohne dass es jemand merkt.

**Entscheidung, die ich brauche:** Reihenfolge — erst die Templates (macht die Default-Ebene
brauchbar), oder erst die Ebenen-Konsistenz (verhindert die stille Fehlinterpretation)?

@author andreas@siglochconsulting
