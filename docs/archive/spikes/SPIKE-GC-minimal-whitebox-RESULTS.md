# SPIKE-GC: Minimal-Whitebox — RESULTS (2026-08-18)

Rig: [`rig/minimal-whitebox/`](../../rig/minimal-whitebox/) — Arme A0/A/B deterministisch
(kein LLM), Arm C als A/B/C-Lauf gegen das residente lokale Modell. Alle Zahlen kommen aus
den **gebundenen MCP-Tools** (`graph_impact`, `graph_context`, `buildRoundInjection`); nichts
ist nachgebaut. Rohdaten: `rig/minimal-whitebox/results/`.

## Verdikt

**Die Whitebox ist keine Teilmenge des Blast-Radius — sie ist die Gegenrichtung.** `B` läuft
über **eingehende** Kanten (wer bricht), `W` über **ausgehende** (woraus ist der Job definiert).
Die Frage „welcher Anteil von `B` muss offen sein" ist damit falsch gestellt; die tragende
Antwort ist: **`W` allein reicht, und `B` reicht nicht.**

| Hypothese | Ergebnis |
|---|---|
| **H1 — `W ⊊ B`, `\|W\| ≤ 0,40·\|B\|`** | **falsifiziert.** `\|W\|/\|B\|` = 0,51 (J2a) / 0,57 (J2b); und `W` ist gar keine Teilmenge: 6 von 18 bzw. 4 von 28 Whitebox-Knoten liegen **außerhalb** des Blast-Radius. Nicht die Schwelle ist verfehlt — die Ratio misst zwei verschiedene Richtungen. |
| **H2 — Blackbox-Suffizienz** | **bestätigt, und schärfer als formuliert.** Arm B (**Ring komplett weggelassen**) enthält bereits **12/12** bzw. **16/16** der Knoten, die der Schluss-Commit tatsächlich geändert hat. Der Ring ist für die Arbeit entbehrlich; 15 von 23 bzw. 14 von 25 Ring-Knoten sind **CR-Historie**. |
| **H3 — 20-%-Deckel** | **bestätigt, mit großem Abstand.** `\|W\|/\|G\|` = **0,032** (J2a) / **0,050** (J2b) gegen die Schwelle 0,20 — bei G = 555. |
| **H4 — Autorieren ≠ Implementieren** | **bestätigt.** `graph_context` trägt den Autorier-Loop nicht: dessen Funde sind Regel-Verletzungen, kein Realisierungsknoten mit Spec-Closure. Der Autorier-Schnitt ist ein anderer (§4). |

**Arm C (Autorier-Loop, lokale Modelle) liefert kein verwertbares Ausbeute-Ergebnis:** die
Wiederholungs-Streuung einer Bedingung (35 vs. 101 Elemente) übersteigt jeden Arm-Unterschied.
Belastbar ist dort nur das Lese-Verhalten — insbesondere, dass die Präzisions-Trias praktisch
nie aufgerufen wird. Phase 1 ist davon unberührt: sie rechnet deterministisch, sie sampelt nicht.

## Der Befund, der in keiner Hypothese stand

**Der heutige Injektions-Mechanismus trifft die Knoten des Jobs nicht.**

Präzision zur Spalte „heute": ein Implementier-Job bekommt heute **gar keine** Injektion —
`buildRoundInjection` läuft nur im Executor-Autorier-Loop (Spike §3). Die Spalte ist also die
Gegenprobe *„was träfe der heutige Mechanismus, wenn er auf einen CR-großen Implementier-Job
angewandt würde"* — genau das, was CR-DRAFT-GC-361 vorhat. Der Ist-Zustand des
Implementier-Pfads ist nicht diese Zahl, sondern **kein Graph-Kontext**.

| | J2a (CR-GC-114) | J2b (CR-GC-115) |
|---|---|---|
| Knoten, die der Commit wirklich änderte | 12 | 16 |
| davon im heutigen Injektions-Mechanismus (2234 tok) | **5** | **11** |
| davon im **Blast-Radius** `B` (4354 / 6258 tok) | 9 | 16 |
| davon in der **Whitebox** `W` (1824 / 3460 tok) | **12** | **16** |

Der heutige Index ist uid-alphabetisch und wird bei 8000 Zeichen von vorn geschnitten. Bei
G = 555 und Fokus FUNC/MOD/REQ bricht er mitten in den REQ ab (letzte Zeile
`REQ-mcp-gate-symmetry`, +77 REQ verworfen) — und TEST/UC fallen schon durch den
Fokus-Typ-Filter. Genau dort liegen die verfehlten Knoten: `REQ-single-kuzu-owner`,
`TEST-real-health-check`, `REQ-readonly-bridge`, …

