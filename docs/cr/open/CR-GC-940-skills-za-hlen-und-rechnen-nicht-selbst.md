# CR-GC-940: Skills zählen und rechnen nicht selbst

**Typ:** aus Item ITEM-2026-1366 (finding)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1366.json (Lane: code)

---

**Status:** umgesetzt am 2026-11-15; vom Autor am 2026-11-15 freigegeben, Empfehlung: Skills an die FAQ angleichen.

## Anlass

Am 2026-11-15 wurden alle 240 Antworten der FAQ (aise-bok) gegen alle 25 Skills geprüft, jeder Fund mit Zitat
beider Seiten: `aise-bok/docs/pflege/konflikte-skills-2026-11-15.md`. Die Quelle der Skills ist
`.claude/commands` in diesem Repo; andere Repos tragen Kopien.

Entscheidung des Autors vom 2026-11-15: Ein Skill geht der FAQ in jedem Fall vor. Widerspricht ein FAQ-Eintrag
einem Skill, löst ein CR im Repo des Skills den Konflikt. Bis dahin folgt ein Agent dem Skill.

## Konflikte

| Nr | FAQ-Datei, Zitat der Antwort | Skill, Zeile, Zitat | Widerspruch | Offener CR |
|---|---|---|---|---|
| 7 | `skill-keine-eigene-rechnung.md` Nr. 1: „Schreibe in einen Skill keine Liste von Regel-IDs, keine Schwelle und keine Zahl." | `se/generate.md` L21: „Steuerregeln (RD-04, BW-02, R-04, CR-01, MT-02) … um weniger als 5 % sinkt"; L31: „Abnehmbar sind nur die Analysen AF-01, AF-02, AF-03, AF-04, AF-05 …". `se-vorbereitung.md` L34: „Die Regeln der Verdrahtung sind `R-30`, `R-31`, `R-21`, `IO-01`, `FC-04` und `FC-05`." `se/optimize.md` L86: „`R-19`, `R-20`, `R-26`, `R-32`" | Vier Skills führen Listen von Regel-IDs und Schwellen, die das Werkzeug liefert. | keiner |
| 11 | `befund-abnehmen.md` Nr. 1 und 3: „Nimm einen Befund nur ab, wenn seine Regel zur Menge ABNEHMBAR gehört" „Nimm MS-01, CR-R01, R-19, R-20, R-26 und R-32 nicht ab" | `se/close-violations.md` L32: „only what the order deliberately leaves out: an analysis that was not commissioned (AF-01 … AF-05), or a finding the model cannot satisfy in this job." | „oder ein Befund, den das Modell in diesem Auftrag nicht erfüllen kann" ist weiter als ABNEHMBAR; `se/generate.md` L31 nennt die enge Menge. | keiner |
| 17 | `befunde-reihenfolge.md` Nr. 1: „Fordere die Reihenfolge mit rules_evaluate (detail grouped) an: Fehler zuerst, dann früheste Stufe". `skill-keine-eigene-rechnung.md` Nr. 3: „rechne nichts im Skill" | `se-status.md` L23: „Top-3 elements to fix next: the `elementId`s carrying the most error-severity violations (derive from the `violations` list)" | Der Skill zählt und ordnet selbst, nach Fehlern je Element statt nach Stufe. | keiner |
| 18 | `bindungsquote-und-deckung.md` Nr. 1 und 3: „Nenne bei einer Aussage zur Vollständigkeit des Modells Bindungsquote und Deckung, nie nur eine." „Lies importCoverage … nur gegen `unassigned: []`" | `se-review.md` L25: „kongruent — `importCoverage` da, keine RC-Verstöße" | Der Skill urteilt „kongruent" ohne Deckung und ohne `unassigned`. | keiner |
| 19 | `geschuetzte-tabelle-nicht-ausliefern.md` Stand: „die Logik wird ausgeliefert, die Zellwerte nie (CR-SM-229)"; Nr. 2: „Lass den Konsumenten die Tabelle aus einer lokalen, nie eingecheckten Datei laden." | `se-fmea.md` L106: „`actionPriority()`, CR-SM-229 … is not published yet"; L104: „Use the canonical AIAG-VDA AP lookup table" | Die Funktion `actionPriority` steht in contracts (`action-priority.ts`, `fmea-rules.ts` L103-120 nutzt sie); die Tabelle liegt nie im Repo, der Skill verweist auf sie ohne die lokale Datei. | keiner |

