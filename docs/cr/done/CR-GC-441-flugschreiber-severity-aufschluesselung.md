# CR-GC-441 — Flugschreiber: Severity-Aufschlüsselung + methodischer Vorbehalt

**Status:** DONE 2026-08-27 — umgesetzt als gve-Änderung (graph-view-edit,
`feat: flugschreiber zeigt warnungen und infos (CR-GC-441)`); graphcode-seitig 0 Dateien
(die Auswertung läuft komplett in gves `vite.config.js`, wie beim Vorgänger)
**Angelegt:** 2026-08-27
**Vorgänger:** CR-GC-410 (Karte „Wirkt die Arbeit?", `docs/cr/done/`) — bleibt geschlossen
**Herkunft:** Auftraggeber 2026-08-27: „die fehler waren ja eher durch regeländerungen
getrieben, ergänze die warnungen und informationen, dann haben wir in jedem fall content."

## Problem

Die Karte misst je committetem Graph-Stand `{elements, open, errors}`. Warnungen und Infos
werden gezählt (sie stecken in `open`), aber nirgends ausgewiesen — die Karte kennt nur
„alles" und „error".

Das macht den Sekundärbefund irreführend: am graphcode-Repo steht „**0** der letzten 24 Stände
ohne error", was sich wie ein Arbeitsurteil liest. Tatsächlich wird **jeder historische Stand
mit dem HEUTIGEN Regelstand bewertet** — die Fehlerzahl bewegt sich damit auch durch
Regelverschärfungen (zuletzt contracts 10.0.0: SC-04 entfällt, FLOW→SCHEMA wird 1..1 als
R-18-error), nicht nur durch die Arbeit. Der Vorbehalt stand nirgends an der Karte.

## Änderung

Drei Dateien in graph-view-edit, kein zweiter Messpfad, keine neue Metrik:

1. **`vite.config.js` / `measureGraphHistory`** — je Stand zusätzlich `warnings` und `infos`,
   aus DENSELBEN Violations gefiltert wie `errors`. `severity` ist ein geschlossenes Trio,
   also gilt immer `errors + warnings + infos === open`; `open` bleibt die Summe.
   **Cache-Invalidierung:** der Cache lebt im Prozess-Speicher (eine `Map` im
   `dashboardApiPlugin`, nichts auf Disk) und ist je Commit-Hash geschlüsselt. Ein Stand ist
   unveränderlich, sein *Messergebnis* aber nicht — der alte Eintrag trägt die neuen Felder
   nicht und schlüge als `warnings: undefined` bis in die Karte durch. Der Key trägt deshalb
   jetzt eine Schema-Version (`HISTORY_MEASURE_SCHEMA`): alte Einträge treffen nie, neu
   gemessen wird automatisch.
2. **`vite.config.js` / `flightRecorderPayload`** — `severityRange` (min/max je Severity über
   DASSELBE Fenster wie der Sekundärbefund) und `rulesVersion` (`RULES_VERSION` aus
   `@sigloch/contracts/se`). Eine Spanne ist ein Fakt über die gemessenen Stände, keine
   Trendaussage — genau das, was die Daten tragen, wenn das Regelwerk sich unter ihnen bewegt
   hat. Fehlt die Aufschlüsselung in den Ständen, ist `severityRange` `null`, nicht 0.
3. **`src/dashboard/Dashboard.jsx` + `dashboard.css`** — drei dünne Nebenlinien im DEMSELBEN
   Plot (gleiche x, gleiche y-Skala, weil alle drei Teilmengen von `open` sind), die dicke
   Linie „Elemente gegen offene Verstöße" bleibt die Hauptaussage. Dazu die Jetzt-Zeile mit
   allen drei Zahlen, die Spanne unter dem Sekundärbefund und der methodische Vorbehalt als
   EINE Zeile direkt am Befund:

   > Methodik: jeder Stand wird mit dem heutigen Regelwerk bewertet (Regeln 10.0.0) — die
   > Zahlen bewegen sich daher auch durch Regeländerungen, nicht nur durch die Arbeit

Der Sekundärbefund selbst bleibt unverändert stehen (er ist der Gate-Wirkungs-Nachweis); die
Spanne daneben ist die ehrlichere Ergänzung: am graphcode-Repo „1–114 Fehler (error) · 21–78
Warnungen (warning) · 4–9 Hinweise (info)" über dieselben 24 Stände macht sichtbar, dass die
114 ein Regelwechsel-Artefakt sind und der aktuelle Stand bei 1 steht.

## Akzeptanzkriterien

- [x] `measureGraphHistory` liefert je Stand `warnings`/`infos` aus derselben Violation-Liste;
      `errors + warnings + infos === open` ist getestet, nicht behauptet.
      — `tests/vite-config-flightrecorder.test.mjs`, Erwartung aus derselben Referenz gerechnet
- [x] Ein Cache-Eintrag im alten Schema schlägt nicht als `warnings: undefined` durch
      (red-first: der Test war rot mit `measured === 0`, weil der Stand aus dem Cache kam).
- [x] `severityRange` über dasselbe Fenster wie `errorFree`; ohne Aufschlüsselung `null`,
      keine erfundene 0.
- [x] Die Karte zeigt die drei Severities getrennt, ohne die Hauptaussage zu verdrängen
      (Hauptpfad `.gve-fr-path` 2px accent, Severity `.gve-fr-sev` 1.25px/0.8 opacity).
- [x] Der methodische Vorbehalt steht GENAU EINMAL an der Karte, eine Zeile, mit der
      Regelversion — im Test auf „einmal" und „≤ 1 Satz" gepinnt.
- [x] Alter Payload ohne Severity → keine Nebenlinien, keine `NaN`-Koordinaten, Hauptpfad steht.
- [x] Design-Tokens only, `data-testid` kebab-case
      (`flightrecorder-path-errors|-warnings|-infos`, `flightrecorder-severity-range`,
      `flightrecorder-caveat`), Labels umgangssprachlich zuerst mit der Technik in Klammern
      („1 Fehler (error) · 23 Warnungen (warning) · 5 Hinweise (info)").

## Ergebnis

- **Tests:** `npm test -- --no-ingest` → **766/766 grün** (vorher 757; +9 neue, alle red-first
  gesehen: 9 Fehlschläge aus den richtigen Gründen vor der Implementierung). `npm run build`
  grün.
- **Pixel-Verifikation** gegen `GVE_REPO_ROOT=…/graphcode`: 79 Stände, drei Nebenlinien
  sichtbar und dem Hauptpfad untergeordnet; Jetzt-Zeile „692 Elemente gebaut, 29 offene
  Verstöße — davon 1 Fehler (error) · 23 Warnungen (warning) · 5 Hinweise (info)".
- **Rechenzeit unverändert:** kalt 3441 ms für 79 Stände (~43 ms/Stand, vorher ~40 ms/Stand
  bei 78), warm 93 ms — die zwei zusätzlichen `filter()` laufen auf derselben Liste.
