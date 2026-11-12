# CR-GC-905: UC Bestand erschliessen und verstreute Anforderungen zusammenfuehren (Zielgruppe Spezifikation)

**Status:** ✅ Done
**Abgeschlossen:** 2026-11-12
**Typ:** aus Item ITEM-2026-1290 (idea)
**Erstellt:** 2026-11-11
**Item:** bok/items/ITEM-2026-1290.json (Lane: graph)

---

## Problem

Alle neun UC im Modell sprechen „den Entwickler" an (v1046). Die Zielgruppe Spezifikation fehlt: wer
operativ Spezifikationen erstellt, will vorhandenen Bestand erschließen und verstreute Anforderungen
zu einem Anforderungsbaum zusammenführen. Herleitung: `docs/project/vorfuehrung-bausteinkonzept.md`,
Abschnitt „Use Cases von graphcode je Zielgruppe" und Demo-Baustein D3.

`UC-model-exchange` deckt nur einen Teil: Fremdquellen einlesen und Dokumente herausgeben. Das
Zusammenführen fehlt als Ziel. Im Modell gibt es dafür Bausteine, aber keinen Ablauf:
- `FUNC-import-doc` (Skill se:import-doc) hängt an keiner Wirkkette; `FCHAIN-model-import` und
  `FCHAIN-skill-import-code` lesen nur Code und Snapshots ein.
- Dubletten zusammenlegen geht heute über die Merge-Zeile in `graph_mutate`; ob dafür eine FUNC im
  Modell steht, ist im Zug zu prüfen.

## Zielbild

Ein UC aus Sicht der Zielgruppe Spezifikation, Arbeitstitel:
**„Bestand erschließen und verstreute Anforderungen zusammenführen"**.

- **Akteur:** die Person, die die Spezifikation erstellt. Im Zug zu klären: eigener Akteur oder
  Rolle von `ACTOR-owner`.
- **Auslöser:** Dokumente (PDF, Markdown, Text) und/oder Code eines bestehenden Systems liegen vor,
  die Anforderungen stehen verteilt und teils doppelt darin.
- **Ergebnis:** ein Anforderungsbaum im Modell: jede Anforderung einmal, an ihrem Träger, mit Verweis
  auf ihre Quelle; Dubletten zusammengelegt, Widersprüche als offene Fragen benannt.
- **Wirkketten:** der UC komponiert vorhandene Ketten, wo es sie gibt (`FCHAIN-model-import`,
  `FCHAIN-skill-import-code`). Für das Einlesen von Dokumenten und für das Zusammenführen fehlt je
  eine Kette; ob neu oder als Erweiterung, entscheidet der Auftraggeber im Zug.

## Abgrenzung

- **CR-GC-806** (Kern-UC Entwickler, Absicht bis Code) nennt Reverse Engineering als Szenario der
  Entwickler-Ketten: Code → Spec. Dieser CR endet beim zusammengeführten Anforderungsbaum, nicht beim
  Code, und sein Akteur ist nicht der Entwickler. Überschneiden sich die Ketten, bleibt eine Kette mit
  zwei UC-Eltern (zulässig für FCHAIN), keine Kopie.
- **UC-model-exchange** bleibt bestehen. Im Zug klären: schärfen auf Ein-/Ausgabe als Format oder im
  neuen UC aufgehen lassen (dann `/se-umbau`, `graph_impact` vor dem Löschzug).
- Die Zielgruppe Theorie bekommt keinen eigenen UC (Entscheidung Auftraggeber 2026-11-11).

## Vorgehen

Interaktiv mit dem Auftraggeber (`se:author-uc`), nicht im Automode: jedes Substantiv und Verb des UC
ins Modell, Lücken als Fragen. Fehlende Ketten und Funktionen nur benennen; bauen erst, wenn der
Auftraggeber sie bestätigt. Danach `graph_export` und Views.

## Abnahmekriterien

1. Ein UC mit Akteur, Auslöser und Ergebnis steht im Modell, ≤ 25 Wörter Beschreibung, durchs Gate.
2. Der UC komponiert mindestens eine Wirkkette; fehlende Ketten sind als offene Punkte im CR benannt.
3. `FUNC-import-doc` ist Glied einer Wirkkette oder als Lücke benannt.
4. Der UC trägt mindestens eine Anforderung mit verifizierendem TEST.
5. `rules_evaluate` meldet keinen neuen Error.

## Umfang

Modell: `SYS-graphcode`, ein neuer UC, compose auf Ketten, Akteur. Keine Code-Änderung. Lane MODELL
(`verify:model`).

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1045, Tiefe 1, Wurzeln: `UC-model-exchange`._

Reichweite: 0 Elemente (); Blackbox-Rand 0, nicht geoeffnet.

Dateien (realRef, 0):
- (keine)

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

---

## Ergebnis (2026-11-12)

Entscheidungen des Auftraggebers am 2026-11-12:
- **Akteur:** derselbe Anwender wie im Kern-UC, `ACTOR-auftraggeber`. Spezifizierer und Coder
  werden nicht als Rollen getrennt.
- **Fehlende Ketten:** nur als Lücke benennen, nicht bauen.

Modell v1098: `UC-consolidate-requirements` „Bestand erschließen und Anforderungen zusammenführen“
(23 Wörter): „Als Auftraggeber erschließe ich vorhandene Dokumente und Code und führe verstreute Anforderungen
zu einem Baum zusammen: jede einmal, mit Quelle, Widersprüche als Fragen.“ Er komponiert
`FCHAIN-model-import`, `FCHAIN-skill-import-code`, `REQ-model-exchange-pre` und
`REQ-model-exchange-post`. Beide REQ prüft `TEST-import-code-verb`. Durchs Gate, kein Befund.

Abnahme: 1 ✓ · 2 ✓ · 3 als Lücke benannt · 4 ✓ · 5 ✓.

### Offene Punkte

1. **Kette „Dokument einlesen“ fehlt.** `FUNC-import-doc` hängt nur an `FCHAIN-skill-authoring`, an
   keiner Einlese-Kette. CR-GC-910 baut import-doc zum Werkzeug der Tool-Schicht um; die Kette
   gehört dorthin.
2. **Kette „Anforderungen zusammenführen“ fehlt.** Dubletten legt heute die Merge-Zeile in
   `graph_mutate` zusammen; eine FUNC dafür gibt es nicht.
3. **Anforderung an das Ergebnis fehlt:** „jede Anforderung einmal, mit Quelle, Widersprüche als
   Fragen“ steht nur im UC-Text, nicht als REQ mit TEST. Folgt mit Punkt 2.
4. **`UC-model-exchange` unverändert.** Er teilt sich die beiden Einlese-Ketten und die zwei REQ mit
   dem neuen UC. Schärfen auf Ein-/Ausgabe oder Aufgehen bleibt offen (`/se-umbau`).
