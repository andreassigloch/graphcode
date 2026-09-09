# CR-GC-492 — Der Descriptor-Sweep über die Testbasis

**Status:** offen · **Angelegt:** 2026-09-09 · **Ring:** 2 (Werkzeug) · **Art:** Fan-out
**Hängt an:** `CR-GC-491` (liefert `openMeasured` — hier wird es nur angewandt)
**Grundlage:** Zählung über `tests/`, 2026-09-09

---

## 1. Root Cause

Derselbe Befund wie `CR-GC-491`, eine Größenordnung breiter — und **vollkommen gleichförmig**:

```
Testdateien gesamt                       130
davon mit eigenem mkdtemp-Store          108
new KuzuAdapter(…)                       103
   davon  ontology: SE_DESCRIPTOR        103   ← alle
   davon  ontology: createSeDescriptor(…)  0   ← keine
new GraphCodeHarness(…)                   87
createHarness(…)                          14
```

**103 von 103** Store-Konstruktionen in der Testbasis übergeben den unparametrisierten
`SE_DESCRIPTOR`. Keine einzige baut ihn mit der Policy (`createSeDescriptor`), wie es
`create-harness.ts:58` und `harness.ts:145` in Produktion tun.

**Genau ein Muster, keine Varianten** — deshalb ein CR trotz 103 Fundstellen: die
Dependency-Analyse, die das 6-Dateien-Limit erzwingen soll, ist hier trivial, weil es nur eine
Abhängigkeit gibt.

## 2. Impact

**Bricht heute nichts** — `graphcode.config.jsonc` ist zeichengleich mit
`DEFAULT_METRIC_POLICY` (`CR-GC-491` §2), also urteilt der unparametrisierte Descriptor mit
denselben Schwellen.

**Bricht, sobald eine Schwelle wandert.** Und das ist kein hypothetischer Fall: `CR-SM-303` will
`boundaryWidth` senken, `CR-GC-484` T-S3 hat das Budget als **die** Stellgröße nachgewiesen. Der
Tag, an dem die Schwelle sich bewegt, ist der Tag, an dem 103 Tests etwas anderes prüfen als das,
was in Produktion läuft — **grün, und falsch.** Ein Test, der die Produktionsschwelle nicht sieht,
ist Fake-Coverage über die gesamte Regelfläche.

**Die zweite Hälfte — 87 direkte Konstruktoraufrufe — ist nicht pauschal falsch.**
`harness.ts:116` erlaubt sie ausdrücklich für Adapter-Injektions-Tests. Der Fehler ist nicht der
Konstruktor, sondern dass **nichts unterscheidet**, ob eine Datei ihn absichtlich benutzt oder
aus Gewohnheit. Deshalb ist die Regel unten eine Benennungspflicht, keine Verbotsliste.

## 3. Fix

1. **Ein Helfer, `tests/helpers/measured.mjs`**, der `openMeasured` aus `CR-GC-491` für Tests
   verpackt: Temp-Repo, optionale `graphcode.config.jsonc`, `createHarness`, Aufräumen.
2. **Mechanischer Sweep über die 103 Stellen** — `new KuzuAdapter({ ontology: SE_DESCRIPTOR, … })`
   plus zugehöriger Harness-Bau werden durch den Helfer ersetzt. Eine Ersetzung, 103-mal,
   ohne Sonderfälle.
3. **Die verbleibenden Konstruktoraufrufe benennen sich.** Wer `new GraphCodeHarness` behält,
   trägt eine Zeile *warum* (Adapter-Injektion, kein Disk-Store gewollt). Ohne Begründung greift
   der Wächter aus 4.
4. **Wächter statt Erinnerung:** ein Test, der `tests/` nach `new KuzuAdapter` durchsucht und
   fehlschlägt, sobald einer wieder `SE_DESCRIPTOR` statt `createSeDescriptor` übergibt.
   Ein Sweep ohne Wächter ist in vier Wochen zur Hälfte zurückgedreht.

### Dateien

| # | Datei | Was |
|---|---|---|
| 1 | `tests/helpers/measured.mjs` (neu) | der Helfer |
| 2 | `tests/no-hand-built-store.test.ts` (neu) | der Wächter aus Punkt 4 |
| 3 | **103 Testdateien** | eine mechanische Ersetzung je Stelle |

**Zum 6-Dateien-Limit:** Es ist hier **eine** Änderung mit 103 Fundstellen, nicht 103 Änderungen
— genau der Fan-out-Fall, den das Limit nicht meint. Die Ausnahme wird ausdrücklich getragen von:
(a) es gibt genau ein Muster (103/103 identisch), (b) der Wächter aus Punkt 4 beweist die
Vollständigkeit mechanisch, (c) die Testsuite ist der Nachweis, dass keine Ersetzung etwas
verschoben hat. **Fehlt einer der drei Belege, wird gesplittet.**

## 4. Akzeptanzkriterien

- [ ] **Rot zuerst:** der Wächter aus Punkt 4 ist vor dem Sweep rot und nennt **103** Fundstellen.
- [ ] Nach dem Sweep: `grep -rc "SE_DESCRIPTOR" tests` = 0 in Store-Konstruktionen.
- [ ] `npm test` grün, und die **Anzahl** ausgeführter Tests ist unverändert — ein Sweep, der
      Tests verschwinden lässt, hat sie nicht umgestellt, sondern gelöscht.
- [ ] Ein Test mit einer Temp-`graphcode.config.jsonc` (`boundaryWidth.warning: 2`) sieht **2**,
      nicht 5 — der Nachweis, dass die Umstellung wirkt und nicht nur kompiliert.
- [ ] Jeder verbliebene `new GraphCodeHarness` trägt eine Begründungszeile; der Wächter zählt sie.

## 5. Nicht im Scope

Inhaltliche Änderungen an einem einzigen Test. Wenn der Sweep einen Test rot macht, ist das ein
**Befund** — er bekommt einen eigenen CR und wird hier nicht mitrepariert.
