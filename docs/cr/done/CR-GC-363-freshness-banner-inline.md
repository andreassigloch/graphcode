# CR-GC-363 — Freshness-Banner inline im Read-Ergebnis

**Status:** done — 2026-08-27
**Datum:** 2026-08-18

## Umsetzung (2026-08-27)

- `ToolContext.staleAnalysisBanner()` (`src/tools/tool-context.ts`): liefert genau eine
  `//`-Kommentarzeile (`// !! STALE-ANALYSIS: <ids> …`), wenn mindestens ein VORHANDENER
  AF-Stamp hinter dem Live-`graphVersion` liegt; sonst `''`. `absent` (nie analysiert)
  bleibt still — kein Rauschen, kein Reindex-Prompt.
- `graph_context` **und** `graph_impact` (`src/tools/read.ts`) setzen die Zeile vor das
  Format-E-Ergebnis; frischer Stamp → Ergebnis byte-unverändert (Test vergleicht das
  Stale-Ergebnis minus Kopfzeile byte-gleich gegen das frische).
- **Keine zweite Freshness-Quelle (Grep-Nachweis):** Die Klassifikation ist ausschließlich
  `computeAnalysisCurrency` aus `@sigloch/graphcode-client` (dieselbe, die GVE/readiness
  nutzt). `grep -rn analysisFreshness src/tools/` → nur der Bestandskommentar in
  `export.ts:230`; `grep -rn computeAnalysisCurrency src/` → einzige Aufrufstelle ist
  `tool-context.ts` (staleAnalysisBanner). Kein eigener Stamp-Vergleich im Banner-Pfad.
- Format-E-parsebar: `parse()` überspringt `//`-Zeilen; Round-Trip-Assertion decodiert das
  gebannerte Ergebnis fehlerfrei (`tests/mcp.read-format.test.ts`, red-first).
- Test liegt in `tests/mcp.read-format.test.ts` (statt eines neuen Files) — deckt frisch,
  stale (beide Tools, byte-Vergleich) und stampfrei ab.
- **Blocker aufgehoben:** `SPIKE-GC-minimal-whitebox` ist seit langem abgeschlossen
  (Job-Scheibe CR-GC-367 in Betrieb); die Datei-Kollisions-Sperre unten ist damit obsolet.
- **Suite-Stand bei Abschluss (attribuiert, Stash-Gegenprobe):** 965/985 grün. Die 20 Roten
  in 10 Dateien fallen identisch MIT und OHNE die Änderungen dieses CRs: 2× Publish-Pending
  (lockfile-sync/distribution, seit dem ^5.4.0-Range aus CR-GC-373 erwartet rot) und 18×
  Kollateral des unpublizierten contracts-10-Zugs (sigloch-modules 7ecda8e, CR-SM-271 Teil 2:
  FLOW-relation-SCHEMA 1..1 als R-18-error) — graphcode läuft im Link-Modus gegen
  contracts 10.0.0, und Test-Fixtures mit SCHEMA-losen FLOWs (metrics, config, steering,
  suggest, generate, executor.bestofn, claims.conformance) scheitern seither im Seed.
**Kontext:** `docs/LANDSCAPE.md` L3. CodeGraph setzt ein ⚠️-Banner an jedes
Ergebnis, sobald der Index hinter dem Working Tree liegt; GitNexus prüft
post-commit per PostToolUse. graphcode hat die Substanz bereits — AF-01..05
Freshness-Stamps (contracts 3.1.0) — aber sie sind nur in `readiness` sichtbar.
Wer `graph_context`/`graph_impact` liest, sieht nicht, ob die Scheibe alt ist.

## Ziel

Die vorhandenen AF-Stamps im **Read-Ergebnis** selbst sichtbar machen: eine
Zeile am Kopf der Format-E-Antwort, wenn der Stamp hinter dem aktuellen Repo-
State liegt. Keine neue Freshness-Quelle, keine zweite Rechnung — nur der
bestehende Stamp an der Stelle, an der er die Entscheidung beeinflusst.

Bewusst **kein** PostToolUse-Reindex-Prompt (GitNexus-Hälfte): graphcode
reseedet nicht automatisch, der Graph ist SSOT und nicht der abgeleitete Cache.
Das Banner informiert, es fordert nicht zum Neubau auf.

## Dateien (≤6)

- `src/tools/read.ts`
- `src/tool-context.ts`
- `tests/mcp.read-format.test.ts`

## Akzeptanzkriterien

- [x] Frischer Stamp → Ergebnis **unverändert** (kein Rauschen im Normalfall)
- [x] Veralteter Stamp → genau eine Kopfzeile, Format-E-parsebar (Round-Trip-Test)
- [x] Banner nutzt den AF-Stamp, berechnet Freshness nicht neu (Grep-Nachweis:
      keine zweite Quelle — s. Umsetzung)
- [x] Gilt für `graph_context` **und** `graph_impact`; Test deckt beide ab
- [x] `npm run build` + Tests grün (bekannte Publish-Pending-Rote ausgenommen, s. CR-GC-373)

---

## Blockiert (2026-08-18)

**Nicht implementieren, bis `SPIKE-GC-minimal-whitebox` abgeschlossen ist.** Die Sperre ist
hier **nicht** inhaltlich — das Freshness-Banner ist unabhängig von der Whitebox-Frage —
sondern eine Datei-Kollision: der Spike ändert dieselbe Read-Ergebnis-Oberfläche
(`src/tools/read.ts`, Format-E-Kopf). Zuerst der Slice, dann das Banner darauf.
