# Referenz-Change 2026-09-23 — warum der Graph ungenutzt blieb

**Gegenstand:** CR-GC-630 + CR-GC-631, konserviert als `rig/referenz-change/`.
**Frage:** Nicht „war der Change gut?" (er war es, VOLL gruen, −280 Zeilen), sondern
**„warum hat der Agent sein eigenes Werkzeug nicht benutzt?"**

---

## 1. Die Messung

`node rig/referenz-change/messen.mjs <sitzung>.jsonl --ab "keine parallel pfade" --bis "referenz change"`

| Kennzahl | Wert |
|---|---|
| Werkzeugaufrufe | 131, davon **126 Bash** |
| Graph-**Lese**aufrufe | **0** |
| Graph-Schreibaufrufe | 3 (ein Modell-Batch, zweimal `dryRun`) |
| Suchoperationen (Grep + Glob + Doc-Read, KPI 1 nach `docs/KPI.md`) | **27** ¹ |
| Volllaeufe `npm test` | **3** (~15 min Wanduhr) |

¹ **Korrigiert am 2026-09-24 (CR-GC-639).** Die erste Fassung nannte 45. Die Zahl ist zweimal
gesunken, weil drei Zaehlfehler herausgenommen wurden. Gezaehlt hatte sie auch:
`npm test | grep FAIL` (ein grep NACH einer Pipe filtert eine Ausgabe), Heredocs, die `grep` oder
`npm test` nur als Text enthielten, und greps ueber Log-Dateien in `/tmp`. Die eine Zaehlung in
`scripts/retro-kpi.mjs` zaehlt nur, was als Befehl gegen das Repo LAEUFT, dazu Doc-Reads
(`docs/graph/`, `docs/views/`, `.graphcode/`), wie `docs/KPI.md` es definiert: **27**. Die Aussage
hat sich dabei nie bewegt: 0 Graph-Lesezugriffe, KPI 1 = 0,11.


