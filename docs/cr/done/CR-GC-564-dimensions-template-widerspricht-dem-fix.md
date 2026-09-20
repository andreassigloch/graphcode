# CR-GC-564: Die Regel-Klausel ist die Anweisung, nicht ein Zusatz zu einer falschen

**Status:** ✅ Done (2026-09-20)
**Typ:** aus Item ITEM-2026-389 (bug)
**Erstellt:** 2026-09-20
**Item:** bok/items/ITEM-2026-389.json (Lane: graph)

---

## 1 Befund

Nach CR-GC-563 fokussiert die Schleife korrekt den Fehler — Rig-Lauf 5 zeigt
`defer: uc:UC-01:…`, also wurde UC-01 bearbeitet. Ergebnis trotzdem: **null REQ**,
zwei R-08-Blocks (Kanten auf FCHAINs, die es nicht gibt), 15 Elemente.

Der Grund steht im gerenderten Rundenprompt — deterministisch nachgestellt, kein zweiter
Lauf nötig:

> Funde: UC-data-integrity (UC-01: … has no requirements (compose→REQ) — **Fix: Add at
> least one REQ via compose trace**); … **Schlage je Fund 2–3 Kandidaten vor: fehlende
> ACTORs (Anbindung ACTOR io→FLOW io→FUNC in der FCHAIN des UC), FCHAIN-Szenarien
> (UC compose FCHAIN) oder fehlende UCs aus der Intention.**

Der Fund sagt dreimal REQ. Der **Befehlssatz** — der einzige Imperativ im Prompt — nennt
ACTOR, FCHAIN und UC, und das Wort REQ kommt darin nicht vor. Das Modell hat den Imperativ
befolgt.

**Ursache:** `GENERATION_TEMPLATE` ist nach **Dimension** geschlüsselt, das Fund-Fenster
seit CR-GC-290 nach **Regel**. Solange die Fenster alphabetisch kamen, traf die
uc-Instruktion zufällig meistens zu (FC-02 will genau FCHAINs). Mit der Severity-Ordnung
kommt UC-01 zuerst — und für UC-01 ist die uc-Instruktion schlicht falsch. CR-GC-563 hat
den Widerspruch nicht erzeugt, es hat ihn freigelegt.

Das Mittel dagegen existiert bereits: `RULE_CLAUSE`, eine regelgenaue Klausel mit konkreten
uids. Sie hat heute **einen** Eintrag (R-15) und wird **angehängt** — und dieser eine
Eintrag endet mit *„Für diese Funde KEINE neue FCHAIN und keinen neuen UC anlegen"*. Also
mit dem Widerruf dessen, was drei Zeilen vorher steht. Zwei Anweisungen zur selben Sache,
die zweite nimmt die erste zurück: genau der parallele Pfad, nur in Prosa.

## 2 Zielbild

**Gibt es eine Regel-Klausel, IST sie die Anweisung.** Das Dimensions-Template ist der
Rückfall für Regeln ohne eigene Klausel. Damit gibt es je Runde genau einen Imperativ.

Neue Klauseln für die beiden Fehler-Regeln, die jetzt zuerst drankommen:

- **UC-01** — REQ-Kandidaten je UC, jede REQ zusammen mit ihrem TEST im selben Batch
  (Wortlaut aus dem `req`-Template, das diese Arbeit bereits korrekt beschreibt).
- **UC-02** — die Verdrahtung `ACTOR io→FLOW io→FUNC`, FLOWs und FUNCs im selben Batch,
  samt der Warnung, dass ACTOR direkt an UC oder FCHAIN von R-18 abgewiesen wird. Das ist
  der Fehler, der Lauf 3 zweimal gekostet hat.

R-15s Klausel verliert ihren Widerruf-Satz — es gibt nichts mehr zu widerrufen.

## 3 Umfang

- `src/loop/generate.ts` — Klausel schlägt Template; Einträge UC-01, UC-02; R-15 bereinigt
- `tests/generate.test.ts` — Abnahme

Zwei Dateien.

## 4 Abnahme

1. Ein UC-01-Fenster erzeugt eine Anweisung, die **REQ** verlangt, und **nicht** die
   ACTOR/FCHAIN/UC-Aufzählung des Dimensions-Templates.
2. Ein UC-02-Fenster nennt den legalen Pfad `ACTOR io→FLOW io→FUNC`.
3. Eine Regel **ohne** Klausel bekommt weiterhin das Dimensions-Template.
4. Kein Prompt enthält Template und Klausel gleichzeitig (ein Imperativ je Runde).
5. Suite grün.

## 5 Was bewusst offen bleibt

Nur drei der 28 feuernden Regeln haben nach diesem CR eine eigene Klausel. Die übrigen
fahren weiter auf dem Dimensions-Template, und für jede von ihnen kann derselbe Widerspruch
bestehen. Das systematisch zu prüfen — Regel für Regel, `fix_hint` gegen Template — ist
Fleißarbeit und ein eigenes Vorhaben; dieses CR behebt die drei, die gemessen als erste
drankommen.
