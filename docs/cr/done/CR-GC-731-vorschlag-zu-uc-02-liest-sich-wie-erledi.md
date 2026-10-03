# CR-GC-731: Vorschlag zu UC-02 liest sich wie erledigt, wenn der Akteur angebunden ist, aber Funktionen fehlen (Probe H Zug 4)

**Status:** ✅ Done (2026-10-03)
**Typ:** aus Item ITEM-2026-714 (bug)
**Erstellt:** 2026-10-03
**Item:** bok/items/ITEM-2026-714.json (Lane: code)

---

## Befund

Probe H Zug 4: der Akteur war seit Zug 3 über Datenflüsse angebunden, der Vorschlag lautete trotzdem „Verbinde
die Abläufe … über Datenflüsse mit ihrem Nutzer.“ UC-02 verlangt den Weg ACTOR → FLOW → FUNC, wobei die FUNC zur
Kette des Ablaufs gehört — es fehlten die Funktionen, nicht die Anbindung. Der Satz stimmte zur Regel, las sich
für den Nutzer aber wie erledigt.

## Änderung

| Datei | Änderung |
|---|---|
| `src/loop/next-step.ts` | Satz zu UC-02 nennt die fehlenden Funktionen |
| `tests/mcp.mutate-next-step.test.ts` | Akteur angelegt, Funktionen fehlen → Satz nennt Funktionen und Ablauf |
