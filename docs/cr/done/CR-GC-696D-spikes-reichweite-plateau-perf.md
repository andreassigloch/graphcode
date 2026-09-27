# CR-GC-696D: Spikes nach den neuen Operatoren — Reichweite statt Schrittzahl, Plateau-Zuege, Perf-Befund

**Status:** ✅ Done (2026-09-27)
**Typ:** Teil von CR-GC-696 (Teile 1, 2, 8), aus Item ITEM-2026-614
**Erstellt:** 2026-09-27

---

## (1) tests/steering.divergence-two-profiles.test.ts

**Root Cause.** Das Kill-Kriterium „zu kurz" mass Schrittzahl (> 2) und setzte damit einen
Ein-Kanten-Zugraum voraus. Seit se-engine CR-SM-356/367 liefert graph_suggest add-node-Zuege:
SCALABLE nimmt EINEN RD-04-Zug (Zwischenebene `FUNC-triage-ebene`) und erreicht **+0,4950** entlang
seines Ziels — mehr als die alte 5-Kanten-Kette (+0,3226). Danach hilft nichts mehr (Greedy-Optimum).
Aus demselben Grund fiel das schaerfste Divergenz-Kriterium („eine FUNC in verschiedenen Modulen"):
SCALABLE zieht eine Ebene ein, statt Allokationen umzusetzen.

**Fix (Entscheidung Koordinator: Reichweite statt Schrittzahl, Divergenz bleibt Kriterium).**
- Reichweite: `along(Trajektorie, eigenes Ziel) ≥` Spike-Protokoll (COHESIVE 0,1677, SCALABLE 0,3226 —
  die Werte, die CR-GC-488 wiederhergestellt hat). Gemessen: COHESIVE 0,1677 (5 Zuege), SCALABLE
  0,4950 (1 Zug). Der Regress, den der alte Block fing (COHESIVE +0,0245), faellt auch unter die
  neue Schwelle. EXHAUST behaelt die Zugzahl (> 2): dort misst sie die Groesse des Zugraums (25).
- Divergenz, schaerfste Form: jeder Lauf wendet einen Zug an, den das ANDERE Profil am selben Stand
  ablehnen wuerde (Advisory entlang des fremden Ziels ≤ 0). Das ist die Invariante hinter dem alten
  Sonderfall („nicht nur eine andere Teilmenge derselben Reparaturen"). Gemessen: COHESIVE R-18 ×3
  (−0,13/−0,14/−0,36), R-23 (−0,28); SCALABLE RD-04 (−0,3184). Symmetrische Kantendifferenz 12,
  Placebo reproduzierbar, keine Gate-Blocks.

**Beobachtung (nicht gefixt):** der Kopf des Tests sagt, `probe` und `advisory` fielen seit CR-GC-431
zusammen. Heute ist der publizierte `score` einer anwendbaren Suggestion `steer.improvement`
(zielprofil-unabhaengig); der probe-Lauf COHESIVE nimmt deshalb den RD-04-Zug bei Advisory −0,3184.
Das ist Absicht seit dem Chebyshev-Ranking, der Kommentar ist veraltet.

## (2) tests/arch.optimization-dry-run.spike.test.ts, Lauf A

**Root Cause.** Die Greedy-Schwelle war `score > 1e-9` — unter der Aufloesung der Augmentation im
Steuerwert (`worst + EPS_AUGMENT·mean`, EPS_AUGMENT = 1e-3). Solange der Aktionsraum fast leer war,
harmlos. Seit CR-SM-356 liefert se-engine Umhaenge-Zuege fuer BW-02/CR-01/R-04, und davon senkt eine
unbegrenzte Menge nur den Mittelwert: gemessen 15 Zuege bis zum Deckel, davon 11 mit score < 1e-3
bei unveraendertem Steuerwert (3,251 → 3,251 …). Der Spike zaehlte Plateau-Zuege als Reichweite —
genau das, was er seit CR-GC-488/510 ausdruecklich nicht tun will. Kein Zyklus; der Deckel war
richtig, die Annahme falsch.

**Fix.** `lowersMaximum`: ein Zug zaehlt nur, wenn `improvement > EPS_AUGMENT · steer.before`
(beweisbar: bei stehendem Maximum ist `improvement ≤ EPS_AUGMENT · mean ≤ EPS_AUGMENT · before`).
EPS_AUGMENT aus se-engine importiert, keine zweite Zahl. Deckel unveraendert (15).

**Neu gemessen** (Befund veraltet, wie der Test es verlangt): der Architektur-Aktionsraum ist nicht
mehr leer. Zwei Zuege senken das Maximum:
1. BW-02 @ FUNC-block-abfrage — FUNC-block-anleitung unter FUNC-block-abfrage (weg von FUNC-goal-steerer), 3,751 → 3,501
2. CR-01 @ MOD-agent-surface — FUNC-list-elements von MOD-kernel nach MOD-agent-surface, 3,501 → 3,251

Danach Engpass R-04 @ MOD-kernel, Befund-Bilanz 0/0, entlang des Zielprofils **−0,027**: der
Autopilot entschaerft die schlimmste Stelle, dient coherence/modifiability aber nicht. Gepinnt:
die zwei Zuege, der Engpass danach; R-32 (Vertragstest-Knoten) zu den Klassen ohne Topologiewirkung,
BW-02/R-04 als benannte PLATEAU-Umhaenge-Zuege im Rest. Der Test druckt jetzt jeden Zug mit
Steuerwert vorher/nachher (vorher lief er ohne Zugliste in den Deckel).

## (8) tests/perf.advisory-roundtrip.spike.test.ts — BLEIBT ROT, Eigentuemer SM

**Root Cause (gemessen, CPU-Profil `suggestEdits` auf der festen Basis `perf-basis.graph.json`).**
Nicht kinds. Die Eingabe ist seit CR-GC-665 eingefroren, also ist es die Engine:

| | 500 Knoten | 2000 Knoten |
|---|---|---|
| propose (`suggestEdits`) | 640 ms | 19 118 ms |
| Round gesamt | 1,55 ms/Knoten | 9,99 ms/Knoten |
| Wachstumsfaktor | | **6,44** (Schranke 3,0; Absolutschranke 10 ms/Knoten knapp gehalten) |

Bei 2000 Knoten (17,1 s in `suggestEdits`): 13,7 s in `fixFor → bestBySteer` (se-engine
`src/operators.ts`, CR-SM-356), das je Steuerregel-Fund fuer JEDEN Umhaenge-Kandidaten einen vollen
`evaluateAllRules` rechnet; darin 8,9 s ND-01 (`funcSimilarity`, paarweise Jaccard, O(n²)) und 3,0 s
CR-MS-Pruefung (`crShouldHaveMilestone`) — Regeln, die zum Steuerwert nichts beitragen.
`evaluateAllRules` allein skaliert 34 → 146 ms (4,3×); der Faktor 27× von propose kommt aus
(Kandidatenzahl waechst mit dem Graphen) × (quadratische Einzelauswertung).

**Einordnung:** eine Regression DIESES Zuges (CR-SM-356, se-engine 3b7e7fa), nicht vorbestehend, und
nicht in graphcode heilbar. Schwelle NICHT angehoben. **SM-Item vorgeschlagen:** `bestBySteer` bewertet
Kandidaten nur ueber `STEER_RULES` (+ die error-Regeln fuer die „kein neuer error"-Sperre), statt
ueber den ganzen Katalog inkl. ND-01.

## Tests

`steering.divergence-two-profiles` gruen, `arch.optimization-dry-run.spike` gruen (23 s statt 95 s),
`perf.advisory-roundtrip.spike` rot (SM, oben).
