# CR-GC-308 — View-Exporter lesen nur, was Ontologie und Regeln deklarieren

**Status:** done · **Angelegt:** 2026-08-07 · **Geschlossen:** 2026-08-08 · **Max Files:** 6

> ## Abschluss 2026-08-08
>
> Alle vier Befunde behoben, **77 Testdateien / 536 Tests grün**.
>
> ### AP-Spalte: ersatzlos gestrichen, wie im CR vorgesehen
>
> **CR-SM-229 ist nicht publiziert** — `actionPriority()`/`apMethod()` existieren in
> `@sigloch/contracts/se` nicht (verifiziert, nicht angenommen). Damit greift die
> Abgrenzung: die erfundene `S >= 8 ? 'High'`-Logik ist weg, eine AP-Spalte kommt
> nicht. **Stattdessen `RPN = S·O·D`** — nicht als Ersatz-Klassifikation, sondern weil
> das exakt die Zahl ist, auf die `FM-03` seine >100-Schwelle legt. Sie kommt aus der
> Regel, nicht aus dieser Datei. Eine zweite hauseigene Klassifikation für einen
> sicherheitsrelevanten Sachverhalt wäre schlimmer als keine Spalte.
>
> ### Beleg, dass Punkt 3 wirklich toter Code war
>
> `implplan.md` und `changelog.md` sind nach dem Entfernen des `MS -compose-> CR`-Zweigs
> **byte-identisch** zu vorher. Der legale `relation`-Zweig trug sie die ganze Zeit —
> genau die Behauptung des CRs, jetzt gemessen statt vermutet.
>
> ### Kern-AC nachgewiesen
>
> Der Conformance-Test wurde **rot gesehen**: `renderFmea` testweise auf `relation`
> zurückgebaut → „fills the mitigation column from the compose edge FM-02 prescribes"
> schlägt fehl; zurückgerollt → 12/12 grün. Der Wächter greift.
>
> ### Zwei Test-Design-Korrekturen unterwegs
>
> 1. Die Grep-Tests trafen zunächst **meine eigenen Kommentare**, die die alte, falsche
>    Schreibweise zitieren, um sie zu erklären. Sie strippen jetzt Kommentare — die
>    Erklärung zu löschen, nur damit ein Grep durchgeht, wäre der falsche Weg herum.
> 2. Der MS→CR-Test war erst ein Source-Grep. Der ist brüchig (genau deshalb blieb der
>    tote Zweig jahrelang unentdeckt) und prüft jetzt **Verhalten**: ein Graph, der nur
>    illegal verdrahtet ist, darf in keiner View einen CR unter dem Milestone zeigen —
>    und ein Gegentest belegt, dass die legale Kante ihn weiterhin auflöst. Dabei fiel
>    auf: im Changelog erscheint so ein CR korrekt unter „(unassigned)". Ihn ganz zu
>    unterdrücken wäre der Fehler in die Gegenrichtung gewesen.
>
> ### Skills auf v2 — dort saß die Wurzel
>
> `se-fmea.md` nennt jetzt eine **Attribut-Tabelle** (`severity`/`occurrence`/
> `detection` → welche Regel sie liest), die Mitigations-Kante ausdrücklich als
> `compose` (mit dem Hinweis, dass `relation` zwischen zwei REQs von R-18 abgelehnt
> wird), und `testResult: "passed"` für FM-03. Plus die Ansage, **kein** AP-Feld in den
> Graphen zu schreiben. `se-trade.md` schreibt `attributes.label` statt `role`.
>
> ### Ehrlicher Rest
>
> Die AC „Skill-Ausgabe → View, **end-to-end**" ist als zwei gekoppelte Tests
> umgesetzt: der Skill-Text enthält `attributes.label`, und ein so verdrahteter Graph
> rendert in `trade.md`. Ein echter End-to-End-Lauf würde bedeuten, den Skill
> auszuführen — das ist kein Unit-Test-Scope. Die Kopplung ist dadurch abgesichert,
> dass beide Seiten denselben String prüfen.
**Herkunft:** graphcode-Feldtest Graphview (`docs/GC_test-graphview-results.md` §6.2/§6.3/§6.7),
Code-Audit 2026-08-07.
**Abhängigkeiten:** nach CR-GC-304 (fasst `src/views/graphcode.ts` an, ConOps-Teil) ·
AP-Spalte nach **CR-SM-229** publiziert.

