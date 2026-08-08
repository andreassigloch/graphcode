# CR-GC-306 — Onboarding: ein Start statt zwei, Beispiel-Prompt als 1. Schritt, GVE-Adresse dort wo die LLM sie findet

**Status:** done · **Angelegt:** 2026-08-07 · **Geschlossen:** 2026-08-08

> ## Abschluss 2026-08-08
>
> ### Der Befund war stärker als der CR annahm: **drei** Server, nicht zwei
>
> Der CR beschrieb `graphcode mcp` als MCP-stdio + SSE-Bridge. Tatsächlich startet der
> gewählte Host auch **GVE selbst** (`maybeStartGve`, `src/mcp-server.ts` — `npx -y
> @sigloch/graph-view-edit --repo <root>`, abschaltbar per `GRAPHCODE_NO_GVE=1`).
> Es sind drei Dinge aus einem Kommando, und das README dokumentierte keins davon
> richtig. Die Aussage „npx host startet schon beide Server" war also noch
> untertrieben.
>
> ### Umgesetzt
>
> 1. **`README.md`** — `mcp` ist DER Server (alle drei), `host` ist explizit als
>    Fallback ohne Agent-Session markiert (daneben gestartet trifft er den Store-Lock).
>    Der frühere „Dashboard (optional)"-Schritt, der zum Doppelstart einlud, ist weg.
> 2. **Beispiel-Prompt als Schritt 3** im README **und** auf stderr beim Start
>    (`firstStepHint`). Genau eine Zeile, kein Menü.
> 3. **`GRAPHCODE.md`** (via `guardrailsContent()`) hat einen Abschnitt „Live view" —
>    `docs/views/dashboard.url` als Adressquelle, kein hartkodierter Port.
> 4. **`docs/views/README.md`** grenzt `views/` gegen `records/` ab — als Tabelle
>    entlang des *Ableitbarkeits*-Kriteriums, plus der Hinweis auf die
>    Namensgleichheit `se-conops` (CREATE) vs. `se-view:conops` (RENDER), aus der die
>    Verwechslung entsteht.
>
> ### Abweichung: das Leer-Kriterium ist UC/REQ, nicht die Elementzahl
>
> Der CR sagte „Element-Zahl im Store". Nach CR-GC-302 trägt **jeder** importierte
> Store einen SYS-Anker, und `graphcode import-code` erzeugt FUNC/MOD/FLOW ganz ohne
> UC/REQ. Ein `count === 0` hätte beide Fälle auf den falschen Zweig geschickt: ein
> code-importiertes Repo bekäme „lies `graph_readiness`" — einen Statusbericht über
> Requirements, die es nicht hat. Das Kriterium ist deshalb **die Intent-Ebene**
> (existiert ein UC oder REQ?), und beide Fälle sind getestet.
>
> ### Abweichung: `firstStepHint` liegt in `mcp-server.ts`, nicht in `scaffold-templates.ts`
>
> Der CR wollte den Hinweistext zu `guardrailsContent()` legen. Der Start-Hinweis ist
> aber kein Scaffold-Artefakt — er wird nie in eine Datei geschrieben. Er steht als
> reine, exportierte Funktion neben `maybeStartGve` und ist ohne Harness testbar.
> Aufgerufen wird er **nur nach der Erst-Wahl**: `electAndBoot` doubelt als `promote`
> (Neuwahl nach Host-Tod), und mitten in einer laufenden Session „hier ist dein erster
> Schritt" nachzudrucken wäre falsch. Dafür der Closure-Umweg über `bootedGraph`
> statt einer Signaturänderung.
>
> ### Mitgefundene Stale-Doku
>
> Die README-Sektion „Viewer integration" schloss mit *„Until the renderer ships,
> treat these exports as experimental."* Der Renderer ist längst da und wird
> automatisch gestartet — der Satz widersprach dem neuen Schritt 4 direkt. Ersetzt.
>
> **Tests:** neu `tests/mcp.first-step.test.ts` (8, alle vorher rot) + 2 in
> `tests/cli.scaffold.test.ts`. Gepinnt sind u.a.: kein `4317` in `GRAPHCODE.md`, der
> `update`-Pfad (nicht nur `init`) schreibt den Abschnitt, und der Hinweis bleibt
> ≤3 Zeilen — gegen das Zurückwachsen zum Menü.
>
> `npm run build` grün, **75 Testdateien / 511 Tests grün**.
>
> ### Nicht getan
>
> Der stderr-Hinweis ist als **Funktion** getestet, nicht über einen echten
> `serveStdio`-Boot. Ein End-to-End-Test dafür müsste einen MCP-Server hochfahren und
> fd 1/2 abgreifen; die AC „stdout bleibt byte-genau leer" ist stattdessen durch die
> Reinheit der Funktion + die bestehende Regel „stdout ist MCP-reserviert" gedeckt.
> Ehrlicher Rest, kein erledigtes Häkchen.

