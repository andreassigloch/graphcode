# CR-GC-948: Messdokumente trennen: kennzahlen.md beschreibt zwoelf Groessen, stand.md traegt Wert und Verlauf je Release

**Typ:** aus Item ITEM-2026-1376 (idea)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1376.json (Lane: code)

---

**Status:** Umgesetzt 2026-11-15. Baut auf CR-GC-946 und CR-GC-947.

## Anlass

Derselbe Messwert steht an drei Orten mit drei Zahlen:

| Test | Leitlinie §9.3 | `stand.md` (2026-10-09) | Host am 2026-11-15 |
|---|---|---|---|
| T-V3 | SRR ja, PDR nein | fehlt | SRR, PDR, CDR |
| T-V4 Bindung | 114/115 | 108/109 | nicht neu gemessen |
| T-E8 | 4041 ms | 2708 ms | nicht neu gemessen |
| T-O1 | 24 von 25 | 49 von 79 (Korpus) | 33 von 33 |

`docs/messung/stand.md` erzeugt kein Ablauf; 4 von 12 Zeilen sind „nicht erhoben" mit Verweis auf einen CR,
den es nie gab (CR-GC-679B). `docs/messung/kennzahlen.md` führt vier Größen, die der Code nur noch in
Kommentaren kennt: `completeness`, `phase_readiness`, `dimension_readiness`, `compliance`.

## Zielbild

Zwei Dateien, getrennte Rollen (Autor, 2026-11-15). Keine Zahl steht in beiden.