## Problem

Vier Exporter-Stellen lesen Kanten oder Attribute, die die Ontologie so nicht kennt. Der Graph
ist dabei jedes Mal regelkonform — die View bleibt trotzdem leer. Das ist die Fehlerklasse
„compliance 1.0 bei leerer View", die der Feldtest als wichtigste Einzelerkenntnis nennt.

### 1. FMEA-View widerspricht den contracts-FMEA-Regeln in jedem Punkt

`FM-01`/`FM-02`/`FM-03` in `@sigloch/contracts/se` spezifizieren das FMEA-Modell vollständig und
laufen aktiv in `evaluateAllRules`. `renderFmea` (`src/views/graphcode.ts:83-123`) liest etwas
anderes:

| Regel sagt | Exporter tut |
|---|---|
| `attributes.severity` / `occurrence` / `detection` (FM-01) | `attributes['S']` / `['O']` / `['D']` |
| Mitigation = `compose` → REQ[`kinds` ∋ `mitigation`] (FM-02, wörtlich inkl. `fix_hint`) | `relation` → `REQ-*` |
| Verifikation = `verify` **mit** `testResult === 'passed'` (FM-03) | nur Existenz einer verify-Kante |
| AP-Klassifikation (FM-03 nach CR-SM-229) | `S >= 8 ? 'High' : S >= 4 ? 'Med' : 'Low'` |