**2234 Token kaufen 42 % Trefferquote. 1824 Token kaufen 100 %.**

Der Blast-Radius ist ebenfalls nicht das Arbeits-Set: er verfehlt in J2a drei Knoten
(`REQ-real-health-check`, `REQ-single-kuzu-owner`, `TEST-real-health-check`) und kostet dabei
2,4× so viele Token wie `W`.

## Zahlen (Arme A0/A/B, deterministisch)

| Job | G | `\|B\|` / tok | `\|W\|` / tok | Ring / tok | Arm A | Arm B | heute |
|---|---|---|---|---|---|---|---|
| **J1** FN-slice (Kalibrierung) | 13 | 3 / 171 | 11 / **667** | 1 / 11 | 690 | 667 | 274 |
| **J2a** CR-GC-114, 4 FUNC | 555 | 35 / 4354 | 18 / 1824 | 23 / 883 | 2719 | **1824** | 2234 |
| **J2b** CR-GC-115, 8 FUNC | 555 | 49 / 6258 | 28 / 3460 | 25 / 978 | 4450 | **3460** | 2234 |

J1 reproduziert die Untergrenze aus `SPIKE-GC-context-sufficiency` **exakt** (11 Knoten,
667 tok) — der Messaufbau ist kalibriert. Dass dort `\|W\| > \|B\|` ist, ist kein Ausreißer,
sondern derselbe Richtungsbefund im Kleinen: ein unrealisierter FUNC hat fast keine
Dependents und eine volle Spec-Closure.

**Ground Truth** = die Knoten, die der jeweilige Schluss-Commit im SSOT-Graphen tatsächlich
verändert hat (git-Diff von `docs/graph/graphcode.graph.json` über den Commit), nicht eine
Schätzung. Seeds = die `relation`-Ziele des **offenen** CR, im Graphen vor dem Commit
nachweisbar vorhanden.

## Arm B schlägt Arm A — der Ring ist Ballast

Der Falsifikations-Arm gewinnt: **ohne** Blackbox-Ring ist die Trefferquote identisch
(12/12, 16/16) und der Kontext um 33 % (J2a) bzw. 22 % (J2b) kleiner. Der Ring besteht
zu ~60 % aus CR-Knoten — Governance-Historie, die beantwortet „wer hat das mal angefasst",
nicht „woraus ist der Job definiert".

Das ist keine Absage an den Ring, sondern seine Verortung: er ist die **Benachrichtigungs**-
Liste (Sicherheitsbegriff), nicht das Arbeitsmaterial. Wer ihn injiziert, zahlt Token für
eine Frage, die der Job nicht stellt.

## H4 — der Autorier-Schnitt ist ein anderer

Gemessen gegen den **echten** `graph_generate`-Schritt (Phase `expand`), Fund-Elemente aus
dem Prompt, `buildRoundInjection` als Baseline:

| Fixture | G | Fokus | heute | Arm A (Funde + 1-Ring tief) | Arm A1 (nur Funde tief) |
|---|---|---|---|---|---|
| greenfield lokal (devstral v9) | 38 | FUNC/MOD | 635 tok · Deckung 1,00 | 368 tok · 1,00 | **215 tok · 1,00** |
| greenfield frontier (opus5) | 57 | FUNC/MOD | 1068 tok · 1,00 | 816 tok · 1,00 | **358 tok · 1,00** |
| reifes Modell (graphcode) | 555 | MS/CR | 2167 tok · **0,71** | 6850 tok · 1,00 | 2940 tok · **1,00** |

Zwei Dinge folgen:

1. **Bei Greenfield-Größe ist die heutige Injektion nicht kaputt, sondern nur ungerichtet.**
   Sie deckt 100 % der Fokus-Knoten ab — der 8000-Zeichen-Schnitt greift bei 38 Knoten nie.
   Der Whitebox-Schnitt liefert dieselbe Deckung für **ein Drittel** der Token.
2. **Der Duplikat-Schutz ist der teure Teil, nicht die Tiefe.** Bei G = 555 kostet die
   vollständige Identitätsliste der Fokus-Typen (170 MS/CR) ~2,9k Token — mehr als der
   heutige gekappte Index, dafür mit voller statt 71 % Deckung. Der 1-Ring in voller Tiefe
   (Arm A) ist bei einem Hub-Knoten wie `SYS-graphcode` mit 6850 Token nicht bezahlbar:
   **für den Autorier-Loop gilt Arm A1 — Funde tief, alles andere nur als Identität.**

