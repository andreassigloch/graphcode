# CR-GC-416 — Das Sitzungsregister bekommt seinen Datenvertrag

**Status:** done — 2026-08-25 (graphVersion 197)
**Herkunft:** CR-GC-409 §A, Paket „Session-Registry".
**Ziel:** R-31 für `FUNC-gve-supervise` und `FUNC-gve-sessions` schließen.
**Voraussetzung:** CR-GC-415 (sonst melden die entstehenden Kettenpaare R-21).

## Befund

Der Viewer gehört seit CR-GC-404 dem Repo: jede Sitzung trägt sich in
`.graphcode/sessions/<pid>` ein, und erst die letzte macht das Licht aus. Im
Modell hängen beide beteiligten FUNCs an keiner `io`-Kante (R-31), obwohl genau
zwischen ihnen ein Datenaustausch über Dateien läuft.

Im Code fehlt an derselben Stelle die Prüfung: `liveSessions()` liest den Eintrag
mit `JSON.parse(...) as SessionEntry` — ein ungeprüfter Cast. Ein Eintrag mit
fehlendem `hostname` wird dadurch als „anderer Rechner" gelesen und stillschweigend
ignoriert; die Sitzung zählt nicht mehr mit, und der Viewer geht zu früh aus. Das
ist derselbe Fehlerklasse-Fall, den CR-GC-404 überhaupt erst ausgelöst hat.

## Umfang

**Code**
- `src/gve-session-contract.ts` (neu): `SessionEntrySchema` als Zod. Eigene Datei,
  weil `gve-sessions.ts` das Symbol IMPORTIEREN muss (RC-04 zählt eine Deklaration
  im selben File nicht) — und sachlich: der Eintrag wird von einem Prozess
  geschrieben und von einem anderen gelesen, gehört also keinem von beiden.
- `src/gve-sessions.ts`: `liveSessions()` parst den Eintrag statt ihn zu casten.
  Ein formfremder Eintrag ist wertlos und wird — wie ein unlesbarer — entfernt.

**Modell (gate-only, `graph_mutate`)**
- `FLOW-session-registry` + `SCHEMA-session-registry` (realRef `SessionEntrySchema`)
- io: `FUNC-gve-supervise → FLOW-session-registry` (registriert/entfernt die eigene
  Sitzung), `FLOW-session-registry → FUNC-gve-sessions` (liest), `FUNC-gve-sessions
  → FLOW-session-registry` (räumt tote Einträge ab — ein echter Schreibzugriff),
  `FLOW-cli-command → FUNC-gve-supervise` (das `mcp`-Verb hängt die Sitzung an).

Ein FLOW statt zwei: `liveSessions` liest UND schreibt dasselbe Register. Eine
zweite „Liste lebender PIDs"-Kante wäre ein Vertrag ohne eigene Prüfstelle — die
PIDs sind bereits beim Lesen validiert.

## Regel-Delta (gemessen)

| Regel | vorher | nachher |
|---|---|---|
| R-31 | 9 | 7 |

## Abnahme

`tests/gve-supervision.test.ts`: ein formfremder Sitzungseintrag wird verworfen
statt als fremder Rechner gelesen; die Zählung lebender Sitzungen bleibt korrekt.
Echte Dateien im Temp-Verzeichnis, keine Mocks.
