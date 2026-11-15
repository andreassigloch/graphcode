# CR-GC-942: Skilltexte aus der FAQ ergänzen, Abgeschafftes streichen

**Typ:** aus Item ITEM-2026-1368 (finding)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1368.json (Lane: code)

---

**Status:** Freigegeben 2026-11-15 mit der Empfehlung (je Kandidat prüfen, ob der Satz in den Skill gehört); umgesetzt für 7 Skills, der Rest ist in „Entscheidungen“ benannt.

## Anlass

Am 2026-11-15 wurden alle 240 Antworten der FAQ (aise-bok) gegen alle 25 Skills geprüft, jeder Fund mit Zitat
beider Seiten: `aise-bok/docs/pflege/konflikte-skills-2026-11-15.md`. Die Quelle der Skills ist
`.claude/commands` in diesem Repo; andere Repos tragen Kopien.

Entscheidung des Autors vom 2026-11-15: Ein Skill geht der FAQ in jedem Fall vor. Widerspricht ein FAQ-Eintrag
einem Skill, löst ein CR im Repo des Skills den Konflikt. Bis dahin folgt ein Agent dem Skill.

## Kandidaten für einen Skilltext (ohne offenen CR)

| Nr | FAQ-Datei, Aussage | Skill | Warum | Offener CR |
|---|---|---|---|---|
| 2 | `test-wirklich-pruefend.md` Stand: „die Regel steht im Skill se-test". Nr. 2 bis 6 (Funktion probeweise kaputt machen, Differenz über Stellgröße, Test für die Verdrahtung). Dazu `positivkontrolle.md` Nr. 1, `fixture-zweig.md` Nr. 1, `typpruefung-tests.md` Nr. 1, `roter-test-vorbestand.md` Nr. 1 | `se-test.md` L9-24 | `se-test` behandelt Rot-zuerst für einen Fehler, nennt aber weder die Positivkontrolle bei „nichts gefunden", noch Rot-Nachweis im Nachhinein, noch `tsc --noEmit`, noch den Vorbestand-Nachweis per `git stash`. Die FAQ behauptet, die Regel stehe dort. | keiner |
| 5 | `entfernen-reihenfolge.md` Nr. 1 und 5: „Stelle zuerst den Ersatz bereit, dann alle Verbraucher um". `entfernung-konsumenten-sweep.md` Nr. 2: „Fahre `npm run check:grammar`". `referenzen-vor-nach-loeschen.md` Nr. 2 und 4: `graph_impact` „kennt nur die Nutzungskanten, die im Modell stehen"; nach dem Löschen greppen „in src und bin … und in allen Paketen". `modell-zug-wann.md` Nr. 3: Lane code hat keinen Store, melde es dem Autor | `se-umbau.md` §2 bis §5 (L35-80, L110) | Der Skill behandelt Impact und Modell-Zug, nennt aber Reihenfolge Ersatz vor Löschen, Konsumenten in anderen Repos, die Lücke von `graph_impact` und den Fall Lane code nicht. | keiner |
| 6 | `fix-template-edit.md` Nr. 4: „Wende einen Vorschlag mit `add-node` … als einen Batch durchs Gate an und ersetze den Platzhalternamen." `vorschlaege-nicht-automatisch.md` Nr. 3: Merge-Vorschlag nicht blind folgen | `se/optimize.md` L42-56 und L104-111 | Der Skill behandelt `retire` als einen Batch, aber weder `add-node` mit Platzhalter noch Merge-Vorschläge von `graph_suggest`. | keiner |
| 8 | `befund-abnehmen.md` Nr. 5 und 6; `befund-stehen-lassen.md` Nr. 4 und 6: Marke zählt den abgenommenen Befund weiter; bei Architekturregel „Grund in die Beschreibung des Elements"; FM-03 bei S >= 9 nicht wegrechnen | `se/close-violations.md` L7, L41; `se-review.md`; `se-status.md` | „Fertig" heißt im Skill „kein offener Befund"; die Marke kann trotzdem halten. Der Grund bei Architekturregeln fehlt. | keiner |
| 9 | `diagnose-default-full.md` Nr. 2: „Nach Schreibzügen der Sitzung liefert `rules_get_violations` nur die Befunde zu den Elementen, die die Sitzung geschrieben hat; `umfang.ausserhalb` nennt die Zahl der übrigen." | `se-review.md` L10, `se-status.md` L12 und L19 | Die Skills zählen Fehler und Warnungen aus `rules_get_violations`; nach Schreibzügen stimmt die Zahl nicht ohne `umfang.ausserhalb`. | keiner |
| 10 | `sync-async-bedeutung.md` Nr. 4: „Belege den Wert mit Datei und Zeile im Code; ohne Beleg lass das Merkmal weg." `sync-async-ablage.md` Nr. 1: eine Ablage hat keine Sonderbehandlung | `se-vorbereitung.md` L146-150 | Der Skill fragt den Autor und verweist auf „im Code heißt Ja", verlangt aber keinen Beleg mit Datei und Zeile. | keiner |
| 12 | `req-mit-test.md` Nr. 3: „Lege für ein gelassenes Risiko … einen ungebundenen TEST an, der beschreibt, was ein Nachweis wäre." | `se-fmea.md` L137 | Der Skill lässt ein abgelehntes Risiko im Dokument stehen und schreibt es nicht ins Modell. | keiner |
| 15 | `uc-oder-req.md` Nr. 1 und 2: „Lege einen UC nur für ein eigenes Nutzerziel an." Eigenschaft eines UC wird REQ. `vertrag-je-variante.md` Nr. 4: keine neue UC für eine Variante mit gleichem Auslöser und Vertrag | `se/author-uc.md` L13 („split it") | Der Skill kennt nur das Teilen; das Herabstufen zur REQ fehlt. | keiner |
| 16 | `graph-nutzung-messen.md` Nr. 3 und 4; `bindungsquote-und-deckung.md` Nr. 1; `ergebnis-nur-mit-gegenprobe.md` Nr. 3: Quote nie allein | `se-retro.md` L11, L16, L31 | Der Skill nennt `coveragePct` ohne Gegenzahl (Deckung) und zählt nicht „nur Befehle gegen das Repo". | keiner |
| 17 | `testref-binden.md` Nr. 4: „Nenne im Kopfkommentar der Testdatei genau eine TEST-uid"; `testdatei-ein-test.md` Nr. 3: kein zweiter TEST auf dieselbe Datei | `se/author-req.md` L60 | Der Skill sagt „add an entry to the TEST's `testRefs`", nicht den Kopfkommentar und nicht den Zwilling. | keiner |
| 18 | `akteur-mensch-und-agent.md` Nr. 1: „Mensch und Maschine mit gleicher Rolle sind ein Akteur." | `se/author-actor.md` L25 bis L31 | Der Skill führt „a non-human counterpart" getrennt; der Satz zur gleichen Rolle fehlt. | keiner |
| 19 | `zwei-baeume-func-mod.md` Nr. 3: „Allokiere keinen Funktionsblock auf ein MOD, nur Blatt-FUNC". `func-in-func.md` Nr. 3 | `se/top-level.md` L81 (Zerlegen einer FUNC) | Die Zerlegung verschiebt Kette und Flüsse auf die Kinder, nennt aber `allocate` nicht. | keiner |