**`kennzahlen.md`, von Hand:** je Größe die Frage des Nutzers, Definition, Rechenstelle, wer handelt, Quelle
des Verlaufs. Zwölf Größen (elf aus dem Vorschlag, dazu die Ablehnungsquote aus CR-GC-943; die Größe „Abgleich Modell
und Code" entfällt, siehe Abweichungen):

| Nr. | Größe | Frage des Nutzers | Verlauf aus |
|---|---|---|---|
| 1 | Marken SRR bis Bau | Wie reif ist mein Modell? | Git-Historie (CR-GC-946) |
| 2 | Befunde je Stufe, Plan getrennt | Kommt die Arbeit voran? | Git-Historie |
| 3 | Steuerwert, Überschreitungen je Steuerregel | Wo ist der Schnitt am schlechtesten? | Git-Historie |
| 4 | Testergebnis je Anforderung | Ist belegt, was gefordert ist? | Git-Historie |
| 5 | Ketten bewertbar | Sind die Kettenanalysen möglich? | Git-Historie |
| 6 | Schlupf, bereinigt | Spart der Graph Testzeit? | Zeile je CR (CR-GC-947) |
| 7 | Bindung der Blackbox- und Schnittstellen-Tests | Trägt die Zusage hinter der Auswahl? | Zeile je CR |
| 8 | Grenzmenge | Passt das Modell zum Code? | Zeile je CR |
| 9 | Dauer Auswahl gegen Volllauf | Spart der Graph Testzeit? | Zeile je CR |
| 10 | Werkzeuglatenz | Ist das Werkzeug schnell genug? | `stand.md`, je Release |
| 11 | Ablehnungsquote je Regel und je Skill, Feuerbild je Regel | Helfen Regeln und Skills? | `audit_stats` mit `since` (CR-GC-943) |
| 12 | `graph_impact` bei CRs mit Löschung | Führt der Graph den Agenten? | `.graphcode/cr-messung.jsonl` |

**`stand.md`, generiert von `npm run messung`:** je Größe Wert, Vorwert, seit wann unverändert, Stempel; dazu
die Tabelle „ein Stand je Woche" aus dem Verlauf.

**Entfällt:** KPI 1 als Verhältnis (keine Schwelle, kein Handelnder; Nr. 12 liest dieselben Daten mit dem
Kriterium aus T-C3); „Verstöße je Element" und die Summe „offen"; die Zeilen T-O4 und T-O6 in `stand.md`
(einmalige Versuche, ihr Ergebnis steht in ihren CRs); die vier toten Größen in `kennzahlen.md`;
`.graphcode/cr-messung.log`; jeder Verweis auf CR-GC-679B.

**Takt:** `stand.md` entsteht je Release (Autor, 2026-11-15).

## Vorgehen

1. `kennzahlen.md` auf die zwölf Größen umschreiben; Schwellen und die Lesarten bleiben.
2. `scripts/messung.mjs`: Zeilen je Größe, Vorwert aus der committeten `stand.md`, Wochentabelle aus dem
   Verlauf, T-M3 nach dem neuen Kriterium. Jede Zeile ist erhoben oder gestrichen; „nicht erhoben" gibt es nicht.
3. Takt: prüfen, wie `aise release prepare` die Version setzt. Läuft dabei ein npm-Skript von graphcode,
   hängt `npm run messung` dort. Braucht es eine Änderung an aise, geht ein Item an bok.
4. `scripts/cr-messung.mjs`: die Größe Nr. 12 je CR festhalten, `cr-messung.log` streichen.
5. Leitlinie: der Diff unten geht an den Autor. Die Datei ändert nur er.

## Abnahme

- [x] `npm run messung` schreibt `stand.md` ohne eine Zeile „nicht erhoben" und mit der Wochentabelle (Lauf 2026-11-15, 15 Zeilen, 17 Wochen).
- [x] Ein zweiter Lauf nennt je Größe den Vorwert des ersten (Test auf der reinen Funktion: `tests/messung.test.ts`, „ein zweiter Lauf nennt je Groesse den Vorwert des ersten"; rot gesehen mit abgeschaltetem Vorwert, dann grün).
- [x] `kennzahlen.md` nennt keine Größe, die `grep` im Quelltext nur in Kommentaren findet. Geprüft mit `grep -rnw` über `src scripts tests .claude`: `completeness`, `phase_readiness`, `dimension_readiness` und `compliance` stehen nur in Kommentaren, Dokumentation und Tests, die ihr Fehlen belegen (`not.toHaveProperty`); sie sind aus der Datei gestrichen.
- [x] `npm run verify:full CR-GC-948` grün (Schlusszeilen unten bei „Prüfung").

## Diff an der Leitlinie, für den Autor

`docs/graphcode_leitlinie.md`, vier Stellen:

1. **§9.3, Tabelle der Tests:** die Spalte „Stand" entfällt. Unter die Tabelle kommt der Satz:
   „Den Stand je Test nennt `docs/messung/stand.md`, erzeugt von `npm run messung`."
2. **§9.3, Zeile T-M3:** Frage „Kommt die Arbeit am Modell voran?"; Messaufbau „Verlauf aus
   `graph_readiness`"; Kriterium „Fehler bleiben 0; eine erreichte Marke fällt nicht zurück; die Befunde je
   Stufe ohne Plan fallen oder sind abgenommen".
3. **§9.4, Zeile S1:** T-O4 und T-O6 aus der Liste nehmen; sie sind einmalige Versuche, keine Dauermessung.
4. **§9.5 „Bestand der Messaufbauten":** entfällt. Der Messaufbau je Test steht in §9.3, sein Stand in `stand.md`.

---

## Umsetzung

- **`docs/messung/kennzahlen.md`:** neu geschrieben. Je Größe ein Abschnitt mit Frage, Definition, Rechenstelle, Handelndem und Quelle des Verlaufs. Gestrichen: `completeness`, `phase_readiness`, `dimension_readiness`, `compliance`, KPI 1 als Verhältnis, die Zeile „Retro-KPIs" der Steuertabelle, die Zahlen im Text (außer datierten Beispielen). Geblieben: Schwellen, die Lesarten der Ablehnungsquote und des Feuerbilds, „Warum Bindung zweimal".
- **`scripts/messung.mjs` und neu `scripts/messung-stand.mjs`:** die reine Logik (Vorwert, „seit", Wochentabelle, Werte der Größen) steht in `messung-stand.mjs`, `messung.mjs` erhebt und schreibt. Zeilen: 15 (zuvor 12). Neu: Größen 3, 4, 5, 6, 7, 9 als eigene Zeilen `G3` bis `G9`; T-E1 liest jetzt Größe 12. Gestrichen: T-V1, T-O4, T-O6 und jedes „nicht erhoben".
- **Vorwert aus `stand.json`, nicht aus `stand.md`.** Der Lauf schreibt neben `stand.md` die Datei `stand.json` (Zod-Schema `StandSchema`); der nächste Lauf liest sie. Grund: Zellen in `stand.md` tragen `|`, Zeilenumbrüche und freien Text; ein Parser der Tabelle bräche, sobald ein Wert ein Zeichen mehr trägt. Die JSON-Datei hat ein Schema und fällt laut, wenn jemand sie beschädigt. `stand.md` wird nie gelesen.
- **Takt je Release:** `aise release prepare` ruft `npm version <bump> --no-git-tag-version` (`bok/scripts/aise/lib/release.mjs`, Zeile 343). npm führt dabei das Skript `version` aus; geprüft an einem Wegwerf-Paket. `package.json` trägt jetzt `"version": "npm run messung && git add docs/messung/stand.md docs/messung/stand.json"`. Build läuft vor dem Bump, das `dist` steht also. Die beiden Dateien liegen im Index, wenn aise den Release-Commit anlegt (`git commit` nimmt den Index). Keine Änderung an aise, kein Item an bok.
- **`scripts/cr-messung.mjs`:** die Zeile je CR und Sitzung trägt `loeschung` und `impactBeiLoeschung`; `kpi1` entfällt. `post-commit` schreibt keine `cr-messung.log` mehr (Ausgabe nach `/dev/null`).

## Prüfung

- `npm run build` grün.
- `npm run verify:full CR-GC-948`: 230 Testdateien, 1906 Tests grün. Schlusszeile: „Spur VOLL, Auswahl 230/230 (Graph 0), rot 0, Schlupf 0". Die Spur ist VOLL, weil `package.json` (Auslöser) im Diff steht.
- Neue Tests in `tests/messung.test.ts` (Vorwert, „seit", unbekanntes Urteil in `stand.json`, Kalenderwoche an den Jahresgrenzen, Wochentabelle, Nr 12 je CR, Nr 9 ohne Spur VOLL) und `tests/cr-messung.test.ts` (`loeschungsBefund`). Rot gesehen: mit abgeschaltetem Vorwert in `mitVorwert` schlugen 3 von 18 Tests an; wiederhergestellt grün.
- Zwei echte Läufe von `npm run messung`: der zweite nannte je Zeile den Wert des ersten als Vorwert (T-E8: 2499.2 ms im ersten Lauf, Vorwert im zweiten).

## Abweichungen

- **Größe „Abgleich Modell und Code" entfällt.** CR-GC-947 schrieb das Feld `abgleich` nicht: die Zählung gibt es in contracts nicht. Die Größe bräuchte einen CR in sigloch-modules. Aus dreizehn Größen werden zwölf; die Nummern danach rücken um eins auf (Dauer 9, Werkzeuglatenz 10, Ablehnungsquote 11, `graph_impact` 12).
- **T-V1 entfällt aus `stand.md`.** Seine Quelle (`rig/moneyflow-struktur/driver.mjs` in graphanalyze) gab nur Prosa aus; er war nie erhoben. Die Leitlinie §9.4 nennt T-V1 weiter in der S1-Zeile; der Diff an die Leitlinie (Punkt 3) kennt nur T-O4 und T-O6. Der Autor entscheidet, ob T-V1 mit ihnen aus der Liste fällt. `tests/messung.test.ts` führt die drei in `ENTFALLEN` und bleibt grün, ob die Leitlinie sie noch nennt oder nicht.
- **Größe 11 hat keine Zeile in `stand.md`.** Ihre Quelle ist `audit_stats` am laufenden Host; `npm run messung` öffnet keinen Host-Store (ein Eigner je Repo). Die Zeile ist damit gestrichen, nicht „nicht erhoben".
- **Größe 8 steht in der Zeile T-V4**, nicht in einer eigenen: T-V4 misst dieselbe Grenzmenge live. Eine zweite Zeile aus der Zeile je CR stünde mit zwei Zahlen für eine Größe da.
- **Zeile T-E1 misst nun Größe 12**, nicht mehr KPI 1. Die Leitlinie nennt in der Spalte „Frage" von T-E1 weiter „Graph statt Grep"; das ist Sache des Autors. Die Zeile urteilt „ohne Schwelle", denn T-C3 nennt keine Zahl.
- **Alle Größen G3 bis G9 urteilen „ohne Schwelle".** Die Schwellen stehen in `kennzahlen.md` (Größe 6: `SCHLUPF_SCHWELLE`, Größe 7 und 8: 100 %); `messung.mjs` urteilt nur dort, wo die Leitlinie ein Kriterium nennt.
- **`scripts/retro-kpi.mjs` rechnet KPI 1 weiter** für den Skill `se-retro`. Aus `kennzahlen.md` und `cr-messung.jsonl` ist er entfernt; der Skript-Code blieb unberührt (außerhalb dieses CR).
- **Dateigrenze:** mehr als 10 Dateien (handgeschrieben 10: `kennzahlen.md`, `messung.mjs`, `messung-stand.mjs`, `cr-messung.mjs`, `post-commit`, `package.json`, `tests/messung.test.ts`, `tests/cr-messung.test.ts`, dieser CR, dazu `stand.md`; erzeugt: `stand.json`, `testauswahl.jsonl`, `docs/graph`, `docs/views`), nach FAQ `cr-dateigrenze-ausnahme`: Teilen ist möglich nur, wo jeder Teil grün bleibt. Der Teil `cr-messung` (Skript, Hook, Test) wäre ein eigener grüner Teil gewesen; er hängt aber an derselben Definition in `kennzahlen.md` (Größe 12) und an der Zeile T-E1, die dieselbe Größe liest. Zwei CRs hätten dieselbe Datei geändert. Der Autor hat den Schnitt nicht verlangt.

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Eine Datei oder zwei? | Zwei: `kennzahlen.md` von Hand (Definition), `stand.md` generiert (Wert und Verlauf) (Autor, 2026-11-15). | Eine Textänderung an der Definition soll keine Codeänderung sein. |
| Wann entsteht `stand.md`? | Je Release (Autor, 2026-11-15). | Leitlinie §9.4. Je CR änderte jede Sitzung dieselbe Datei. |
| Trägt die Leitlinie den Stand? | Nein. Spalte „Stand" und §9.5 entfallen (Autor, 2026-11-15). | Der Stand stand an drei Orten mit drei Zahlen. |
| Woher kommt der Vorwert? | Aus `docs/messung/stand.json`, die der Lauf neben `stand.md` schreibt; `stand.md` wird nie gelesen. | Eine Markdown-Tabelle mit freiem Text in den Zellen zu parsen ist brüchig; JSON hat ein Schema. |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1201, Tiefe 1, Wurzeln: `FUNC-block-messwerk`._

Reichweite: 2 Elemente (FUNC 2); Blackbox-Rand 0, nicht geoeffnet.

Dateien (realRef, 0):
- (keine)

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
