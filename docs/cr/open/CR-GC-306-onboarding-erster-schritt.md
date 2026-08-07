# CR-GC-306 — Onboarding: ein Start statt zwei, Beispiel-Prompt als 1. Schritt, GVE-Adresse dort wo die LLM sie findet

**Status:** open · **Angelegt:** 2026-08-07 · **Max Files:** 5

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
