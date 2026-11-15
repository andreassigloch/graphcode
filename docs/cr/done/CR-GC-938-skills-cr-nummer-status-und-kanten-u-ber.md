# CR-GC-938: Skills: CR-Nummer, Status und Kanten über aise statt von Hand

**Typ:** aus Item ITEM-2026-1364 (finding)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1364.json (Lane: code)

---

**Freigabe:** Autor, 2026-11-15, mit der Empfehlung (Skills an die FAQ angleichen). Umgesetzt in `.claude/commands` (7 Dateien); Test `tests/skill-cr-ueber-aise.test.ts`.

## Anlass

Am 2026-11-15 wurden alle 240 Antworten der FAQ (aise-bok) gegen alle 25 Skills geprüft, jeder Fund mit Zitat
beider Seiten: `aise-bok/docs/pflege/konflikte-skills-2026-11-15.md`. Die Quelle der Skills ist
`.claude/commands` in diesem Repo; andere Repos tragen Kopien.

Entscheidung des Autors vom 2026-11-15: Ein Skill geht der FAQ in jedem Fall vor. Widerspricht ein FAQ-Eintrag
einem Skill, löst ein CR im Repo des Skills den Konflikt. Bis dahin folgt ein Agent dem Skill.

## Konflikte

| Nr | FAQ-Datei, Zitat der Antwort | Skill, Zeile, Zitat | Widerspruch | Offener CR |
|---|---|---|---|---|
| 2 | `cr-nummer-vergeben.md` Nr. 1: „Lass das Cockpit die Nummer vergeben, also `aise dispatch prepare`". `cr-bezeichner.md` Nr. 1: „vergib keine nackte Nummer" | `se-fmea.md` L120, `se-conops.md` L35, `se-irr.md` L31, `se-trade.md` L16: „the next free number after the files in `docs/cr/open/` and `docs/cr/done/`, same prefix; `CR-001` in a repo without CRs". `se-laufzeit.md` L115-116: „die nächste freie Nummer nach den Dateien in `docs/cr/open/` und `docs/cr/done/`" | Fünf Skills lassen den Agenten die Nummer wählen und nennen `CR-001` ohne Repo-Präfix. | keiner |
| 3 | `cr-knoten-status.md` Nr. 1: „Setze status am CR-Knoten nicht von Hand; schließe den CR mit `aise cr close`" | `se-conops.md` L36, `se-irr.md` L32, `se-trade.md` L17, `se-fmea.md` L189: „add the CR node — id and title only, `status: "done"`". `se-laufzeit.md` L145-146 und `se/optimize.md` L179-180: Knoten „trägt `status: "done"`". `se-plan.md` L66: „`~ CR-…` `@status open`" | Sieben Skills schreiben `status` per `graph_mutate`, die FAQ lässt `aise` den Status setzen. | BOK-CR-071 (bok), teilweise: legt die eine Methode für den Status fest |
| 4 | `cr-relation-zieltypen.md` Nr. 2 und 4: „Setze keine Kante auf FCHAIN oder TEST" „Setze keine Kante auf FLOW; das Gate weist sie ab." (Beleg: `meta-model.ts` Z. 160-173 in contracts kennt für CR nur MS, UC, REQ, FUNC, MOD, SCHEMA) | `se-fmea.md` L189: „one `relation` edge from it to every REQ and TEST this analysis wrote". `se-laufzeit.md` L146: „je einer `relation`-Kante auf jede REQ und jeden TEST". `se/optimize.md` L180: „je eine `relation`-Kante auf jedes Element, das der Zug geändert hat" | Die Skills verlangen CR-Kanten auf TEST und, bei einem Umbau, auf FLOW; das Gate lehnt beide ab. | keiner |

## Abgeschafftes im selben Skill

| Nr | Skill, Zeile, Zitat | FAQ-Datei mit der Entscheidung |
|---|---|---|
| 1 | `se-plan.md` L86: „writes the graph alone (status, `commitRef`, `testRefs`)" | `cr-commitref.md` Nr. 1 und Stand: „Schreibe und pflege kein `commitRef`"; entfallen mit CR-SM-440 (contracts 12.13.0) und BOK-CR-084. Der offene CR-GC-924 (L33) übernimmt denselben Satz für `se-bau`. |

**Empfehlung:** Skills angleichen. Nummer und Status vergibt `aise`; CR-Kanten nur auf Typen, die das Gate annimmt; `commitRef` streichen. Bei Zeile 3 und 4 führt der Skill den Agenten heute gegen das Gate.

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
| Wer wählt die Nummer eines CR, den ein Skill anlegt? | `aise dispatch prepare` vergibt sie mit Repo-Präfix und legt Datei und CR-Knoten an; die Skills `se-conops`, `se-irr`, `se-trade`, `se-fmea`, `se-laufzeit` zeigen `aise item new` plus `aise dispatch prepare`. Freigabe des Autors 2026-11-15. | FAQ `cr-nummer-vergeben`: Der Agent wählt keine Nummer; `CR-001` ohne Präfix kollidiert mit vorhandenen CRs. |
| Wer setzt den Status des CR-Knotens? | `aise cr close` setzt ihn; kein Skill schreibt `status` per `graph_mutate` (`se-plan` ohne `@status open`, da der Knoten ab `prepare` offen ist). Freigabe des Autors 2026-11-15. | FAQ `cr-knoten-status`: Der Ordner open/ oder done/ entscheidet, der Knoten spiegelt ihn. |
| Auf welche Typen geht eine CR-`relation`? | Nur auf FUNC, REQ, MS, MOD, SCHEMA, UC (geprüft an `TRACE_PATTERNS`, `meta-model.ts`); TEST und FLOW nennt der CR-Text, ein TEST hängt an seiner REQ. Freigabe des Autors 2026-11-15. | Das Gate lehnt `CR relation TEST` und `CR relation FLOW` ab (R-18); ein Test in `tests/skill-cr-ueber-aise.test.ts` prüft jede genannte Kante mit `isValidTrace`. |
| Nennt ein Skill `commitRef`? | Nein; `se-plan` schreibt Kanten und `testRefs`. Freigabe des Autors 2026-11-15. | FAQ `cr-commitref`: Attribut entfallen (contracts 12.13.0); der Commit steht in git unter der CR-Nummer. |

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
