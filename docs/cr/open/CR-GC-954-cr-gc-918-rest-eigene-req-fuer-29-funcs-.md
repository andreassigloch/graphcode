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

- [x] R-02 = 0 bis auf FUNC-verify-lane-code, dort abgenommen (`acceptedFindings`, Grund unten).
- [x] RD-06 = 0; keine Fehlermeldung, R-01 = 0 (gezaehlt am exportierten Modell, graphVersion 1305).
- [x] Jede Kind-REQ hat einen TEST, der ihre Zusage prueft; Abweichungen unten gelistet.
- [x] Testspur gruen; `docs/graph` und `docs/views` im selben Commit.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Was tun mit einer Zusage, die der Code nicht baut? | Aus dem Text streichen; wer sie will, legt ein Item an. | Autor 2026-11-19: Sicherung vor graph_reseed und Zwischenspeicher fuer spaet verbundene Viewer gibt es im Code nicht. |
| Wo steht eine doppelte Anforderung? | Da, wo sie umgesetzt wird: es bleibt die REQ, deren Erfueller die Zusage im Code umsetzt; die andere faellt, ihre Pruefkante wandert mit. | Autor 2026-11-19. |
| Was, wenn kein Test die Zusage prueft? | Den Test schreiben, nicht die Zusage streichen. | Autor 2026-11-19 (se:help, Suche in graph_elements). |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1248, Tiefe 1, Wurzeln: `FUNC-arch-fitness`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 1):
- packages/se-engine/src/metrics.ts

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

---

## Ergebnis

**Stand 2026-11-19**, graphVersion 1305.

| Messgroesse | vorher | nachher |
|---|---|---|
| R-02 (FUNC ohne eigene REQ) | 29 | 0 offen, 1 abgenommen |
| R-21 im Arbeitsbereich | 85 | 0 |
| RD-06 | 0 | 0 |
| REQ | 259 | 295 |
| Fehler | 0 | 0 |

- **Eigene REQ fuer 28 Funktionen**, je mit TEST; FUNC-graph-generate-tool und FUNC-rules-tool kamen schon mit CR-GC-934. Neue TEST-Knoten fuer bisher ungebundene Testdateien: skill-top-level-ausloeser, skill-keine-eigene-rechnung, skill-cr-ueber-aise, skill-faq-ergaenzung, skill-faq-angleich, cli-args, generate.stufen.
- **Neue Tests:** `tests/skill-se-help.test.ts` (se:help) und `tests/list-elements.search.test.ts` (Suchbegriff in graph_elements), beide erst rot, dann gruen gezeigt.
- **Kind-REQ am Code geprueft:** 55 REQ; 29 Texte enger gefasst oder an den passenden Test gehaengt. Geloescht als Duplikat: REQ-audit-stats-liefert-zaehlung, REQ-conflict-free-merge, REQ-update-ereignis, REQ-messpfad-liefert-stand, REQ-steuerung-deterministisch, REQ-delta-rankt-kandidaten. REQ-post-merge-nodes hat jetzt FUNC-graph-merge-tool als Erfueller, REQ-reseed-sichert-vorher FUNC-import-code-verb.
- **Nebenbefunde:** CR-Nummern, Altkennungen, „Controller", LLM-Bereitschaft und Late-Joiner aus den Elterntexten gestrichen; „Dimension" in REQ-steering-from-metrics durch „frueheste Stufe" ersetzt; die Prozessvorgaben aus REQ-full-run-on-probation und REQ-plan-gruppen/REQ-se-plan-nennt-gruppen entfernt; REQ-store-recovery auf den unlesbaren Store eingeengt, die Lock-Uebernahme als REQ-store-lock-uebernahme getrennt.

**Abgenommen:** R-02 an FUNC-verify-lane-code. Das Skript verdrahtet nur FUNC-plan-code-lane, FUNC-lauf-urteil und FUNC-aenderung-melden, die je eigene REQ mit TEST tragen; kein Test startet es.

**Offen, hier gelistet:**
- Ungepruefte Teile in bestehenden Texten: REQ-planmodus-meldet-nichts (`--plan`), REQ-volllauf-schreibt-schlupf und REQ-volllauf-nennt-folge (Skript verify-full), REQ-host-abbau-3s (die Zahl 3 s), „scheitert die Meldung, endet der Lauf rot" in REQ-lane-reports-change.
- REQ-stdio-fuehrt-im-repo-aus: TEST-mcp-stdio-server laeuft ueber einen Transport im Speicher, nicht ueber stdio.
- „Version und Wirkung im Ereignis" steht nach Wegfall von REQ-update-ereignis in keiner REQ; geprueft nur in `tests/live-feed.test.ts`, die keinen TEST-Knoten hat.
- TEST-first-step prueft `firstStepHint`; dafuer gibt es weder FUNC noch REQ.
- Die Eltern-REQ fuer die neuen Werkzeug-REQ sind teils Ermessen (RD-07 verlangt eine): REQ-modell-befragen fuer graph_authoring_guide und graph_help, REQ-reduced-llm fuer listElements, REQ-repo-install fuer `--help`.

