# CR-GC-941: Skill-Text zur Wiederherstellung geht am Gate vorbei

**Typ:** aus Item ITEM-2026-1367 (finding)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1367.json (Lane: code)

---

**Status:** Freigegeben 2026-11-15 mit der Empfehlung; umgesetzt.

## Anlass

Am 2026-11-15 wurden alle 240 Antworten der FAQ (aise-bok) gegen alle 25 Skills geprüft, jeder Fund mit Zitat
beider Seiten: `aise-bok/docs/pflege/konflikte-skills-2026-11-15.md`. Die Quelle der Skills ist
`.claude/commands` in diesem Repo; andere Repos tragen Kopien.

Entscheidung des Autors vom 2026-11-15: Ein Skill geht der FAQ in jedem Fall vor. Widerspricht ein FAQ-Eintrag
einem Skill, löst ein CR im Repo des Skills den Konflikt. Bis dahin folgt ein Agent dem Skill.

## Konflikt

| Nr | FAQ-Datei, Zitat der Antwort | Skill, Zeile, Zitat | Widerspruch | Offener CR |
|---|---|---|---|---|
| 10 | `aenderung-nur-durchs-gate.md` Nr. 2: „Schreibe die Graph-JSON … und den Kuzu-Store … nie von Hand; in graphcode blockt ein Hook das." | `se/import-code.md` L66: „Backup-Datei nach `docs/graph/<member>.graph.json` kopieren, dann `graph_reseed` — oder Host stoppen, `rm .graphcode/kuzu*`" | Die Wiederherstellung schreibt die Graph-Datei und löscht den Store von Hand. | keiner |

**Empfehlung:** Skill angleichen: Wiederherstellung über `graph_reseed` bzw. den Host, nicht durch Schreiben der Graph-Datei und Löschen des Stores von Hand.

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
| Wie stellt `se:import-code` aus dem Backup wieder her? | `graph_reseed({ path: ".graphcode/backup/graph-<ts>.json" })`, danach `graph_export`; keine Handgriffe an Graph-Datei oder Store. | Keine; wendet die FAQ `aenderung-nur-durchs-gate` an (Skill Version 5). |

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
