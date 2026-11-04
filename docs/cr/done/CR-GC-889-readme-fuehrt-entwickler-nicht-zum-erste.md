# CR-GC-889: README fuehrt Entwickler nicht zum ersten Erfolg: Befehle und Interna vor Nutzen und Einstieg

**Status:** ✅ Done (2026-11-04)
**Typ:** aus Item ITEM-2026-1181 (finding)
**Erstellt:** 2026-11-03
**Item:** bok/items/ITEM-2026-1181.json (Lane: graph)

---

## Befund

Die README (289 Zeilen) beginnt mit 8 Befehlen und Betriebsinterna. Nutzen und erster Erfolg kommen erst später. Konkret:
- Kein Problem und kein Beispiel, warum ein Entwickler graphcode will.
- „Get started“ enthält die Historie des Executors (entfernt 2026-10-09); Schritt 4 erklärt Heartbeat, Store-Lock und PID-Wiederverwendung.
- REQ, FUNC, MOD, FCHAIN, Format-E und R-18 erscheinen ohne Erklärung.
- `docs/articles/` ist erst ganz unten verlinkt.
- Interne Namen (aimprove, learning-core); die Migration contracts 10.x betrifft keinen neuen Nutzer.
- Prompts in Schritt 3 deutsch, der Rest englisch.
- **Falsch:** Die README sagt, `.mcp.json` starte `npx @sigloch/graphcode mcp`. Tatsächlich startet sie `node node_modules/@sigloch/graphcode/dist/cli.js mcp`. `init` trägt die Abhängigkeit nur in package.json ein und installiert nicht; ohne `npm install` startet der Host nicht. Geprüft 2026-11-03 mit 0.36.1 in einem leeren Repo: nach `init` kein `node_modules/`, nach `npm install` antwortet der Host auf `initialize`.

Der Nutzer des npm-Pakets bekommt nur die README (Seite auf npmjs.com) und die von `init` erzeugten Dateien `GRAPHCODE.md` (für den Agenten) und `GRAPHCODE-STEERING.md` (für den Menschen). docs/ liegt nur auf GitHub. Die README muss deshalb ohne docs/ verständlich sein und auf GitHub-URLs verlinken, nicht relativ.

## Ziel

Leser: ein Entwickler, der graphcode in seinem eigenen Repo einsetzt. Sprache: Englisch.

Reihenfolge:
1. Problem in zwei Sätzen, mit einer Zahl.
2. Ein Beispiel: Frage an den Agenten, Antwort aus dem Graphen.
3. Install: `npx @sigloch/graphcode init && npm install` (Node ≥ 22), `.graphcode/` in `.gitignore`, Host neu laden, ein Satz an den Agenten (englisch).
4. Die fünf nötigen Begriffe in einer Tabelle, Verweis auf `docs/articles/08-glossary.md`.
5. Wegweiser auf die öffentlichen Dokumente (nach CR-GC-888 und CR-GC-890).
6. Danach: Befehlsreferenz, Dashboard, Lebenszyklus kurz, lokale Entwicklung, License.

Verschieben: Migration contracts 10.x und Executor-Historie aus der README in ein Dokument für Maintainer.

## Abhängigkeit

Nach CR-GC-888 (welche Dateien öffentlich bleiben) und CR-GC-890 (Artikel aktuell).

## Abnahme

- Jeder Link der README ist eine absolute GitHub-URL auf eine getrackte Datei (Skript-Prüfung), damit er auch auf npmjs.com funktioniert.
- `GRAPHCODE-STEERING.md` (Vorlage in src) auf denselben Einstieg geprüft.
- Kein Begriff aus der README ohne Erklärung oder Link.
- Ein Durchlauf der drei Install-Schritte in einem leeren Test-Repo endet mit Antwort von `graph_readiness`.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

## Ergebnis (2026-11-04)

- **README neu**, Reihenfolge wie im Ziel: Problem mit Zahl (~34.000 gegen ~250 Tokens, Artikel 01) → Beispiel (echte `graph_impact`-Antwort aus graphcodes Modell, `FUNC-graph-help`) → Install `npx @sigloch/graphcode init && npm install` in vier Schritten mit englischen Sätzen an den Agenten → fünf Begriffe (REQ, TEST, FUNC, MOD, gate) mit Verweis aufs Glossar → Wegweiser → Befehle, Agent-Loop, Werkzeugtabelle (unverändert, `claims.conformance` prüft sie), Import, Dokumente, Dashboard kurz, Ist/Ist-nicht ohne interne Paketnamen, Constraints, lokale Entwicklung.
- **Korrigiert:** `.mcp.json` startet aus `node_modules`, nicht über `npx`; `graph_readiness` ohne „dimensions“ (entfallen mit CR-GC-757).
- **Verschoben:** Migration contracts 10.x nach `docs/project/migrate-req-kinds.md`. Executor-Historie gestrichen (steht als ein Satz in Artikel 03, CR-GC-890).
- **Links:** alle als absolute GitHub-URLs, alle Ziele getrackt (Skript-Prüfung).
- **`GRAPHCODE-STEERING.md`** (Vorlage `src/surface/scaffold-docs.ts`) geprüft: englisch, keine Install-Behauptung, Sätze an den Agenten wie in der README. Keine Änderung nötig.
- **Install-Durchlauf:** leeres Repo, `npx -y @sigloch/graphcode init && npm install` (0.36.1), Host gestartet, `tools/call graph_readiness` antwortet mit den Marken SRR … TRR.
- **Tests:** `claims.conformance` grün; `verify:full CR-GC-889` 1701/1701, Schlupf 0.
- **Nicht gepusht.**