## Abgeschafftes

| Nr | Skill, Zeile, Zitat | FAQ-Datei mit der Entscheidung |
|---|---|---|
| 4 | `se/generate.md` L16: „nicht als `commands`-JSON … JSON braucht nur noch `update-edge` (Kante umhängen)" | `format-e-vorbild.md` Nr. 2: „den Parameter `commands` gibt es nicht mehr" (CR-GC-706). `kante-aendern.md` Nr. 1 und 2: Umhängen ist `delete-edge` plus `add-edge` in einem Batch; `update-edge` ist die Tilde-Zeile. |

**Empfehlung:** Je Kandidat prüfen, ob der Satz in den Skill gehört (der Skill behandelt den Schritt) oder in der FAQ bleibt. Die Kandidaten 1, 3, 4, 7, 11, 13, 14 und 20 gehören zu offenen CRs (CR-GC-923, 920, 918, 934, 924, 919/921, 917, 910) und stehen nicht hier. Mehr als 10 Skill-Dateien: vor der Umsetzung teilen.

## Vorgehen

1. Je Zeile entscheidet der Autor: Skill an die FAQ angleichen, oder FAQ an den Skill. Die Empfehlung steht unten.
2. Vor jeder Änderung das Zitat an der Skill-Datei nachprüfen; die Zeilennummern stammen vom 2026-11-15.
3. Nach der Änderung: `tests` zur Skill-Konformanz grün, OpenCode-Kopien (`.opencode/skills`) neu erzeugt.
4. In aise-bok den FAQ-Eintrag nachführen: der Hinweis auf diesen offenen CR entfällt.

## Abnahme

