# CR-GC-801: Sicht fmea.md ist ein Risikoregister: ohne Kette, Traeger, Prioritaet, Nachweis und Massnahmenstand

**Status:** ✅ Done (2026-10-12)
**Typ:** aus Item ITEM-2026-873 (finding)
**Erstellt:** 2026-10-12
**Item:** bok/items/ITEM-2026-873.json (Lane: code)

**Freigabe:** Autor, 2026-10-12 (Schritt 1 von drei: Sicht verbessern, ohne das Modell zu ändern).
Gebaut auf `master` ohne Lane (Lokal-Modus).

---

## Befund

`docs/views/fmea.md` war ein Risikoregister: je Risiko ein Satz, S/O/D, RPN, die Gegenmaßnahme und ein
Haken, in uid-Reihenfolge. Das höchste Risiko (RPN 280) stand an sechster Stelle. Kette, Träger,
Priorität, Nachweis und der Stand der Gegenmaßnahme standen im Modell und nicht in der Sicht. Die Fußnote
nannte `testResult`, ein Attribut, das seit CR-SM-231b nicht mehr existiert.

## Änderung

`renderFmea` in `src/projections/graphcode.ts`. Die Sicht rechnet weiterhin nichts selbst:

- **Übersicht nach Priorität:** Risiko, Kette, S/O/D, RPN, AP, Träger, verifiziert. AP aus
  `actionPriority()` mit der Schwelle des Katalogs, Träger aus `riskCarriers()` (beide
  `@sigloch/contracts/se`).
- **Je Risiko ein Abschnitt:** Wortlaut, Bewertung, Kette, Anwendungsfall, Träger, Befund (`rationale`),
  Analyse-CR (über die `relation`-Kante).
- **Gegenmaßnahmen** mit Wortlaut und Erfüller; ohne Erfüller steht „Funktion fehlt".
- **Nachweis** je Test: Datei, Ergebnis, Datum des Laufs; ein Test ohne Bindung steht als „ungebunden".
- **Kopf:** zählt Risiken, hohe Priorität, Verifizierte, Gegenmaßnahmen ohne Funktion.
- **Fußnote:** sagt, dass die Sicht nur die Risiken zeigt, die als Anforderung im Modell stehen.

## Ergebnis

- **Test:** `tests/view-fmea.test.ts`, acht Fälle, vor dem Bau rot (sieben). `TEST-view-fmea` gebunden,
  prüft `REQ-doc-export`. `tests/views.conformance.test.ts` an das neue Layout angepasst (ein Fall).
- **Volllauf:** `npm run verify:full CR-GC-801`, 190 Dateien, 1596 Tests grün, Schlupf 0. Der erste
  Volllauf war rot an dem genannten Layout-Fall; er lag in der Auswahl.
- **Am eigenen Modell:** 7 Risiken, 6 mit hoher Priorität, 1 verifiziert, 2 Gegenmaßnahmen ohne Funktion.

## Was die neue Sicht am Modell sichtbar macht

- **`REQ-risk-gate-rule-eval-fails` (S 8, O 2, D 2) ist nach dem Katalog `Low`.** Die Analyse-CRs
  CR-GC-795 und CR-GC-798 führen es als Medium; ihre Abstufung unterhalb von High war eine eigene des
  Dokuments. Maßgeblich ist `actionPriority()`.
- **Zwei Risiken haben keine Kette:** `REQ-risk-store-unreadable` und `REQ-risk-gate-rule-eval-fails`
  hängen an `MOD-kernel`, an keinem Anwendungsfall.
- **CR-Knoten geschlossener CRs zeigen auf `docs/cr/open/`** (ITEM-2026-850).

## Benannt offen

- **Die Schwelle** kommt aus `DEFAULT_METRIC_POLICY`, nicht aus `graphcode.config.jsonc`; die Sichten
  bekommen keine Konfiguration. Heute sind beide 100.
- **13 von 20 Fehlerarten** stehen weiter nur in den Analyse-CRs. Schritt 2 (die ganze Analyse im
  Modell) ist eine Änderung an der Ontologie und nicht Teil dieses CR.
