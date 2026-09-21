# CR-GC-571: Smeagol-Check: Ratschlaege gegen den Regelkatalog pruefen — drei Stufen

**Status:** ✅ Done (2026-09-21)
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

---

## 5 Umsetzung (2026-09-21)

### 5.1 Der Gate-Lauf, nicht die Lektuere

`graph_mutate` mit `dryRun:true` auf dem laufenden Graphen (graphVersion 341), Batch:
ein UC plus `SYS compose UC`, **kein** `compose` auf eine FCHAIN. Was tatsaechlich feuert:

| Regel | Severity | Meldung |
|---|---|---|
| **`UC-03`** | warning | *UC-… has no FCHAIN scenario* |
| **`FC-02`** | warning | *Leaf UC UC-… has no FCHAIN scenario* |
| `UC-01` | error | *has no requirements (compose→REQ)* — anderer Mangel |
| `UC-02` | error | *is not reachable from any ACTOR* — anderer Mangel |
| `UC-05` / `UC-06` | info | Post-/Precondition-REQ fehlt |

`R-14` steht in keiner Zeile: die Regel wurde mit CR-SM-294/295 gestrichen, der Satz im
Skill blieb stehen. `author-uc.md` nennt jetzt `UC-03` und `FC-02` und sagt dazu, dass
beide **Warnungen** sind — der Batch laeuft durch; blockierend sind `UC-01` und `UC-02`.
Das war in der alten Fassung mitgemeint und falsch: ein erfundener Regelname, dem eine
Blocker-Erwartung anhaftete.

### 5.2 Zwei weitere, vom Scan gefunden

Der Test fand beim ersten Lauf zwei Nennungen mehr, beide ebenfalls gestrichene Regeln:

- `se-fmea`: `FC-01` (Akteursgrenze) — die Pruefung leistet heute `FC-04`, an zwei Stellen.
- `se-view:fmea`: `R-03` (ASIL-Isolation) — als Risiko-Blocker-Signal gemeint; das ist
  heute `FM-03` (*HighRiskVerification*, error).

Damit waren **drei von zwanzig** genannten IDs erfunden. Dazu ein toter Zweig
`case 'R-14':` im Steering-Scriptor, den nie ein Lauf erreichen konnte — geloescht.

### 5.3 Der Test

`tests/skill-rule-ids.test.ts` scannt `.claude/commands/**/*.md` und zusaetzlich den Weg,
der das Modell WIRKLICH erreicht: `RULE_CLAUSE`-Schluessel, die gerenderten Klauseltexte,
`GENERATION_TEMPLATE`, `SYSTEM` und `IDLE_NUDGE`.

**Keine gepflegte Liste**: Praefixe UND IDs kommen aus `ALL_RULE_DEFS`. Eine neue
Regelfamilie ist automatisch abgedeckt, eine gestrichene faellt automatisch auf — eine
zweite Liste waere derselbe Fehler noch einmal. Das Muster verlangt zwei Ziffern, weil der
Katalog durchgehend nullgepolstert ist; uids wie `MS-1-specification` fallen damit nicht
faelschlich hinein. Eine Positivkontrolle im Test haelt fest, dass der Scan ueberhaupt
greift: er muss `R-14` als erfunden erkennen und mehr als zehn echte Nennungen finden.

### 5.4 Kriterien

| # | Kriterium | Ergebnis |
|---|---|---|
| 1 | Ein Test bricht bei einer unbekannten Regel-ID | erfuellt — rueckwaerts belegt: `R-14` wieder eingesetzt, Test rot, Fundstelle benannt |
| 2 | `author-uc.md` nennt die tatsaechlich feuernde Regel, belegt durch einen Gate-Lauf | erfuellt — §5.1 |

Stufe (b) und (c) bleiben Folge-CRs, wie in §3 festgelegt. Die groesste Ratgeber-Menge im
System — die 74 Prosa-`fix_hint` — ist weiterhin vollstaendig ungeprueft.