Das ist dasselbe Bild wie am 2026-08-27 („0 Aufrufe `graph_impact`, 174 Suchoperationen"),
dreizehn Monate und rund 250 CRs spaeter. Die Zusage steht seither unveraendert in der
`CLAUDE.md`; sie wirkt nicht.

**Was es gekostet hat** (`rig/referenz-change/gegenprobe.mjs`, gegen den Stand `d1285ef`):

| Frage | gefahren | was der Graph geantwortet haette |
|---|---|---|
| Welche Tests muss ich fahren? | 3× volle Suite, je ~5 min | **4 Dateien statt 172** |
| Was bricht, wenn `codec.ts` faellt? | zwei Volllaeufe, bis RC-01 es meldete | **20 Kanten an zwei Knoten**, darunter die zwei `satisfy` und die zwei `realRef`, die genau diesen Fehlschlag ausloesten |

---

## 2. Drei Ursachen, keine davon „der Agent war unaufmerksam"

### U1 — Die Lesewerkzeuge lagen nicht in der Hand

Die 24 `graph_*`-Werkzeuge waren in dieser Sitzung **deferred**: ihr Schema ist nicht geladen,
ein Aufruf verlangt vorher ein `ToolSearch`. `Bash` liegt immer bereit.

Gemessen: **2 `ToolSearch`-Aufrufe im ganzen Change — beide fuer `graph_mutate`**, also fuers
Schreiben, wo es keinen Ersatz gibt. Fuers Lesen gibt es einen Ersatz, er heisst `grep`, und er
kostet keinen Vorlauf. Das ist kein Vorsatz, das ist ein Gefaelle.

### U2 — Es gibt keinen Skill fuer „etwas Bestehendes aendern"

Zwoelf Skills im Repo. **Genau einer nennt `graph_impact` (`se-fmea`).** Ihre Verben:

| Anlegen | Berichten | Steuern |
|---|---|---|
| `se:author-req`, `se:author-uc`, `se:author-actor`, `se:top-level`, `se-conops`, `se-trade`, `se:generate`, `se:import-code`, `se:import-doc` | `se-status`, `se-review`, `se-retro`, `se-view:*` | `se:optimize`, `se:close-violations`, `se-plan` |

**Kein einziger deckt den Umbau ab** — aendern, ersetzen, loeschen. Dabei ist das die Lage, in
der die Hausregel „keine parallelen Pfade" ueberhaupt gilt, und die einzige, in der ein
vergessener Impact teuer wird: ein neuer Knoten bricht nichts, ein geloeschter schon.

### U3 — Die Regel steht am falschen Ort in der Zeit

Die Werkzeugtabelle steht in `CLAUDE.md`, also am Sitzungsanfang, neben allem anderen. Die
Fragen, die sie beantwortet, entstehen **200 Werkzeugaufrufe spaeter**. Es gibt keinen Anlass,
der sie in dem Moment wieder hochholt, in dem sie gebraucht wird.

Der `pre-commit`-Hook macht es richtig — er nennt die CODE-Spur genau dann, wenn committet wird.
Nur ist das zu spaet: da sind die drei Volllaeufe schon gefahren.

---

## 3. Potenziale

### A — Skill `se-umbau`: die vier Fragen als Ablauf (CR-GC-635)

Ein Skill fuer die Lage „etwas Bestehendes aendern oder entfernen", der die Reihenfolge
festlegt, die dieser Change teuer nachgeholt hat:

1. `graph_impact(<uid>)` fuer jeden Knoten am Umfang — **vor** der ersten Loeschung,
2. `graph_tests({changeSet})` fuer die Spur — statt der vollen Suite,
3. der Modell-Zug durchs Gate, im selben CR,
4. VOLL erst als Riegel.

Erwartete Wirkung, aus der Gegenprobe: 3 Volllaeufe → 1, und der RC-01-Fehlschlag faellt vor
statt nach 300 Sekunden auf. **Messbar am Rig**, nicht behauptet.

### B — Die Lesewerkzeuge greifbar machen (Item, nicht CR)

U1 ist zur Haelfte Harness-Sache (welche Werkzeuge deferred sind, entscheidet der Client). Was
im Repo liegt: die Tabelle in `CLAUDE.md` koennte die `ToolSearch`-Abfrage mitliefern, mit der
man sich die vier Werkzeuge in einem Zug holt. Das senkt die Huerde von „Werkzeug suchen" auf
„Zeile kopieren". Klein, aber es ist die Stelle, an der das Gefaelle entsteht.

### C — Die CR-Vorlage verlangt den Impact (CR-GC-636)

`aise dispatch prepare` schreibt ein CR-Geruest. Es koennte einen Abschnitt **„Umfang laut
`graph_impact`"** tragen, der leer ist, bis jemand ihn fuellt. Das trifft den richtigen
Zeitpunkt — vor der Arbeit, nicht beim Commit — und es hinterlaesst eine pruefbare Spur: ein CR
ohne diesen Abschnitt ist einer, der den Umfang geraten hat.

Grenze, ehrlich: eine Vorlage, die man ausfuellen muss, wird ausgefuellt, nicht gelesen. Deshalb
steht sie hier als C und nicht als A.

---

## 4. Was NICHT das Problem war

- **Nicht die Werkzeugqualitaet.** Die Gegenprobe zeigt: beide Antworten waren exakt, sofort
  und vollstaendig. `selectForChange` nannte 4 von 172 Dateien, der Impact alle 20 Kanten.
- **Nicht fehlende Doku.** Die Tabelle in `CLAUDE.md` ist praezise und nennt genau diese Faelle.
- **Nicht die Bindung.** 100 % der geaenderten Quelldateien waren im Modell gebunden; der Graph
  haette jederzeit antworten koennen.

Das Werkzeug war da, richtig und gebunden. Es lag nur nicht auf dem Weg.