## Problem

Drei Onboarding-Defekte, alle vom selben Typ: das Repo weiß etwas, das der Einsteiger
(Mensch **und** Agent) nicht gesagt bekommt.

### 1. `README.md` verkauft zwei Server-Starts, wo einer läuft

`graphcode init` schreibt `GRAPHCODE_HOST_PORT` in `.mcp.json`
(`src/scaffold-templates.ts:262`, deterministischer Repo-Port). Damit startet
`graphcode mcp` **beides**: MCP-stdio für den Agenten **und** die read-only
SSE-Bridge (CR-GC-237, `src/mcp-server.ts:219-232`). `graphcode host` ist der
**Fallback** für ein Repo ohne laufende Agent-Session — nicht der Normalweg.

`README.md:15` listet `host` gleichrangig neben `mcp`, `README.md:53` macht ihn zum
Schritt 3 („Dashboard (optional): `npx @sigloch/graphcode host` …") und schiebt die
Wahrheit in einen Nachsatz. Wer dem README folgt, startet einen zweiten Prozess gegen
einen Store, den der erste schon besitzt — und landet im
`StoreOwnershipError`-Zweig (`src/cli.ts:66-76`), der zwar sauber abbricht, aber als
Fehler gelesen wird.

### 2. Kein erster Prompt — der Einsteiger weiß nicht, was er sagen soll

Weder `README.md` noch die Ausgabe nach dem Server-Start nennen **einen** konkreten
Satz, mit dem man anfängt. Das README springt von „reload your agent host" direkt in
die MCP-Tool-Referenz. Ein Substrat, dessen Einstieg eine Tool-Liste ist, wird nicht
benutzt — es wird gelesen und weggelegt.

### 3. GVE-Adresse steht nur da, wo die LLM nicht liest

GVE schreibt seine **tatsächlich** gebundene Adresse nach `docs/views/dashboard.url`
(dynamischer Port — Vite weicht bei Konflikt aus, die 4317 sind nicht verlässlich)
und löscht die Datei beim Shutdown. Das steht in `docs/views/README.md` — einer Datei,
die ein Agent nach der `GRAPHCODE.md`-Regel „nicht den Doc-Baum ingestieren" gerade
**nicht** liest. In `GRAPHCODE.md` (dem Dokument, das jeder Agent im Repo bekommt)
kommt weder GVE noch `dashboard.url` vor.

## Entscheidung

1. **`README.md`:** `mcp` ist der Start und startet beide Server. `host` wird als
   das benannt, was er ist — der Fallback ohne Agent-Session. Kein „Dashboard
   (optional)"-Schritt mehr, der zum Doppelstart einlädt.
2. **Beispiel-Prompt als Schritt 1** — im `README.md` **und** in der stderr-Ausgabe
   nach dem Server-Start. Genau **ein** Satz, kein Menü:

   > `Lies GRAPHCODE.md, dann: graph_readiness — wo steht das Projekt und was ist der nächste Schritt?`

   Für ein leeres Repo (kein Graph) der Kaltstart-Satz stattdessen:

   > `Lies GRAPHCODE.md, dann leg mit se:generate los: "<was das System tun soll, in einem Satz>"`

   Welcher der beiden gezeigt wird, entscheidet der Server an einem Fakt, den er
   ohnehin hat (Element-Zahl im Store), nicht an einer Vermutung.
3. **GVE in `guardrailsContent()`** (`src/scaffold-templates.ts` → `GRAPHCODE.md`):
   ein Abschnitt „Live-Ansicht", der `docs/views/dashboard.url` als **die** Quelle der
   Adresse nennt (Datei fehlt = Viewer läuft nicht) und den Startbefehl. Kein
   hartkodierter Port — genau der Fehler, den `docs/views/README.md` schon benennt.
4. **`docs/views/README.md`:** ein Absatz, der `docs/views/` (deterministische
   Projektionen des Graphen, `GENERATED`-Header, nie hand-editieren) gegen
   `docs/records/` (commit-gestempelte Urteils-Dokumente wie `irr.md`, die `se-irr`
   schreibt und die **nicht** aus dem Graphen ableitbar sind) abgrenzt. Beantwortet
   die wiederkehrende Frage „warum liegt IRR woanders" an der Stelle, wo sie entsteht.

## Akzeptanzkriterien

- [ ] `README.md` nennt genau **einen** Weg, die Server zu starten; `host` ist explizit
      als Fallback ohne laufende Agent-Session markiert (grep: kein „Dashboard
      (optional)" mehr)
- [ ] Beispiel-Prompt steht in `README.md` als **Schritt 1** des Loops, vor der
      Tool-Referenz
- [ ] Unit (`tests/cli.host.test.ts` o. `tests/mcp.*`): die Start-Ausgabe auf **stderr**
      enthält den Beispiel-Prompt. stdout bleibt byte-genau leer (MCP-JSON-RPC-Transport
      — ein Prompt auf stdout korrumpiert den Stream; dieser Test ist der eigentliche
      Grund, das nicht „mal eben" einzubauen)
- [ ] Unit: leerer Store → Kaltstart-Prompt (`se:generate`); befüllter Store →
      `graph_readiness`-Prompt. Beide Zweige getestet, nicht nur der Default
- [ ] `GRAPHCODE.md` (via `guardrailsContent()`) nennt `docs/views/dashboard.url` als
      Adressquelle + den GVE-Startbefehl; Unit prüft den String im Scaffold-Output
- [ ] `GRAPHCODE.md` enthält **keinen** hartkodierten Port (grep `4317` = 0 Treffer)
- [ ] `docs/views/README.md` grenzt `views/` gegen `records/` ab
- [ ] `npx @sigloch/graphcode update` in einem Testrepo schreibt die neue
      `GRAPHCODE.md` (Update-Pfad, nicht nur `init`) — bestehender Scaffold-Test erweitert
- [ ] `npm run build` + volle Suite grün

## Dateien (5)

1. `docs/cr/open/CR-GC-306-onboarding-erster-schritt.md` (dieses Dokument)
2. `README.md`
3. `src/scaffold-templates.ts` (`guardrailsContent()` + der Start-Hinweis-Text)
4. `src/cli.ts` **oder** `src/mcp-server.ts` (Start-Ausgabe auf stderr — die Stelle
   entscheidet sich beim Implementieren daran, wo der Store-Zählstand ohne zweiten
   Handle verfügbar ist; **eine** der beiden, nicht beide)
5. `tests/scaffold.test.ts` + der Start-Ausgabe-Test

`docs/views/README.md` ist hand-maintained und einzeilig zu ändern — als Posten unter
(2) geführt.

## Abhängigkeit

**Nach CR-GC-302 (Auto-SYS-Node bei jedem Import).** Die Verzweigung „leerer Store →
Kaltstart-Prompt" braucht ein Kriterium für *leer*. CR-GC-302 stellt bei **jedem**
Import einen SYS-Knoten sicher — danach ist ein initialisierter Store nie mehr
element-leer, und ein naives `count === 0` würde still auf den falschen Zweig fallen.
Das Kriterium wird deshalb erst **nach** 302 festgelegt (voraussichtlich: kein UC und
keine REQ, nicht „keine Elemente") und dort gegen einen frisch importierten Graphen
getestet. Keine Datei-Überschneidung mit 302 — nur diese semantische.

## Nicht in diesem CR

- Kein Textwechsel an `docs/views/*.md` selbst (Generate).
- Keine Änderung an der Port-Wahl oder der Bridge-Logik — nur ihre Beschreibung.