Die Mitigation-Spalte ist dabei **strukturell unbefüllbar**: `TRACE_PATTERNS` kennt kein
`REQ -relation-> REQ`, nur `REQ -compose-> REQ` („incl. mitigation"). `R-18` wertet die relation
als Error. Im Feldtest blieb die Spalte in allen 16 Zeilen leer.

Beides gleichzeitig geht heute nicht: mit `S`/`O`/`D` rendert die View und **FM-01 feuert auf
jedem Risiko-REQ**; mit `severity`/`occurrence`/`detection` ist FM-01 sauber und die View zeigt `—`.

**Wurzel:** `.claude/commands/se-fmea.md` benennt S/O/D nur als Spaltenüberschriften des
Markdown-Records und sagt nirgends, welche Graph-Attribute zu schreiben sind. Das Modell hat
`S`/`O`/`D` erfunden, der Exporter liest dieselbe Erfindung — beide gemeinsam von contracts
weggedriftet, deshalb symptomlos.

### 2. Trade-View: Skill schreibt `role`, Exporter liest `label`

`.claude/commands/se-trade.md:17-18` weist `attributes.role` an, `renderTrade`
(`src/views/graphcode.ts:169`) filtert auf `attributes['label']`. Wer dem Skill wörtlich folgt,
erzeugt eine Entscheidung, die im Graphen steht und in der View unsichtbar bleibt.

`label` gewinnt: `TRACE_PATTERNS` deklariert `label` bereits bei `MS -relation-> MS[depends-on]`
— das ist die Familien-Konvention, `role` die Erfindung. Der Skill wird angepasst, nicht der
Exporter (keine Dual-Reads, keine parallelen Pfade).

### 3. `MS -compose-> CR` existiert nicht

Drei Stellen walken es: `src/views/graphcode.ts:27`, `:210`, `src/views/incose.ts:308`. Legal ist
`MS -compose-> FUNC/REQ/UC/MS`; CR hängen über `CR -relation-> MS` an der Milestone. Symptomlos,
weil der legale relation-Zweig danebensteht und die Union das Loch füllt — also toter Code. Der
Kommentar `src/views/incose.ts:306` behauptet zusätzlich *„MS compose → CR also exists"*; das ist
falsch und war die Quelle des Missverständnisses.

### 4. Kein Schutz gegen die Wiederholung

Alle vier Befunde sind derselbe Fehler und keiner wurde von einem Test gefangen. `srs.ts` und
`incose.ts` (bis auf Punkt 3) sind sauber — sie lesen ausschließlich deklarierte Kanten, und
`srs.md` ist deshalb die einzige View, die vollständig durchrendert.

## Architektur-Entscheidung

> **Eine View liest genau das, was die Regeln lesen** — dieselben Kanten *und* dieselben
> Attributschlüssel. Wo eine Regel den Sachverhalt bereits prüft, ist sie die Quelle; die View
> rendert ihn nur.

Keine Ontologie-Erweiterung nötig: für alle vier Punkte existiert die legale Form bereits.

## Scope (≤ 6 Dateien)

1. `src/views/graphcode.ts` — `renderFmea` auf FM-01/02/03-Schlüssel (`severity`/`occurrence`/
   `detection`, Mitigation über `compose` → REQ[`kinds` ∋ `mitigation`], verify **+**
   `testResult === 'passed'`), AP-Spalte über den contracts-Import; `renderTrade` auf `label`;
   toter `MS -compose-> CR`-Zweig raus
2. `src/views/incose.ts` — toter compose-Zweig + falscher Kommentar raus
3. `.claude/commands/se-fmea.md` — Graph-Attributnamen explizit: `severity`/`occurrence`/
   `detection` (1-10), `kinds: ["risk"]` bzw. `["mitigation"]`, Mitigation-Kante `compose`
4. `.claude/commands/se-trade.md` — `attributes.role` → `attributes.label`
5. `tests/views.conformance.test.ts` — neu: jeder von einem Exporter gelaufene Kantentyp ist für
   das gelesene Knotenpaar in `TRACE_PATTERNS` deklariert; jeder gelesene Attributschlüssel ist
   deklariert oder dokumentiert
6. `tests/views.test.ts` — FMEA/Trade-Renderassertions auf die neuen Schlüssel

## Akzeptanzkriterien

- [ ] Ein Graph mit Risiko-REQ (`severity`/`occurrence`/`detection` gesetzt) + `compose` →
      Mitigations-REQ rendert eine **gefüllte** Mitigation-Spalte; `FM-01` feuert dabei nicht
- [ ] Verify-Spalte unterscheidet „Test vorhanden" von „Test bestanden" (`testResult === 'passed'`)
- [ ] Ein per `se-trade` erzeugter Beschluss erscheint in `trade.md` (Skill-Ausgabe → View,
      end-to-end, nicht nur Unit)
- [ ] `grep -c "compose" src/views/*.ts` enthält keine MS→CR-Stelle mehr; `implplan.md` und
      `changelog.md` rendern unverändert (der legale relation-Zweig trug sie schon)
- [ ] Der Conformance-Test aus Datei 5 schlägt fehl, wenn man `relation` in `renderFmea`
      zurückbaut — **rot gesehen, bevor er grün zählt** (se-test)
- [ ] `npm test && npm run build` grün

## Abgrenzung

- **AP-Spalte:** die Klassifikation kommt aus `actionPriority()`/`apMethod()` in
  `@sigloch/contracts/se` (CR-SM-229) — keine lokale Formel, kein zweiter Pfad. Solange
  `apMethod()` `'rpn-interim'` liefert, rendert die Spalte als `AP*` mit **generierter**
  Fußnote; der Hinweis wird nicht als Prosa geschrieben, damit er nicht von der Berechnung
  abweichen kann. Landet CR-SM-229 nicht rechtzeitig, entfällt die AP-Spalte in diesem CR
  ersatzlos — die erfundene `S >= 8`-Logik wird in jedem Fall entfernt.
- **Attribut-Vertrag im Gate prüfen** (`ELEMENT_ATTRIBUTES` gegen `node.attributes`) ist
  CR-GC-310, nicht hier.
- **`kinds` / `level` / Kanten-Attribute in `ELEMENT_ATTRIBUTES` deklarieren** ist ein
  contracts-Bump (Familie-Review), nicht hier.
- **ConOps-`operational`-Filter** gehört zu CR-GC-304 (gleiche Datei — deshalb die Reihenfolge).
