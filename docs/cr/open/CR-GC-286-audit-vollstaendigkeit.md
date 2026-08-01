# CR-GC-286 — Audit-Vollständigkeit + Rejection-Beobachtbarkeit

**Status:** open — Implementierung fertig (2026-08-01, gemerged: formatE-STRUCT
auditiert, INPUT-SCHEMA-Verdict am Handler statt unauditiertem Throw, ruleIds
in run.log-Rejections, Unit-Tests grün). OFFEN ist nur noch der Opus-Nachtest
(12–24 Runden, braucht Anthropic-Key) + Nachtrag im Abschlussbericht.
**Datum:** 2026-08-01
**Kontext:** Die Opus-Fehldiagnose des Abschlussberichts („81 Rejections =
Emissions-Regime beschneidet Frontier") war nur durch Audit-Nachanalyse
korrigierbar — und selbst die war unvollständig: von 81 Rejections erreichten
nur 18 das Gate; 63 liefen durch zwei NICHT auditierte Pfade:

1. formatE-Decode-Fehler: `write.ts` returned das STRUCT-Block-Verdict ohne
   `recordAudit` (early return im catch).
2. Handler-Exceptions: `runMutate` im Executor fängt Throws als
   `executor-call`-Rejection — ohne Audit-Eintrag (z. B. `commands` kein
   Array, weil der Executor das Tool-Input-Schema nicht prüft, das sonst der
   MCP-Layer Zod-parst).

Zusätzlich loggt das run.log Rejections ohne Regel-IDs — post-hoc-Analyse ist
ohne audit.jsonl unmöglich.

## Ziel

Jede Rejection hinterlässt Evidenz — F2-Kette lückenlos:

1. **formatE-STRUCT auditieren:** der catch-Pfad in `graph_mutate` ruft
   `recordAudit` mit dem STRUCT-Verdict, bevor er returned.
2. **Executor-Input-Parität:** der Executor parst Tool-Input gegen
   `inputSchema` (Zod) BEVOR er den Handler ruft — wie der MCP-Layer. Der
   Parse-Fehler wird als Rejection mit der Zod-Meldung ins Modell-Feedback
   gegeben (statt generischem `executor-call`) und im run.log ausgewiesen.
3. **ruleIds im run.log:** jede Rejection-Trace-Zeile trägt die Regel-IDs,
   z. B. `gate rejected [R-01,R-18] — feeding violations back`.

## Nachtest (klärt die offene Opus-Frage)

Ein kurzer Opus-Lauf (12–24 Runden) nach Umsetzung zeigt im Audit, ob die
63 Nicht-Gate-Rejections formatE-Dialektfehler waren (das Tool EMPFIEHLT
formatE in der Description) oder Input-Schema-Fehler. Ergebnis als Nachtrag in
`docs/executor-abschlussbericht.md`.

## Dateien (≤6)

- `src/tools/write.ts` (recordAudit im formatE-catch)
- `src/executor.ts` (Input-Parse + ruleId-Logging)
- `tests/executor.test.ts`
- `tests/` (bestehender write-Tool-Test um Audit-Assertion ergänzen)
- `docs/executor-abschlussbericht.md` (Nachtrag Opus-Nachtest)

## Akzeptanzkriterien

- [ ] Unit-Test: kaputter formatE-Block → audit.jsonl enthält rejected-Eintrag
      mit STRUCT
- [ ] Unit-Test: Tool-Input ohne commands/formatE → Rejection mit Zod-Meldung
      im Feedback, Audit-Eintrag vorhanden
- [ ] run.log-Rejections tragen ruleIds
- [ ] Opus-Nachtest dokumentiert (auch wenn das Ergebnis die bisherige Lesart
      bestätigt)
- [ ] `npm run build` + Tests grün
