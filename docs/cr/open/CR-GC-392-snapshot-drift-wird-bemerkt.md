# CR-GC-392 — Snapshot-Drift wird bemerkt, statt still zu wirken

**Status:** open · **Angelegt:** 2026-08-22 · **Anlass:** Vorfall 2026-08-22, 04:16 Uhr

## Befund

Während der CR-GC-390-Umsetzung stand der Store auf graphVersion 155 (636 Elemente), die
committete SSOT wurde auf 145 (622 Elemente) zurückgesetzt. **Der Store war nie betroffen** —
er lief monoton 145 → 157 durch. Divergiert ist die Projektion, nicht die Datenbank.

**Es war kein Export.** `graph_export` verweigert jeden Schreibvorgang, der Elemente fallen
lässt; 636 → 622 sind 14 verlorene Elemente, das hätte der Guard geblockt. Es war ein
Datei-Überschreiben (git-Operation oder Fremdschreiber).

**gve war es auch nicht.** `graph-view-edit` hat genau einen `writeFileSync`
(`vite.config.js:504`) und der schreibt `docs/views/dashboard.url` — seine eigene Port-URL,
beim Schließen wieder gelöscht. Sein Edit-Pfad ist `POST /api/mutate` über
`.graphcode/host.sock`, also durch dasselbe Apply-Gate wie jeder andere Schreiber. Ein Viewer
kann den Graphen weder überschreiben noch zurücksetzen.

## Die eigentliche Lücke

`isCanonicalSnapshot()` existiert, wird aber **nur von `scripts/export-graph.mjs` benutzt, und
nur vor dem Schreiben**. Für die Gegenrichtung gibt es nichts: Nichts vergleicht beim Start,
beim Lesen oder beim Export, ob die committete SSOT noch zum Store passt.

Folge: eine divergierte SSOT wirkt **still**. Jeder Konsument, der die Datei liest statt den
Store — der Viewer, die Testsuite, ein zweiter Agent, ein Review — sieht ein veraltetes Modell
und merkt nichts. Im Vorfall hat es nur ein Testwächter gefangen (*„die Kette ist besetzt —
sonst prüft dieser Test nichts"*), und der war zufällig zwei Stunden vorher geschrieben worden.

## Vorschlag

Ein Drift-Check auf der **Lese**seite, aus derselben Funktion, die den Schreib-Guard trägt:

1. Der MCP-Server vergleicht beim Boot die `graphVersion` der committeten SSOT mit der des
   Stores und meldet eine Abweichung auf stderr — inklusive der Richtung („Datei ist N Versionen
   hinter dem Store" vs. „Datei ist voraus", was auf einen Fremdschreiber deutet).
2. `graph_export` nennt die vorgefundene Datei-Version in seinem Ergebnis, damit ein Agent den
   Sprung sieht, statt ihn zu überschreiben.
3. Offen zu entscheiden: soll die Abweichung nur melden oder Lese-Tools mit einem Hinweis
   versehen? Melden zuerst — ein Blocker auf einem Zustand, der legitim vorkommt (frisch nach
   `git checkout` eines älteren Stands), wäre schlimmer als das Problem.

**Nicht Teil davon:** Reparieren. Der Store ist die Quelle; ein Re-Export stellt die Datei
jederzeit her. Es fehlt nur die Sichtbarkeit.

## Definition of Done

- [ ] Boot-Vergleich Datei-`graphVersion` gegen Store-`graphVersion`, mit Richtungsangabe
- [ ] `graph_export` meldet die vorgefundene Datei-Version mit
- [ ] Ein Test, der mit einer künstlich zurückgesetzten SSOT rot läuft — vorher rot gesehen
- [ ] Entscheidung notiert: nur melden, oder Lese-Tools markieren

**Dateien:** `src/mcp-server.ts` · `src/exporter.ts` · `src/mcp-tools.ts` · ein Testfile · dieses CR
