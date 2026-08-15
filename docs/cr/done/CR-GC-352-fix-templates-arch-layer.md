# CR-GC-352 — Auf der Architektur-Ebene ist keine Suggestion anwendbar

**Status:** done · **Angelegt:** 2026-08-15 · **Abgeschlossen:** 2026-08-15 · **Max Files:** 6
(dieser CR: **3**)
**Sibling:** [CR-SM-241](../../../../sigloch-modules/docs/cr/done/CR-SM-241-fix-templates-fuer-die-architektur-operatoren.md)
— geliefert in `@sigloch/se-optimizer@0.5.0`.
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
   (se-optimizer → 0.5.0, gemeinsamer Publish mit CR-SM-240). Umfang dort: `R-22`, `R-23`, `SC-02`, `SC-04`.
   **`R-10` ist NICHT dabei** — der Fix ist additiv, aber die Richtung nicht (fehlt dem FUNC der
   Ein-, der Ausgang oder beides?), und auf dem Referenzgraphen feuert R-10 aktuell **null** Mal,
   der Nachweis hätte also kein Subjekt. `IO-01` (21 Funde) braucht Element-Erzeugung, was
   `fix-templates.ts` ausdrücklich ausschliesst.
2. **Ebenen-Konsistenz sichtbar machen** — **bleibt hier**, denn `fitAdvisory` wird in graphcode
   berechnet und ist auf `layer: 'arch'` festgenagelt ([`src/harness.ts:524`](../../../src/harness.ts)).
   Entweder es misst auf der Ebene, auf der gerankt wurde, oder die Tool-Antwort benennt die
   Messebene beider Zahlen. Heute können sie auseinanderlaufen, ohne dass es jemand merkt.

**Reihenfolge, umgesetzt:** erst **2** (graphcode-lokal, kein Paket-Bump), dann CR-SM-240 →
CR-SM-241 → hier nachgezogen.

---

## 4. Ergebnis

### 4.1 Ebenen-Konsistenz (Punkt 2) — die Antwort steht jetzt im Ergebnis

Gewählt wurde die zweite Option: **`fitAdvisory` misst weiter auf `'arch'`, aber die Tool-Antwort
benennt beide Ebenen.** Die erste Option — das Advisory auf der Ranking-Ebene messen — hätte die
Ranking-Ebene durch `mutate()` fädeln müssen, also die Gate-API für ein Reporting-Anliegen
verbreitert. Das Gate weiss nicht, worauf jemand gerankt hat, und soll es nicht wissen müssen.

`GraphSuggestResult` trägt jetzt:

| Feld | Bedeutung |
|---|---|
| `layer` | Messebene des **Rankings** (= Eingabe) |
| `advisoryLayer` | Messebene des **Gate-Advisorys**, fest `'arch'` |
| `layerMismatch` | Ein Satz, sobald die beiden auseinanderlaufen — im Ergebnis, nicht im Log |

Dazu trägt `verdict` jetzt `fitDelta`, das Δm des dryRun-Advisorys. Vorher wurde diese Zahl
**weggeworfen**: ein Treiber musste sie über einen eigenen `graph_mutate`-dryRun holen — und bekam
sie dann ohne jeden Hinweis, dass sie von einer anderen Ebene stammt als sein Ranking. Genau so
entsteht die stille Fehlinterpretation, um die es hier geht.

Erzwungen, nicht dokumentiert: `tests/mcp.suggest.test.ts` prüft beide Hälften — Mismatch gesetzt
bei `layer:'all'`, **abwesend** bei `layer:'arch'` (sonst wäre der Hinweis Dauerrauschen statt
Signal) — und dass `fitDelta` wirklich die Advisory-Zahl ist: für `CR-1 ─relation→ FUNC-parse` ist
sie null (CR liegt nicht im Arch-Teilgraphen), während das Ranking auf `'all'` sehr wohl ausschlägt.

### 4.2 Templates (Punkt 1) — der Default-Layer trägt wieder

Mit se-optimizer 0.5.0 scort auf der Steering-Fixture `SC-04 FLOW-document ─relation→
SCHEMA-result` **+0.5000** (faultTolerance) bzw. **+0.2778** (scalability); die vier Alt-Templates
bleiben exakt **0.0000**, weil ihre Knoten weiter ausserhalb des Teilgraphen liegen. Damit ist der
Befund aus §2 umgekehrt: es gibt wieder eine Zielrichtung, die die Auswahl erreicht.

**T-C2 läuft jetzt auch auf `layer: 'arch'`** (zwei neue Fälle in
[`tests/steering.architecture-causality.test.ts`](../../../tests/steering.architecture-causality.test.ts)):
vorhergesagte Δm = realisierte Δm, und das `fitAdvisory` des Gates stimmt mit dem Ranking überein —
auf `'all'` wichen die beiden konstruktionsbedingt ab. Red-first belegt: vor dem CR schlug die
Kernassertion mit `expected 0 to be greater than 0` fehl.

**`R-10` bleibt bewusst offen** (§3.1) und ist damit der einzige Rest dieses CR — kein Folge-CR
angelegt, weil er auf dem Referenzgraphen null Mal feuert und ein Nachweis kein Subjekt hätte. Wenn
er feuert, gehört er in einen eigenen CR mit der Richtungsfrage im Zentrum.

---

## 5. Betroffene Dateien (3)

| Datei | Änderung |
|---|---|
| `src/tools/suggest.ts` | `advisoryLayer`/`layerMismatch`/`verdict.fitDelta` + Tool-Beschreibung |
| `tests/mcp.suggest.test.ts` | beide Hälften des Mismatch-Hinweises + `fitDelta` ist die Advisory-Zahl |
| `tests/steering.architecture-causality.test.ts` | T-C2 auf `layer: 'arch'` |

`package.json`/`package-lock.json` (Range `^0.5.0`) gehören zu CR-GC-351.

@author andreas@siglochconsulting