Diese Rechnung sagt, **wie** ein Autorier-Schnitt aussähe, wenn man injiziert. Arm C sagt,
**ob** man es sollte — und für ein lokales Modell lautet die Antwort nein: dort kostet jede
Injektion Ausbeute, der präzise Schnitt eingeschlossen. Die Token-Ersparnis dieser Tabelle ist
also erst dann eine Empfehlung, wenn der Host sie verträgt (Frontier, CR-GC-285).

## Arm C — Executor-Runde mit `W` statt `graph_elements({})`

**Arm C beantwortet seine Frage nicht. Die Streuung des Rigs ist größer als jeder gemessene
Arm-Unterschied.** Zwei Läufe **derselben** Bedingung (devstral `pull`, `reasoning_effort` bei
devstral nachweislich inert — `tokensReasoning: 0` in beiden) liefern **101** und **35**
Elemente. Damit ist bei N = 1 keine der Ausbeute-Differenzen zwischen den Armen interpretierbar.

| Modell | Arm | El | Tr | REQ/TEST | Wall | Turns | `context` | `impact` | `expand` | `elements` | `guide` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| devstral | off | 19 | 30 | 0/0 | 167 min | 107 | – | – | – | 30 | 86 |
| devstral | full | 27 | 78 | 0/0 | 67 min | 89 | – | – | – | 2 | 71 |
| devstral | whitebox | 28 | 49 | 0/0 | 36 min | 88 | – | – | – | 3 | 95 |
| devstral | pull #1 | **101** | 136 | 9/9 | 75 min | 101 | 0 | 0 | 0 | 32 | 113 |
| devstral | pull #2 | **35** | 46 | 3/3 | 51 min | 105 | 0 | 0 | 0 | 23 | 92 |
| qwen3.6-35b | off | 87 | 99 | 22/22 | 30 min | 113 | 0 | 0 | 0 | 70 | 77 |
| qwen3.6-35b | full | 46 | 70 | 3/3 | 59 min | 51 | 0 | 0 | 0 | 0 | 3 |
| qwen3.6-35b | whitebox | 40 | 52 | 0/0 | 45 min | 50 | 0 | 0 | 0 | 1 | 4 |
| qwen3.6-35b | pull | 43 | 56 | 5/5 | 36 min | 108 | 0 | **4** | 0 | 58 | 73 |

Die devstral-Arme spannen 19 · 27 · 28 · 35 · 101 — Minimum und Maximum liegen **innerhalb**
einer Bedingung. Auch die qwen-Seite hat den Beleg: dieselbe `off`-Konfiguration lieferte
publiziert 53 und hier 87. Was in einer früheren Fassung dieses Dokuments als Befund stand
(„Injektion schadet qwen, nützt devstral", „whitebox ist devstrals bester Arm"), ist damit
**zurückgezogen** — es war Rauschen, gelesen als Signal.

### Was trotzdem trägt: das Lese-Verhalten

Die Tool-Nutzung ist innerhalb eines Modells über alle Arme stabil, die Unterschiede sind
groß und gleichgerichtet — anders als die Ausbeute:

- **Die Trias wird nicht benutzt.** `graph_context` **0×**, `graph_expand` **0×**,
  `graph_impact` **4×** — bei über 400 Modell-Tool-Calls in den pull-Armen, mit allen drei
  Werkzeugen im Angebot. Ein Whitebox-*Request* wird nicht abgerufen, nur weil es ihn gibt.
- **Breitlesen geht dadurch nicht zurück** (devstral `graph_elements` 30 → 32/23, qwen 70 → 58);
  was beide Modelle stattdessen fahren, ist `graph_authoring_guide` (73–113×).
- **Gehorsam trennt die Modelle.** Die Injektions-Zeile „bereits eingebettet — nicht erneut
  aufrufen" befolgt qwen (guide 3/4 mit Injektion gegen 77/73 ohne), devstral ignoriert sie
  (71/95/86/113/92 in **jedem** Arm).

Zähl-Hinweis: devstral emittiert Tool-Calls teils als Text, den der Executor zurückgewinnt
(`recovered text tool-call`); wer nur strukturierte Calls zählt, unterschätzt ihn um bis zu
24 %. Der Rig-Zähler `modelUnfilteredCalls` ist für Modell-Verhalten unbrauchbar (zählt
executor-interne Preflight-Snapshots) — kanonisch ist das Trace-Tally (`tally-toolcalls.mjs`).
Ein aus Prosa zurückgewonnenes `graph_mutate` tracet gar nichts; für Mutationen gilt
`stats.mutatesApplied`.