- [x] Der Autor hat je Zeile entschieden (Freigabe 2026-11-15, Empfehlung); die Festlegungen stehen im Abschnitt „Entscheidungen“.
- [x] Je geänderter Skill-Stelle prüft ein Test den neuen Wortlaut oder die entfernte Nennung (vorher rot).
- [x] `npm run verify:full <CR>` grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Nr. 2, `se-test` | Aufgenommen: Positivkontrolle bei „nichts gefunden", Funktion probeweise kaputt machen, Differenz über Stellgröße, Test für die Aufrufzeile, `tsc --noEmit` zusätzlich (Version 3). Nicht aufgenommen: der Vorbestand-Nachweis per `git stash`. | Positivkontrolle und Typprüfung gelten familienweit (CR-SM-262, CR-GC-641, CR-GC-851, CR-GC-872, CR-SL-069); `roter-test-vorbestand` sagt „in graphcode entschieden, andere Repos nicht". |
| Nr. 5, `se-umbau` | Aufgenommen: Ersatz vor Verbrauchern vor Löschen, Nachweise zum Ersatz, Konsumenten in anderen Repos zuerst; `graph_impact` kennt nur Nutzungskanten im Modell (Version 4). Nicht aufgenommen: `npm run check:grammar` und `SWEEP_ALLOWLIST`; Lane code ohne Store. | Die ersten drei tragen sechs CRs (CR-GC-560, CR-GC-706, CR-GC-764 u. a.); `check:grammar` gibt es nur in sigloch-modules; Lane code steht seit CR-GC-939 im Skill. |
| Nr. 6, `se/optimize` | Nicht in diesem CR; aufzunehmen laut Maß (`add-node` mit Platzhalter, Merge-Vorschlag nicht blind). | Grenze von 10 Dateien je CR; geht in einen Folge-CR. |
| Nr. 8, `se/close-violations` | Aufgenommen: die Marke zählt einen abgenommenen Befund weiter; bleibt ein Befund stehen, steht der Grund in der Beschreibung des Elements (Version 6). Nicht aufgenommen: FM-03 bei S >= 9; `se-review` und `se-status` bleiben ohne Zusatz. | Die Marke trägt CR-SM-396; FM-03 S >= 9 steht nur in einem Repo (CR-SL-008, sigllm); `se-review` und `se-status` nennen keine Abnahme. |
| Nr. 9, `se-review`, `se-status` | Aufgenommen: jede Zählung nennt `umfang.ausserhalb` (je Version 4). | CR-GC-613 trägt den Schnitt auf die Sitzung; das Werkzeug liefert die Zahl, der Skill zählte ohne sie. |
| Nr. 10, `se-vorbereitung` | Nicht in diesem CR; aufzunehmen laut Maß (Wert mit Datei und Zeile belegen, sonst Merkmal weglassen). | Grenze von 10 Dateien je CR (drei feste Versionstests); Folge-CR. |
| Nr. 12, `se-fmea` | Nicht in diesem CR; aufzunehmen laut Maß (ungebundener TEST für ein gelassenes Risiko, CR-GC-802). | Grenze von 10 Dateien je CR (zwei feste Versionstests); Folge-CR. |
| Nr. 15, `se/author-uc` | Nicht aufgenommen. | `uc-oder-req` sagt: „in graphcode entschieden; für andere Repos nicht entschieden". |
| Nr. 16, `se-retro` | Nicht in diesem CR; Gegenzahl zur Quote aufzunehmen, die Zählung „nur Befehle gegen das Repo" nicht. | Grenze von 10 Dateien je CR; die Zählung macht `scripts/retro-kpi.mjs`, nicht der Skill. |
| Nr. 17, `se/author-req` | Aufgenommen: genau eine TEST-uid im Kopfkommentar der Testdatei, `graph_test_ingest` bindet; kein zweiter TEST auf dieselbe Datei (Version 5). | CR-GC-901 trägt den Kopfkommentar für jedes Repo mit `graph_test_ingest`; R-29 meldet den Zwilling. |
| Nr. 18, `se/author-actor` | Nicht aufgenommen. | CR-GC-925 baut `se:author-actor` um (offen). |
| Nr. 19, `se/top-level` | Nicht aufgenommen. | Die Hilfetexte von R-22, FC-03 und R-35 nennen den Zug; CR-GC-925 ändert `se:top-level` (offen). |
| Tabelle 3 Nr. 4, `se/generate` | Gestrichen: `commands`-JSON und `update-edge`. Ersetzt durch: `graph_mutate` nimmt nur `formatE`; Umhängen heißt `- alt` und `+ neu` in einem Batch (Version 7). | `graph_mutate` hat nur `formatE` im Schema (`src/surface/write.ts`); CR-GC-706. |

---|---|---|

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

Geändert sind nur Skill-Texte (`.claude/commands`), zwei Testdateien und diese CR-Datei; kein Quellcode in `src/`. Testspur: `npm run verify:code`.

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
