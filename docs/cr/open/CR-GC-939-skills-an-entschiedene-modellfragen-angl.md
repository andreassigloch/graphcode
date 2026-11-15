# CR-GC-939: Skills an entschiedene Modellfragen angleichen

**Typ:** aus Item ITEM-2026-1365 (finding)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1365.json (Lane: code)

---

**Status:** Freigegeben vom Autor am 2026-11-15 (Empfehlung: Skills an die FAQ angleichen); umgesetzt.

## Anlass

Am 2026-11-15 wurden alle 240 Antworten der FAQ (aise-bok) gegen alle 25 Skills geprüft, jeder Fund mit Zitat
beider Seiten: `aise-bok/docs/pflege/konflikte-skills-2026-11-15.md`. Die Quelle der Skills ist
`.claude/commands` in diesem Repo; andere Repos tragen Kopien.

Entscheidung des Autors vom 2026-11-15: Ein Skill geht der FAQ in jedem Fall vor. Widerspricht ein FAQ-Eintrag
einem Skill, löst ein CR im Repo des Skills den Konflikt. Bis dahin folgt ein Agent dem Skill.

## Konflikte

| Nr | FAQ-Datei, Zitat der Antwort | Skill, Zeile, Zitat | Widerspruch | Offener CR |
|---|---|---|---|---|
| 5 | `keine-kette-fuer-eigenschaft.md` Nr. 2: „Fasse die Eigenschaft als funktionale REQ an der FUNC, die sie trägt." | `se/top-level.md` L104: „A property is a non-functional REQ, not a chain." | Der Skill nennt die Eigenschaft nicht-funktional, die FAQ funktional; eine FUNC darf nur funktionale REQ erfüllen. | keiner |
| 6 | `zerlegungsbreite.md` Nr. 1: „RD-04 (Obergrenze 9) und RD-05 (Untergrenze 3) entscheiden die Breite je Ebene". `schwelle-einmal-in-config.md` Nr. 4: „Schreibe in einen Skill den Grundsatz, nicht die Zahl." | `se/top-level.md` L4, L71, L88: „7±2 per level"; L168: „More than five top-level FUNCs? Something is off." `se/generate.md` L28: „Zerlegungsbreite 7±2 pro Ebene (RD-04)" | 7±2 heißt 5 bis 9, das Band der Regeln ist 3 bis 9; der Skill nennt zudem die Zahl, die er selbst (`top-level.md` L94) nicht mehr nennen wollte. | keiner |
| 9 | `import-code-sys.md` Nr. 1: „Erwarte nach `graphcode import-code` genau ein SYS im Graphen und lege keins zusätzlich an." | `se/import-code.md` L46: „**Keine UC/REQ/ACTOR/SYS** — die Absichtsebene bleibt der generative Pfad" | Der Import legt laut FAQ ein SYS an (Variante 1, CR-GC-302), der Skill sagt, es gebe keins. | keiner |
| 12 | `flows-zusammenlegen.md` Nr. 1 und 4: „Lege FLOWs nur zusammen, wenn Vertrag und Verbindung gleich sind" „Ähnliche Namen genügen nicht." `vorschlaege-nicht-automatisch.md` Nr. 3: „Folge einem Merge-Vorschlag … nicht blind" | `se/close-violations.md` L30: „A duplicate (ND-01, ND-02) is merged, not deleted: `M <source> + <target>` under `## Merges`." | Der Skill macht jedes ND-Duplikat zum Merge; die FAQ verlangt die Prüfung je Paar, bei FLOW gleiche Erzeuger. | keiner |
| 13 | `modell-dem-code-voraus.md` Nr. 2 und 3: „Schreibe eine offene Differenz in die Beschreibung des betroffenen FLOW und nenne den CR" „Lege dem Autor vor, ob er mit Vermerk bleibt oder gelöscht wird." `modell-code-abgleich.md` Nr. 3: Befund RC-12 ist „Prüfauftrag an den Autor, nicht als Modellfehler" | `se-vorbereitung.md` L186: Ergebnis „kein Aufruf" — Zug „Fluss löschen; ist er gewollt, wird er ein Item, nicht Modell" | Der Skill kennt nur Löschen oder Item; der Vermerk in der FLOW-Beschreibung (Variante 3) fehlt. | keiner |
| 14 | `sync-async-pflicht.md` Nr. 5: „Prüfe das Merkmal danach mit dem Skill se-vorbereitung nach; setze es dort nicht erstmals." | `se-vorbereitung.md` L119: „Dieser Schritt prüft es nach und kennzeichnet, was dort offen blieb." mit Zug `@sync sync` / `@sync async` (L152-159) | Der Skill setzt das Merkmal an Flüssen, die es noch nicht tragen; die FAQ lässt es dort nicht erstmals setzen. | keiner |
| 15 | `sync-async-bedeutung.md` Nr. 3: „Urteile aus der Sicht des Abnehmers und setze genau einen Wert je Fluss." | `se/top-level.md` L106: „`sync` answers one question: does the caller await the answer?" | Der Skill fragt nach dem Aufrufer, die FAQ nach dem Abnehmer (`se-vorbereitung.md` L148 fragt nach dem Abnehmer). | keiner |
| 16 | `modell-zug-wann.md` Nr. 2: „Führe den Modell-Zug vor dem Löschen der Dateien aus." | `se-umbau.md` L63-64: „Nach dem Löschen im Code ist das Modell **falsch**, nicht veraltet. Der Zug geht durchs Gate" | Der Skill setzt den Modell-Zug nach dem Löschen an, die FAQ davor. | keiner |