### Was Arm C damit kostet — und was es bräuchte

Der Spike hatte Arm C als Entscheider für **CR-GC-297** gesetzt. Das kann er nicht leisten:
die Frage „kostet Injektion lokal Ausbeute" braucht bei dieser Streuung **N ≥ 5 pro Arm**.
Bei 36–167 min pro Lauf sind das 15–40 h Rechenzeit für einen Dreiarm-Vergleich auf einem
Modell. Bezahlbar wird das nur über einen **endpunktnäheren, streuungsärmeren Messwert** als
„Elemente pro Lauf" — das Lese-Verhalten oben ist ein Kandidat, weil es genau diese
Eigenschaft zeigt. Der Spike liefert dafür den Rig, nicht die Antwort.

## Typ-Ökonomie — brauchen wir alle Elementtypen im Slice?

Nachgemessen (`run-typediet.mjs`), weil die Ring-Zusammensetzung die Frage aufwirft:

| Typ | Knoten | Text | Anteil | ø Beschreibung |
|---|---|---|---|---|
| **CR** | 163 | 30 671 tok | **59,8 %** | **691 Zeichen** |
| REQ | 125 | 7 290 tok | 14,2 % | 172 |
| FUNC | 82 | 4 336 tok | 8,5 % | 170 |
| TEST | 71 | 4 167 tok | 8,1 % | 184 |
| alle übrigen | 114 | 4 784 tok | 9,3 % | 86–206 |

CR stellt 29 % der Knoten, aber **60 % des Graph-Textes** — die mittlere CR-Beschreibung ist
viermal so lang wie die jedes anderen Typs. Die maschinenlesbaren CR-Attribute sind dabei
fast leer: `files` 5/163, `commitRef` 30/163, `rationale` 1/163. Der Inhalt ist Prosa, die
`docs/cr/**.md` und die Code-Kommentare ohnehin tragen.

**Diät-Test** (CR + MS raus aus Seeds, `W` und `B`):

| | J2a | J2b |
|---|---|---|
| `W` voll → Diät (Knoten) | 18 → 16 | 28 → 26 |
| `W` voll → Diät (tok) | 1824 → **1640** | 3460 → **3230** |
| Trefferquote | **12/12 → 12/12** | **16/16 → 16/16** |
| `B` voll → Diät (tok) | 4354 → **1932** | 6258 → **4200** |

**Die Whitebox ist bereits fast CR-frei** — `graph_context` folgt keiner `relation`-Kante von
einem CR aus, CR/MS kommen nur über die Seeds herein. Die CR-Last trifft den **Blast-Radius**
(−56 % / −33 % Token, wenn CR/MS fallen) und jeden Voll-Index, nicht den Arbeitsschnitt.

Konsequenz: **keine Typ-Diät in der Ontologie** (Drift-Lock L1/L2, Spike §10), sondern
**Rollenklassen je Job-Art als Query-Regel**:

- **Implementier-Slice:** REQ/TEST/FUNC/FLOW/SCHEMA/MOD/UC offen · CR/MS **gar nicht** ·
  SYS/ACTOR/FCHAIN nur Identität.
- **Autorier-/Planungs-Slice:** dreht sich um — dort sind CR/MS das Material (gemessen: der
  `graph_generate`-Schritt auf dem reifen Modell fokussiert MS/CR).

Nicht entscheidbar aus diesem Spike: ob die 154 **abgeschlossenen** CR-Knoten im Live-Graphen
bleiben müssen. Dagegen spricht ihr Textgewicht; dafür sprechen zwei Renderer, die sie lesen —
Change Log (`src/views/graphcode.ts`) und Impl-Plan (`src/views/incose.ts`, MS × CR). Ein
Auslagern setzt voraus, dass beide auf eine Projektion umgestellt werden; das ist ein eigener
CR, keine Nebenwirkung dieses Spikes.

## Artefakt (§8)

Jeder Arm liefert **ein** Slice-Objekt mit Rollenspalte je Knoten
(`seed | whitebox | blackbox`): `results/slice-J1.json`, `slice-J2a.json`, `slice-J2b.json`.
Blackbox-Knoten tragen Identität + Vertrag, **keine** Beschreibung — der Schnitt ist im
Artefakt materialisiert, nicht bloß im Renderer gemeint. Kanten nur, wenn beide Enden im
Slice liegen.

