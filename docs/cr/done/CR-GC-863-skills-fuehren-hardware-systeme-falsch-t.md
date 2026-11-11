# CR-GC-863: Skills führen Hardware-Systeme falsch — Produktteile als ACTOR, MOD-Schnitt ohne Domänenregel

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1090 (finding)
**Erstellt:** 2026-10-26
**Item:** bok/items/ITEM-2026-1090.json (Lane: graph)

---

## Befund (sirail, CR-028 und CR-029)

1. **Produktteile als ACTOR.** Der Weichenantrieb (Servo, Stellgestänge, Endlagenschalter) war Gegenüber:
   ActuateServo gab die Stellbewegung an den Akteur Anlage, die Anlage lieferte die Endlage zurück. Der Antrieb
   gehört aber zum Produkt (Spezifikation: Servo als Kaufteil, Halterung in Scope, Stückliste). Folge: SetRoute
   hatte zwei Akteur-Eingänge, und die Rückmeldung sah aus wie ein zweiter Auslöser. `se:author-actor` nennt in
   Schritt 3 „a device“ als mögliches Gegenüber, ohne zu sagen, dass ein Teil des eigenen Produkts nie eines ist,
   auch kein mechanischer Aktor und kein Kaufteil.
2. **MOD-Schnitt ohne Domänenregel.** Keiner der Skills sagt, wann ein Modul nach Mechanik, Elektronik und
   Software zerlegt wird. In sirail kippte die Antwort zweimal: erst „jede Domäne ein eigenes Blatt“, dann für den
   Servoantrieb „ein Modul“. RD-05 und CR-01 belohnen das Zusammenlegen (ITEM-2026-1077), `se-modulebene` und
   `se:optimize` schlagen es deshalb vor.

## Regel (Auftraggeber 2026-10-26)

- **Ein Modul darf aus beliebigen Domänen bestehen.** Nach Domänen getrennt wird nur, wo wir die Schnittstelle
  zwischen ihnen selbst festlegen und prüfen: dann je Domäne ein Blatt-MOD, zusammengefasst in einem MOD aus MODs.
  Beispiel: Control Unit aus Controller-HW (Platine) und Controller-SW (Firmware).
- **Innerhalb einer Baugruppe wird nicht zerlegt.** Was dort zwischen den Domänen passiert, ist wie ein
  modulinterner Aufruf in der Software: nicht modelliert. Beispiel: Servoantrieb aus Motor, Getriebe, Gehäuse,
  Regelelektronik, Stellgestänge und Endlagenschaltern ist ein Blatt-MOD. Seine Funktionen tragen die
  Anforderungen und Tests an seiner Grenze.
- **Ein Teil des eigenen Produkts ist nie ein ACTOR**, auch ein mechanischer Aktor oder ein Kaufteil nicht. Die
  Grenze liegt dort, wo das Produkt endet (Scope-Tabelle, Stückliste), nicht dort, wo die Software endet.
- Eine Kennzahl (RD-05, CR-01, Kohäsion) rechtfertigt weder ein Zusammenlegen noch ein Zerlegen.

## Änderungen

| Datei | Änderung |
|---|---|
| `.claude/commands/se/author-actor.md` | Schritt 3: Produktteile sind nie ACTOR, mit dem Servo als Beispiel; Prüfliste: „Ist ein Akteur ein Teil des eigenen Produkts?“ |
| `.claude/commands/se/top-level.md` | Abschnitt MOD + Stack: die Domänenregel mit beiden Beispielen |
| `.claude/commands/se-modulebene.md` | Schritt 3 und Vorschläge: vor jedem Zusammenlegen oder Zerlegen die Domänenfrage |
| `.claude/commands/se/optimize.md` | Quelle (b): ein Zug von `graph_suggest`, der Domänen zusammenlegt oder trennt, braucht die Domänenfrage vor der Probe |
| je Skill die OpenCode-Kopie | nachziehen, wie der Ausliefer-Mechanismus sie erzeugt |

Kein Regelkatalog-Eingriff: eine Regel, die Produktteile als ACTOR erkennt, oder ein Auslöser-Merkmal je Kette
ist Sache von contracts (ITEM-2026-1087 an sigloch-modules).

## Akzeptanzkriterien

- [ ] Jeder der vier Skills nennt die Regel an der Stelle, an der die Entscheidung fällt, mit Beispiel
- [ ] Die Feld-Tests der Skills (jede genannte Regel steht im Katalog) bleiben grün
- [ ] Probe: ein Agent mit `se:author-actor` auf sirail Stand graphVersion 24 legt den Weichenantrieb nicht als Gegenüber an
- [ ] Der CR-Knoten trägt `relation`-Kanten auf die vier Skill-FUNCs

## Umfang laut `graph_impact`

FUNC-author-actor, FUNC-se-top-level, FUNC-se-modulebene, FUNC-se-optimize (Kanten am CR-Knoten).
