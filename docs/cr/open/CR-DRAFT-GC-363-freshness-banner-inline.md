# CR-GC-363 — Freshness-Banner inline im Read-Ergebnis

**Status:** draft
**Datum:** 2026-08-18
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

- [ ] Frischer Stamp → Ergebnis **unverändert** (kein Rauschen im Normalfall)
- [ ] Veralteter Stamp → genau eine Kopfzeile, Format-E-parsebar (Round-Trip-Test)
- [ ] Banner nutzt den AF-Stamp, berechnet Freshness nicht neu (Grep-Nachweis:
      keine zweite Quelle)
- [ ] Gilt für `graph_context` **und** `graph_impact`; Test deckt beide ab
- [ ] `npm run build` + Tests grün

---

## Blockiert (2026-08-18)

**Nicht implementieren, bis `SPIKE-GC-minimal-whitebox` abgeschlossen ist.** Die Sperre ist
hier **nicht** inhaltlich — das Freshness-Banner ist unabhängig von der Whitebox-Frage —
sondern eine Datei-Kollision: der Spike ändert dieselbe Read-Ergebnis-Oberfläche
(`src/tools/read.ts`, Format-E-Kopf). Zuerst der Slice, dann das Banner darauf.