## Nebenbefund (nicht gesucht)

Die Juni-Snapshots von `docs/graph/graphcode.graph.json` **laden unter der heutigen
SE-Ontologie nicht mehr**: 8× `REQ -allocate-> MOD`, heute kein legales `TRACE_PATTERN`
(Kuzu-Binder bricht beim Import). Historische Graph-Stände sind damit nicht ohne Migration
reproduzierbar. Deshalb wurde J2a/J2b auf dem **heutigen** Graphen (G = 555) gemessen —
Seeds und Ground Truth sind uid-stabil und existieren dort unverändert.

## Was das für die gesperrten CRs heißt (§9)

Die Scheibe, gegen die gebaut wird, ist damit definiert:

- **CR-DRAFT-GC-361 (Hook-Injektion)** — Seed = der Job-Knoten, Slice = `graph_context`-Closure
  (Arm B), **ohne** Blackbox-Ring. Größe für einen CR-großen Job: 1,8–3,5k Token. Zwei Warnungen
  aus Arm C: (a) für den Autorier-Loop ist über Injektion nichts entschieden, (b) ein Slice, den
  das Modell selbst abrufen soll, wird **nicht** abgerufen — 4 Trias-Aufrufe in >400 Calls. Wenn
  der Slice wirken soll, muss er im Kontext liegen, nicht im Werkzeugkasten.
- **CR-DRAFT-GC-362 (Token-Budget-Context)** — die Budget-Zahl steht: ein CR-großer Job
  braucht 1824–3460 Token bei 100 % Trefferquote; der heutige Kontext kostet 2234 bei 42 %.
  Das Budget steuert die **Traversierung**, nicht eine Nachkompression.
- **CR-DRAFT-GC-365 (GVE zeigt Agent-Slice)** — Format liegt vor (`slice-*.json`). GVE rechnet
  nicht nach, es rendert die Rollenspalte.
- **CR-GC-297 (Injektions-Default backend-abhängig)** — **bleibt gesperrt; Arm C kann nicht
  entscheiden.** Weder „Injektion kostet lokal Ausbeute" noch das Gegenteil ist bei dieser
  Streuung belegt. Wer 297 aufmachen will, braucht N ≥ 5 pro Arm oder einen streuungsärmeren
  Messwert — nicht noch einen Einzellauf.
- **CR-DRAFT-GC-363 (Freshness-Banner)** — nur wegen Datei-Kollision mitgesperrt; kein
  Ergebnis dieses Spikes betrifft ihn.

## Grenzen (ehrlich)

- Phase 1 misst **Struktur-Deckung** (enthält der Schnitt die Knoten, die der Job wirklich
  geändert hat), nicht Modell-Erfolg. Dass ein Modell aus `W` auch tatsächlich korrekt
  implementiert, ist für **eine** Node in `SPIKE-GC-context-sufficiency` belegt (5/5,
  ausgeführt, recall 1.0), für CR-Größe nicht.
- Zwei CR-Jobs (J2a/J2b), beide aus MS-4, beide Viewer-nah. Kein Beleg, dass die 3,2–5 %
  `W/G` über andere Milestone-Zuschnitte hält.
- Token = Zeichen/4. Für Vergleiche innerhalb dieser Tabelle konsistent, kein Tokenizer-Wert.
- Ground Truth ist der **Graph**-Diff des Schluss-Commits, nicht der Code-Diff. Ein Knoten,
  dessen Code sich änderte ohne dass der Graph-Eintrag sich bewegte, ist nicht erfasst.
- **Die Ground Truth ist die Änderungs-, nicht die Lese-Menge.** Wer einen Job tut, muss mehr
  lesen als er ändert (das SCHEMA, dem er entsprechen muss; die REQ, die ihn einschränkt).
  `GT ⊆ W` belegt deshalb: `W` **verfehlt nichts, was geändert werden musste** — es belegt
  nicht, dass `W` alles enthält, was gelesen werden musste. Für die Lese-Menge spricht die
  Konstruktion (`W` ist genau die Closure dessen, was den Job definiert) und der Ende-zu-Ende-
  Beleg aus `SPIKE-GC-context-sufficiency` — dort erfüllte ein 27B-Modell 5/5 Akzeptanz-
  kriterien allein aus dem 667-tok-Bundle. Für CR-Größe ist dieser Beleg offen.
