# CR-GC-952: se-plan: R-21-Befund bleibt offen, nicht abgenommen

**Typ:** aus Item ITEM-2026-1391 (finding)
**Erstellt:** 2026-11-16
**Item:** bok/items/ITEM-2026-1391.json (Lane: code)

---

se-plan Z. 31 sagt, bei FC-06-Verbot bleibe der R-21-Befund abgenommen. Code (ABNEHMBAR in focus-set.ts) und close-violations (Architekturregeln nie abgenommen) sagen: nicht abnehmbar. Autor 2026-11-16: Modell und Code müssen konsistent sein; die Forderung ist nicht dauerhaft abnehmbar; es kann Code fehlen.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Darf ein R-21-Befund abgenommen werden, wenn FC-06 die gemeinsame Kette verbietet? | Nein; er bleibt offen, bis Modell oder Code ihn schließen | Modell und Code müssen übereinstimmen; Architekturregeln sind nicht abnehmbar (ABNEHMBAR) |

---

## Umfang

Ein Skill-Text: `.claude/commands/se-plan.md` (v14 → v15), zwei Sätze.

| Stelle | alt | neu |
|---|---|---|
| Z. 31, Zeile FUNC↔FUNC | „if FC-06 forbids it, keep the accepted R-21 finding and name the pair in the output" | „if FC-06 forbids it, the R-21 finding stays open (no `acceptedFindings`; architecture rules are not acceptable) and you name the pair in the output as open work. It closes only by a model move or by code — the code that carries the handover or its test may be missing" |
| Z. 36 | „only an all-✓ table (or named accepted findings) lets you cut." | „only an all-✓ table lets you cut; a pair FC-06 forbids stays ✗ and is named as open work." |

Weitere Stellen in `.claude/commands`, `src/`, `.opencode/`: keine, die eine Architekturregel als abgenommen behandeln (grep). `se/close-violations` sagt bereits „Architecture rules are never accepted". Kopien in Templates: keine.

## Tests

`tests/se-plan-r21-offen.test.ts`, vorher rot (3 von 4), danach grün.

`tests/skill-se-plan-dateigrenze.test.ts` (CR-GC-927) prüfte `version: 14` fest. Der Volllauf fand es außerhalb der Auswahl (Schlupf 1). Der Test prüft jetzt „mindestens 14".
