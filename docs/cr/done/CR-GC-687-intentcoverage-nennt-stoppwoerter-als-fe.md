# CR-GC-687: intentCoverage nennt Stoppwoerter als fehlende Konzepte: der Rundenprompt fordert Use Cases fuer 'spezifiziere', 'bis', 'liegt' — Tokenisierung des Auftragstextes ohne Wortartfilter

**Status:** ✅ Done (2026-09-26)
**Typ:** aus Item ITEM-2026-370 (bug)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-370.json (Lane: code)

---

## Befund

`extractIntentAnchors` (`src/loop/target-profile.ts:156`, vor dem Fix) zerlegt den Auftrag mit
`tokens()` aus `@sigloch/contracts/se` — und `tokens()` schreibt zuerst klein. Danach filtert nur
noch eine Funktionswort-Liste (`STOPWORDS`, Z. 121) und die Generika-Liste. Die Wortart, die ein
deutscher Text von sich aus traegt — Substantive und Eigennamen stehen gross —, ist zu diesem
Zeitpunkt schon weg. Verben (`spezifiziere`, `liegt`), nicht gelistete Praepositionen (`bis`) und
Pfadsplitter (`material`, `docs`) kommen als Anker durch, werden in `.graphcode/target-profile.json`
persistiert (`src/loop/suggest.ts:357`) und landen ueber `intentCoverage`
(`src/loop/generate.ts:572-581`) jede Runde in „Noch nirgends beschrieben: spezifiziere, bis,
liegt. Fehlt dazu ein Use Case …".

Gemessen am Auftrag aus `rig/sigllm-spezifikation/prompt.txt`: Anker vorher
`spezifiziere, sig, local, bis, implementierungsreife, projektdefinition, liegt`.

## Zielbild

Anker sind Begriffe. Ein deutscher Auftrag liefert nur Substantive und Eigennamen; die
Grossschreibung wird VOR dem Kleinschreiben gelesen. Keine handgepflegte Verbliste — die waere nie
vollstaendig (offene Wortklasse).

- **Sprache:** deutsch, wenn mehr deutsche als englische Funktionswoerter vorkommen (dieselben
  Listen, jetzt nach Sprache getrennt). Nur dort traegt die Grossschreibung eine Wortart.
- **Satzanfang** ist mehrdeutig („Spezifiziere", „Die") — ein Wort von dort zaehlt nur, wenn es im
  Satzinneren noch einmal gross steht.
- **Englisch** schreibt Substantive klein; dort bleibt es beim Funktionswort-Filter. Die
  EN-Liste bekommt vier fehlende Relativ-/Fragewoerter (`where`, `which`, `who`, `when`) — eine
  geschlossene Wortklasse, fuer die eine Liste das richtige Werkzeug ist.

## Umfang — 4 Dateien

| Datei | Aenderung |
|---|---|
| `src/loop/target-profile.ts` | `STOPWORDS` → `STOPWORDS_DE`/`STOPWORDS_EN`; neu `isGermanText`, `germanNounForms`; `extractIntentAnchors` filtert deutsch auf Substantive |
| `tests/intent-anchors.wortart.test.ts` (neu) | Rig-Auftrag, Coverage-Wirkung, Satzanfang, englischer Kontrast |
| `tests/target-profile.test.ts` | Erwartung ohne die Verben `suchen`/`bestellen` |
| `docs/cr/…/CR-GC-687-….md` | dieser Text |

`intentCoverage` selbst bleibt unveraendert — es misst korrekt gegen die Anker, die es bekommt.

## Akzeptanz

- [x] Rig-Auftrag → Anker `sig, local, implementierungsreife, projektdefinition, workspace, input`;
      kein `spezifiziere`, `bis`, `liegt`, kein Pfadsplitter
- [x] Test vorher rot (4/4), nachher gruen
- [x] `isIntentTooThin`-Faelle aus CR-GC-307 unveraendert gruen (`intent-anchors-internal.test.ts`)
- [x] `npm run build` gruen; alle Tests, die `target-profile`/`generate`/`suggest`/`report` importieren, gruen

## Ergebnis

Wurzel gefixt: die Wortart wird aus der Grossschreibung gelesen, bevor `tokens()` sie verwirft.
33 abhaengige Testdateien / 403 Tests gruen.

Bewusst offen:
- **Bestehende Configs** mit schon persistierten Stoppwort-Ankern bleiben, wie sie sind —
  `persistIntentAnchors` ueberschreibt nie vorhandene Anker (CR-GC-307). Wer betroffen ist, loescht
  `intentAnchors` aus `.graphcode/target-profile.json`; der naechste `graph_generate` leitet neu ab.
- **Englische Auftraege** koennen weiter Verben als Anker liefern (`order`, `pay`) — ohne
  Wortart-Signal im Text braeuchte das einen POS-Tagger, das ist ein eigener Schritt.
- **Deutsche Verben** fallen jetzt als Anker weg (`bestellen`); abgedeckt wird der Begriff ueber
  das Substantiv (`Bestellsystem`, `Bestellungen`).
