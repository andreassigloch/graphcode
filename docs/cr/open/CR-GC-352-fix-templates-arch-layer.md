# CR-GC-352 — Auf der Architektur-Ebene ist keine Suggestion anwendbar

**Status:** open · **Templates-Hälfte ausgelagert nach**
[CR-SM-241](../../../../sigloch-modules/docs/cr/open/CR-SM-241-fix-templates-fuer-die-architektur-operatoren.md)
(angelegt 2026-08-15) · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **Nachzug + Ebenen-Konsistenz**)
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

1. **Templates für die Architektur-Operatoren** → ausgelagert nach
   **[CR-SM-241](../../../../sigloch-modules/docs/cr/open/CR-SM-241-fix-templates-fuer-die-architektur-operatoren.md)**
   (se-optimizer → 0.6.0), blockiert auf CR-SM-240. Umfang dort: `R-22`, `R-23`, `SC-02`, `SC-04`.
   **`R-10` ist NICHT dabei** — der Fix ist additiv, aber die Richtung nicht (fehlt dem FUNC der
   Ein-, der Ausgang oder beides?), und auf dem Referenzgraphen feuert R-10 aktuell **null** Mal,
   der Nachweis hätte also kein Subjekt. `IO-01` (21 Funde) braucht Element-Erzeugung, was
   `fix-templates.ts` ausdrücklich ausschliesst.
2. **Ebenen-Konsistenz sichtbar machen** — **bleibt hier**, denn `fitAdvisory` wird in graphcode
   berechnet und ist auf `layer: 'arch'` festgenagelt ([`src/harness.ts:524`](../../../src/harness.ts)).
   Entweder es misst auf der Ebene, auf der gerankt wurde, oder die Tool-Antwort benennt die
   Messebene beider Zahlen. Heute können sie auseinanderlaufen, ohne dass es jemand merkt.

**Reihenfolge, entschieden:** erst **2** (graphcode-lokal, verhindert die stille Fehlinterpretation
sofort, braucht keinen Paket-Bump), dann CR-SM-240 → CR-SM-241 → hier nachziehen. Sobald 0.6.0
draussen ist, wird der T-C2-Nachweis aus CR-GC-340 auf `layer: 'arch'` wiederholt — er musste
bisher auf `layer: 'all'` ausweichen.

@author andreas@siglochconsulting