**Empfehlung:** Skills angleichen; die FAQ trägt hier die jüngere Entscheidung aus einem geschlossenen CR. Zeile 6 (Band 3 bis 9 gegen 7±2) betrifft die Doktrin von `se:top-level` und braucht die ausdrückliche Wahl des Autors.

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
| Wie breit ist eine Ebene, und nennt der Skill eine Zahl? (Nr. 6) | `se:top-level` und `se:generate` nennen keine Zahl und kein 7±2, sie verweisen auf RD-04 (Obergrenze), RD-05 (Untergrenze) und `decompositionBreadth`; das Band 3 bis 9 steht in der Policy | RD-04 meldet ab 9, RD-05 unter 3 (CR-SM-311); 7±2 hieße 5 bis 9 und widerspricht; die Zahl im Skill folgt keiner Policy |
| Eigenschaft: funktionale oder nicht-funktionale REQ? (Nr. 5) | funktionale REQ an der FUNC, die sie trägt | CR-GC-829, CR-GC-832; eine FUNC erfüllt nur funktionale REQ |
| Erzeugt der Import ein SYS? (Nr. 9) | genau ein SYS; `SYS compose MOD` legt das Modell an | CR-GC-302 |
| ND-Duplikat: immer Merge? (Nr. 12) | Kandidat, je Paar prüfen; Merge nur bei gleichem Vertrag und gleicher Verbindung | CR-GC-444, CR-SM-309 |
| Fluss ohne Aufruf im Code: löschen? (Nr. 13) | Prüfauftrag an den Autor: Vermerk in der FLOW-Beschreibung mit CR oder löschen | CR-GC-822, CR-GC-833 |
| Setzt se-vorbereitung `sync` erstmals? (Nr. 14) | nein; ein Fluss ohne Merkmal geht zurück an `se:top-level` | CR-GC-873, CR-SM-420 |
| Sicht für `sync`: Aufrufer oder Abnehmer? (Nr. 15) | Abnehmer, ein Wert je Fluss | CR-SM-408 |
| Modell-Zug vor oder nach dem Löschen? (Nr. 16) | vor dem Löschen der Dateien | Autor 2026-11-14; CR-SL-103 |

Freigabe des Autors: 2026-11-15.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
