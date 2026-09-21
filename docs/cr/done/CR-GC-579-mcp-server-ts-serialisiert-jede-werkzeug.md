# CR-GC-579: Jede Werkzeugantwort reist mit Einrueckung — 18 % des Kontexts fuer Leerzeichen

**Status:** ✅ Done (2026-09-21)
**Typ:** aus Item ITEM-2026-421 (finding)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-421.json (Lane: graph)

---

## 1 Befund

`src/surface/mcp-server.ts:60` serialisiert **jede** Antwort **jedes** Werkzeugs mit
Einrueckung 2:

```ts
return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
```

Gemessen an `rig/greenfield-systemtest/runs/opus5-5`, ueber alle Werkzeug-Ergebnisse im
Kontextfenster:

| Werkzeug | mit Einrueckung | kompakt | Ersparnis |
|---|---:|---:|---:|
| `graph_mutate` | 183.930 | 146.094 | 20,6 % |
| `graph_generate` | 41.649 | 35.899 | 13,8 % |
| `graph_authoring_guide` | 10.564 | 8.611 | 18,5 % |
| `graph_readiness` | 6.920 | 4.279 | **38,2 %** |
| `graph_export` | 1.598 | 1.045 | 34,6 % |
| **alle Werkzeug-Ergebnisse** | **266.188** | **217.442** | **18,3 %** |

`Read` und `Bash` liefern kein JSON und bleiben unveraendert (21.276 Zeichen); die 18,3 %
sind also der Anteil am **Gesamtpayload**, nicht am JSON-Anteil allein.

Warum `graph_readiness` am staerksten betroffen ist: seine Antwort besteht fast nur aus
Zahlenfeldern, und `JSON.stringify(x, null, 2)` schreibt jedes Array-Element auf eine
eigene Zeile. Sechs Dimensionen werden so zu achtzehn Zeilen.

## 2 Warum das zaehlt

Der Posten ist teurer als er aussieht. Er faellt nicht einmal an, sondern steht danach in
jedem Cache-Read der Sitzung — und die `cache_creation` kostet etwa das Zwoelffache des
Lesepreises (CR-GC-567). In `opus5-5` verursachte `graph_mutate` allein 48 % davon.

## 3 Zug

Das zweite Argument streichen. Ein Werkzeugergebnis wird von einem Parser gelesen, nicht von
einem Menschen; wer es lesbar braucht, formatiert es an der Anzeige.

**Nicht mitstreichen:** die Einrueckung in `graph_export` und in den `docs/views/*.md`-
Projektionen. Die sind Dateien im Repo, die ein Mensch liest und `git diff` zeilenweise
vergleicht — dort ist die Einrueckung der Zweck, nicht der Abfall.

## 4 Akzeptanzkriterien

1. `mcp-server.ts` serialisiert kompakt; kein zweiter Serialisierungspfad bleibt daneben stehen.
2. Ein Test pinnt, dass die Antwort keine `\n  `-Folge traegt — sonst kehrt die Einrueckung
   bei der naechsten Bequemlichkeit zurueck.
3. Dateien im Repo (`graph_export`, Views) bleiben eingerueckt — ein Test, der beides
   auseinanderhaelt.
4. Kein Werkzeug-Ergebnis aendert seinen INHALT; geprueft ueber `JSON.parse`-Gleichheit
   vorher/nachher.

## 5 Verhaeltnis zu den Nachbar-CRs

Die drei greifen an verschiedenen Stellen derselben Antwort an und addieren sich:

| CR | Hebel | gemessen am `graph_mutate`-Payload |
|---|---|---|
| CR-GC-570 (umgesetzt) | Befunde je Regel falten statt je Element | −67,5 % des Violations-Blocks |
| **CR-GC-579 (diese)** | kompakt serialisieren | −20,6 % |
| CR-GC-576 | leere Advisories weglassen | −6,5 % |
| CR-GC-577 | dryRun→apply-Verdopplung | −19,0 % |

Reihenfolge: **579 zuerst.** Sie ist die billigste und beruehrt die anderen nicht — die
Prozente der anderen sind danach gegen die kompakte Antwort neu zu messen, nicht zu addieren.

---

## 6 Umsetzung (2026-09-21)

Das zweite Argument ist weg. Die Serialisierung steht jetzt als `serializeToolResult` an
EINER Stelle in `mcp-server.ts` — exportiert, damit die Zusage pruefbar ist, ohne einen
Server zu starten, und damit kein zweiter Pfad danebensteht, an dem die Einrueckung
zurueckkehrt. Der Socket-Pfad (`host-shim.ts`) serialisierte ohnehin schon kompakt.

`tests/mcp.compact-serialization.test.ts` haelt die zwei Seiten auseinander, die hier leicht
verwechselt werden: ein Werkzeug-Ergebnis liest ein **Parser**, eine Repo-Datei liest ein
**Mensch** samt `git diff`. Die Einrueckung ist dort der Zweck und hier der Abfall.

| # | Kriterium | Ergebnis |
|---|---|---|
| 1 | kompakt, kein zweiter Serialisierungspfad | erfuellt — eine Funktion, `host-shim` war schon kompakt |
| 2 | ein Test pinnt, dass keine `\n  `-Folge reist | erfuellt — rueckwaerts belegt: `null, 2` wieder eingesetzt, zwei Faelle rot |
| 3 | Repo-Dateien bleiben eingerueckt | erfuellt — `exportGraphJson` gegen den echten Exporter geprueft |
| 4 | kein Ergebnis aendert seinen INHALT | erfuellt — Gleichheit ueber `JSON.parse`, inkl. `null`/`[]`/`0`/`''`/`false` |

**Nachtrag zum Betrieb:** ein laufender MCP-Host serialisiert weiter eingerueckt, bis er neu
startet — er faehrt den Code, mit dem er gebootet hat.
