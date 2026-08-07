# CR-GC-304 — ConOps-View neu schneiden: 29148-OpsCon aus vorhandenen Knoten + CR-Bündel

**Status:** done · **Angelegt:** 2026-08-07 · **Geschlossen:** 2026-08-07 · **Max Files:** 5

> ## Abschluss 2026-08-07
>
> Alle sechs Abschnitte tragen gegen den Live-Graphen. `docs/views/conops.md` wächst
> von **1.266 auf 16.978 Bytes**:
>
> | § | Abschnitt | gerendert |
> |---|---|---|
> | 1 | System overview | `SYS-graphcode` |
> | 2 | Operational policies & constraints | **13 REQ** (wie vorhergesagt) |
> | 3 | User classes | **9 ACTOR**, jeder mit den UC, die er triggert |
> | 4 | Operational scenarios | **6 UC** mit FCHAIN + Funktionsfolge; **1 UC ohne Ablauf** ausgewiesen |
> | 5 | Modes of operation | ausgewiesene Lücke |
> | 6 | Nature of changes & impacts | **63 CR-Bündel** |
>
> **Zahlenkorrektur:** der CR nannte oben „74 von 96 CRs". Das war die Zahl der CRs mit
> *irgendeiner* `relation`-Kante (heute 78 von 100). §6 zählt nur Impact-Kanten auf
> `{UC, REQ, FUNC, MOD}` — reine `CR relation MS` ist Planung und gehört in den
> Changelog-View. Die richtige Zahl ist **63**.
>
> **Größen-Vorbehalt gehalten:** `src/views/graphcode.ts` liegt bei 383 Zeilen, unter
> 500 — kein Abspalten von `views/conops.ts` nötig, also keine sechste Datei.
>
> **Tests:** 12 neue in `tests/exporter.test.ts`, davon 7 vor dem Fix rot. Sie pinnen
> auch die Grenzfälle, an denen sich §2 entscheidet: eine `non-functional` REQ an
> genau einem MOD ist **Design** und bleibt draußen, eine `functional` REQ am SYS
> ebenso. `npm run build` grün, **74 Testdateien / 501 Tests grün**.

## Problem — drei Defekte, nicht einer

### 1. Der `operational`-Filter ist tot

`src/views/graphcode.ts:134` filtert `REQ.kinds ∋ "operational"`. `ReqKind` in
`@sigloch/contracts/se` (`ontology.js:28`) hat aber **genau 7 Werte** — `functional`,
`non-functional`, `risk`, `negative`, `mitigation`, `precondition`, `postcondition`.
**`operational` ist keiner davon**, so getaggte REQ kommen nie durchs Gate. Der Filter
kann per Konstruktion nie greifen: 0 Treffer bei 111 REQ.

Der Create-Skill zementiert es: `.claude/commands/se-conops.md:18` sagt „Tag
`attributes.kinds` `["operational"]` **oder** `["non-functional"]`" — die einzige
gate-fähige Wahl ist genau die, die der Renderer wegwirft.

### 2. Die View rendert nicht, was sie verspricht

