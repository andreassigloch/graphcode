# CR-GC-954: CR-GC-918 Rest: eigene REQ fuer 29 FUNCs (R-02), Kind-REQ am Testcode pruefen, Nebenbefunde

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1422 (finding)
**Vorgaenger:** CR-GC-918 (RD-06 = 0, geschlossen 2026-11-17)
**Erstellt:** 2026-11-17
**Item:** bok/items/ITEM-2026-1422.json (Lane: graph)

---

## Befund

CR-GC-918 hat jede REQ auf genau einen Erfueller gebracht (RD-06 40 → 0). Danach haben 29 Funktionen keine eigene
Anforderung (R-02). Sie hingen nur an einer Sammel-REQ, die eine andere Funktion oder eine Menge beschreibt.
Daraus folgen 85 R-21-Befunde. Die Kind-REQ-Texte und ihre TEST-Zuordnung aus dem Spike sind nicht am Code geprueft.

Die 29 FUNCs: FUNC-arch-fitness, FUNC-author-actor, FUNC-author-req, FUNC-author-uc, FUNC-authoring-guide,
FUNC-cli-dispatch, FUNC-close-violations, FUNC-fit-advisory, FUNC-function-criticality, FUNC-graph-generate-tool,
FUNC-graph-help, FUNC-graph-merge-tool, FUNC-graph-reseed-tool, FUNC-host-proxy, FUNC-list-elements,
FUNC-module-metrics, FUNC-rules-tool, FUNC-se-help, FUNC-se-review, FUNC-se-status, FUNC-se-top-level,
FUNC-se-trade, FUNC-se-umbau, FUNC-serve-stdio, FUNC-target-profile-load, FUNC-test, FUNC-test-ui,
FUNC-tool-context, FUNC-verify-lane-code.

## Zielbild

Die Schritte 2 bis 4 aus CR-GC-918:

1. **Kind-REQ am Code pruefen.** Je Kind-REQ: Prueft der zugeordnete TEST genau diese Zusage? Wenn nicht, den Text
   auf das Gepruefte einengen oder den TEST ergaenzen (`se:author-req`). Vorrang haben `REQ-auto-export-nach-zug`,
   `REQ-status-sammeln` und `REQ-steuerung-deterministisch`.
2. **Eigene REQ fuer die 29 Funktionen**, je eine funktionale REQ mit TEST (`se:author-req`, EARS). Ist eine
   Funktion nur ein innerer Schritt ohne eigene Zusage, wird sie mit Grund akzeptiert und hier gelistet.
3. **Nebenbefunde:** Wie, Aenderungsnotizen und Altkennungen aus den Eltern-REQ-Texten streichen; „Dimension“ in
   `REQ-steering-from-metrics` durch „Stufe“ ersetzen; die zwei Prozessvorgaben aus den Texten nehmen; das Duplikat
   `REQ-store-recovery` gegen `REQ-schema-version-migration` und `REQ-first-session-claims-store-lock` aufloesen.

## Akzeptanz

- [ ] R-02 = 0, oder jeder verbleibende Befund mit Grund akzeptiert und hier gelistet.
- [ ] RD-06 bleibt 0; keine neue Fehlermeldung, R-01 = 0.
- [ ] Jede Kind-REQ hat einen TEST, der genau ihre Zusage prueft; Abweichungen hier gelistet.
- [ ] `npm run verify:model` gruen; `docs/graph` und `docs/views` im selben Commit.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1248, Tiefe 1, Wurzeln: `FUNC-arch-fitness`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 1):
- packages/se-engine/src/metrics.ts

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