## Abgeschafftes

| Nr | Skill, Zeile, Zitat | FAQ-Datei mit der Entscheidung |
|---|---|---|
| 2 | `se-retro.md` L16: „carrying `testRef`/`codeRef` (R-19/R-20)" | `kein-paralleler-pfad.md` Varianten 4 und 7: `testRef` heißt `testRefs`, `codeRef` entfällt, „realRef ist der eine Weg". Gleich in `bindung-pruefen.md` Nr. 1. |
| 3 | `se/import-code.md` L48: „R-20 codeRef" | `kein-paralleler-pfad.md` Variante 7 (wie Nr. 2); `bindungsregeln-ab-realisierung.md` Nr. 1: R-20 prüft `realRef`. |

**Empfehlung:** Skills angleichen: Regel-IDs, Schwellen, Reihenfolge und Quoten liest der Skill aus dem Werkzeug. Zeile 19 (`actionPriority`) vor der Änderung an contracts prüfen.

## Vorgehen

1. Je Zeile entscheidet der Autor: Skill an die FAQ angleichen, oder FAQ an den Skill. Die Empfehlung steht unten.
2. Vor jeder Änderung das Zitat an der Skill-Datei nachprüfen; die Zeilennummern stammen vom 2026-11-15.
3. Nach der Änderung: `tests` zur Skill-Konformanz grün, OpenCode-Kopien (`.opencode/skills`) neu erzeugt.
4. In aise-bok den FAQ-Eintrag nachführen: der Hinweis auf diesen offenen CR entfällt.

## Abnahme

- [x] Der Autor hat je Zeile entschieden; die Festlegungen stehen im Abschnitt „Entscheidungen“.
- [x] Je geänderter Skill-Stelle prüft ein Test den neuen Wortlaut oder die entfernte Nennung (vorher rot).
- [x] `npm run verify:full <CR>` grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Wer nimmt Befunde ab, wenn ein Skill und die FAQ sich widersprechen? | Der Skill nennt keine Liste abnehmbarer Regeln; er verweist auf `enumValues` von `acceptedFindings` aus `graph_authoring_guide`. | Die Menge ABNEHMBAR liefert das Werkzeug (`focus-set.ts`); eine zweite Liste im Skill ist eine zweite Fassung. Freigabe des Autors 2026-11-15. |
| Wo steht, wann eine Steuerregel fertig ist? | Im `prompt` von `graph_generate`, nicht im Skill; die Test-Bindung „Skill trägt Registersatz wörtlich" (`decision-texts`) entfällt für `steerOptimum` und `acceptance`. | Das Werkzeug meldet „Steuerregeln am lokalen Optimum"; die 5 %-Schwelle steht nur im Code. Freigabe des Autors 2026-11-15. |
| Woher kommen Reihenfolge und Top-3 in `se-status`? | Aus den ersten drei Gruppen von `rules_evaluate({ detail: "grouped" })`. | Fehler zuerst, dann früheste Stufe liefert das Werkzeug; der Skill zählt nichts. Freigabe des Autors 2026-11-15. |
| Was heißt „kongruent" ohne Deckung? | Jedes Urteil nennt die Deckung (`importCoverage.assigned` von `endpoints`, `unassigned`) und die Bindungsquote. | `importCoverage` liefert `graph_readiness`; die Bindungsquote liefert kein Werkzeug (nur `scripts/kongruenz.mjs`), der Skill-Satz dazu bleibt. Freigabe des Autors 2026-11-15. |
| Was sagt `se-fmea` zu Action Priority? | AP kommt aus `actionPriority()`, ohne lokale Tabelle steht `AP*`; der Skill nennt keine Tabelle. | `actionPriority` ist in contracts 12.13.0 ausgeliefert, die Zellwerte nie (CR-SM-229). Freigabe des Autors 2026-11-15. |

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