`se-view:conops` beschreibt sich als „actors/system/**use-cases**". `renderConOps`
rendert **keinen einzigen UC** — nur SYS-Zeile, die tote REQ-Tabelle und eine flache
ACTOR-Liste ohne jede Kante. Im Graphen liegen 6 UC, 10 FCHAIN, 23 `ACTOR io UC` und
9 `UC compose FCHAIN` ungenutzt herum. Operational Scenarios sind der **Kern** eines
ConOps (ISO/IEC/IEEE 29148 §5.2.4) und fehlen komplett.

### 3. Die Änderungssicht fehlt (dein Punkt)

29148 verlangt „nature of changes" + „summary of impacts". Das Meta-Modell hat dafür
seit CR-155 exakt die passenden Kanten — `CR relation → {UC, REQ, FUNC, MOD}`
(„CR tracks mutated elements"). Ein CR **ist** das Bündel seiner erzeugten Elemente,
und das muss kein neuer Use Case sein: im Live-Graphen hängen an 74 von 96 CRs
zusammen **249 relation-Kanten** — 95× REQ, 60× FUNC, 38× MOD, 6× UC. Genau die
Mischung, die du beschrieben hast. Die View nutzt davon nichts.

## Entscheidung (2026-08-07, Nutzer)

**Kein contracts-Bump.** Die View wird gegen ISO/IEC/IEEE 29148 §5.2.4 (OpsCon)
neu geschnitten und **vollständig aus vorhandenen Knoten und Kanten** gefüllt.
Operationaler Scope ist eine **Graph-Position**, keine `kind`.

### Abbildung 29148 → Ontologie (jede Zeile aus echten Kanten, nichts erfunden)

| § | ConOps-Abschnitt | Graph-Quelle | im Graph |
|---|---|---|---|
| 1 | System overview / Scope | `SYS.description` | 1 SYS |
| 2 | Operational policies & constraints | `REQ` mit `kinds ∋ non-functional` **und** `SYS compose\|satisfy REQ` oder ACTOR-Kante | **13** |
| 3 | User classes & involved personnel | `ACTOR`, je Actor die getriggerten UC über `ACTOR io UC` | 9 / 23 Kanten |
| 4 | Operational scenarios | `UC compose FCHAIN`, je FCHAIN die Funktionsfolge `FCHAIN compose FUNC` | 6 UC / 10 FCHAIN |
| 5 | Modes of operation | **Lücke — s.u.** | — |
| 6 | Nature of changes & summary of impacts | `CR` + `CR relation → {UC, REQ, FUNC, MOD}`, je CR gebündelt | 74 CR / 249 Kanten |

**§2 — Gegenprobe am Live-Graphen:** der Filter liefert 13 REQ —
`REQ-disk-persistence`, `REQ-store-recovery`, `REQ-graceful-degradation`,
`REQ-single-kuzu-owner`, `REQ-single-store`, `REQ-single-transport`,
`REQ-buildable-standalone`, `REQ-graph-is-ssot`, `REQ-frame-binding`,
`REQ-import-se-ontology`, `REQ-harness-schema-in-contracts`, `REQ-interface-schema`,
`REQ-structure-driven`. Der operationale Rahmen, nicht die Use-Case-REQs. Eine REQ,
die nur an einem einzelnen FUNC/MOD hängt, ist Design und bleibt draußen.
ACTOR-gebundene REQ: heute 0 — die Regel bleibt trotzdem drin, weil sie die
User-Mgmt-/Creds-Klasse abdeckt, nach der der Create-Skill fragt.

**§6 — Schnitt:** gruppiert **je CR** (nicht je Zieltyp), Zeile = CR-uid, Status,
Name, und die betroffenen Elemente nach Typ gebündelt. Nur CRs mit
mindestens einer `relation`-Kante auf `{UC, REQ, FUNC, MOD}`; die 50 `CR relation MS`
sind Planungs-, keine Impact-Kanten und bleiben draußen (die stehen im
Changelog-View). Reihenfolge: CR-uid, damit deterministisch.

**§4 — Schnitt:** je UC die FCHAINs, je FCHAIN die FUNC-Folge. Ein UC ohne FCHAIN
wird **explizit als szenarienlos ausgewiesen**, nicht stillschweigend weggelassen —
das ist die ConOps-Aussage „für diesen Use Case ist kein Betriebsablauf beschrieben".

### Benannte Lücke: Modes of Operation (§5) — bewusst nicht gebaut

29148 zählt Betriebsmodi (normal / degraded / maintenance / recovery) zum
ConOps-Kern. Die Ontologie hat **keinen MODE-Elementtyp**; heute reist ein Modus
als REQ mit (`REQ-graceful-degradation` = Degraded-Betrieb). Diesen CR wird das
**nicht** auflösen: ein neuer ElementType ist Drift-Lock L1/L2 (Familie-Review +
contracts-Bump + publish + `npm install` in allen Konsumenten), und ein lokales
Behelfs-Attribut wäre genau der Ontologie-Fork, den `CLAUDE.md` verbietet. Die View
schreibt den Abschnitt als **ausgewiesene Lücke** in die Datei — sichtbar, nicht
verschwiegen (dasselbe Muster wie die FMEA-Empty-State-Zeile). Ob daraus ein
MODE-Typ oder eine `REQ`-Konvention wird, ist eine Familie-Entscheidung und
gehört in einen eigenen CR.

## Umsetzung

1. `src/views/graphcode.ts` — `renderConOps` auf die 6 Abschnitte umbauen; die
   §2-Auswahl als exportierte `operationalReqs(graph)` (testbar isoliert).
   Determinismus-Anspruch der Datei bleibt bindend: jede Map/Set nur als Lookup,
   Ausgabe-Reihenfolge über sortierte uid-Listen, kein `Date`/`Math.random`.
2. `.claude/commands/se-conops.md` — `version: 3`. Schritt 3 nennt **eine** legale
   Schreibweise (`["non-functional"]`) **und** die Pflicht-Trace (`SYS compose REQ`
   bzw. ACTOR-Kante) plus den Grund, warum `operational` nicht existiert. Das „oder"
   verschwindet. Neuer Schritt: die erzeugten Elemente an den CR hängen
   (`CR relation → …`), damit §6 sich füllt.
3. `.claude/commands/se-view/conops.md` — `version: 3`, Beschreibung auf die
   tatsächlichen 6 Abschnitte (heute verspricht sie Use Cases, die nie kamen).
4. `tests/exporter.test.ts` — Regressionstests, rot ohne den Fix.

## Akzeptanzkriterien

- [ ] **red-first:** jeder der folgenden Tests ist gegen den heutigen Stand rot
      gesehen worden, bevor er grün zählt
- [ ] §2: `SYS compose REQ(kinds=[non-functional])` erscheint; `MOD satisfy REQ(non-functional)`
      erscheint **nicht** (Design ≠ ConOps); `kinds=[functional]` am SYS erscheint nicht
- [ ] §3: je ACTOR die über `ACTOR io UC` getriggerten UC; ein ACTOR ohne UC-Kante
      wird gelistet, aber ohne erfundene Zuordnung
- [ ] §4: `UC compose FCHAIN compose FUNC` erscheint als Szenario mit Funktionsfolge;
      ein UC ohne FCHAIN erscheint mit explizitem „kein Betriebsablauf beschrieben"
- [ ] §5: der Modes-Abschnitt steht als ausgewiesene Lücke in der Datei (nie leer,
      nie stillschweigend weggelassen)
- [ ] §6: ein CR mit `relation` auf REQ **und** FUNC erscheint einmal, mit beiden
      Elementen gebündelt; ein CR mit ausschließlich `relation → MS` erscheint **nicht**;
      ein CR ganz ohne relation-Kanten erscheint nicht
- [ ] Empty-State je Abschnitt: Graph ohne SYS / ohne UC / ohne CR → jeweils
      expliziter Empty-State, nie eine leere Tabelle
- [ ] Determinismus (bestehender Test): zweimal rendern → byte-identisch
- [ ] grep: kein `["operational"]` mehr in `.claude/commands/`
- [ ] `npm run build` + volle Suite grün
- [ ] `node scripts/export-graph.mjs` neu gelaufen; `docs/views/conops.md` zeigt
      13 REQ, 9 ACTOR mit UC-Zuordnung, 6 UC mit ihren FCHAINs und 74 CR-Bündel

## Dateien (5)

1. `docs/cr/open/CR-GC-304-conops-operational-req-filter.md` (dieses Dokument)
2. `src/views/graphcode.ts`
3. `.claude/commands/se-conops.md`
4. `.claude/commands/se-view/conops.md`
5. `tests/exporter.test.ts`

Dazu die neu gerenderte `docs/views/conops.md` (Generat, nicht als Datei gezählt).

**Größen-Vorbehalt:** `src/views/graphcode.ts` ist heute 248 Zeilen und trägt fünf
Renderer. Die neue `renderConOps` wächst um ~80 Zeilen — damit bleibt die Datei unter
500. Wenn sie beim Implementieren darüber läuft, wird **nicht** geschummelt, sondern
`views/conops.ts` abgespalten (Muster CR-GC-260); das ist dann eine Datei mehr und
muss vorher gesagt werden.

## Nicht in diesem CR

- **Kein MODE-Elementtyp**, keine contracts-Änderung (s. „Benannte Lücke").
- `docs/records/irr.md` bleibt, wo es ist. `docs/views/*` sind deterministische
  Projektionen des Graphen (`GENERATED`-Header), `docs/records/*` sind
  commit-gestempelte Urteils-Dokumente, die `se-irr` schreibt und die **nicht** aus
  dem Graphen ableitbar sind — deshalb der andere Ordner. ConOps ist, anders als IRR,
  sehr wohl graph-abgeleitet; die Verwechslung entsteht aus der Namensgleichheit von
  `se-conops` (CREATE) und `se-view:conops` (RENDER). Der klarstellende Satz gehört
  nach `docs/views/README.md` → **CR-GC-306**.
