# CR-GC-571: Smeagol-Check: Ratschlaege gegen den Regelkatalog pruefen — drei Stufen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-410 (idea)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-410.json (Lane: graph)

---

## 1 Befund

`se:author-uc` behauptet: *"a UC with no `compose` raises **R-14**"*. **R-14 existiert nicht** —
nicht in `@sigloch/contracts`, nicht in `@sigloch/se-engine`. Der Skill wird in jede `uc`- und
`seed:uc`-Runde injiziert; das Modell liest die Falschaussage in jeder UC-Runde.

Von 18 in Skills genannten Regel-IDs ist genau diese eine erfunden. Gefunden wurde sie nicht von
einem Test, sondern von Hand — es gibt keinen.

## 2 Drei Stufen, aufsteigend im Aufwand

**(a) Existenz.** Jede in einem Skill oder Prompt genannte Regel-ID steht im Katalog.
Mechanisch, billig, faengt den R-14-Fall. **Dieser CR liefert (a) plus die Korrektur.**

**(b) Der ausfuehrbare Vorschlag ist regelkonform.** Die 11 `FIX_TEMPLATES` gehen zur Laufzeit
als `dryRun` durchs Gate, ein blockierender Verstoss faellt also auf. Aber **kein Test
assertiert, dass ein Template keine neuen Verstoesse erzeugt** — gerankt wird nach
Score-Senkung, ein schaedlicher Vorschlag ist damit schlecht platziert, nicht ausgeschlossen.

**(c) Der Prosa-`fix_hint` beschreibt einen legalen Edit.** **74 Stueck, nie ausgefuehrt, nie
geprueft** — und genau die liest das Modell (487 Nennungen in einem Lauf). Pruefbarer Proxy:
der Hinweis nennt Trace-Typ und Elementtypen; die Kombination muss in `TRACE_PATTERNS` stehen.

Die groesste Ratgeber-Menge im System ist die einzige voellig ungepruefte.

## 3 Umfang dieses CR

Nur (a) + Korrektur von R-14 in `author-uc.md` auf die tatsaechlich feuernde Regel. (b) und (c)
sind Folge-CRs — (c) braucht einen Parser fuer Prosa und ist der teuerste.

## 4 Akzeptanzkriterien

1. Ein Test bricht, wenn ein Skill eine Regel-ID nennt, die der Katalog nicht kennt.
2. `author-uc.md` nennt die Regel, die bei fehlendem `compose` tatsaechlich feuert — belegt
   durch einen Gate-Lauf, nicht durch Lektuere.
