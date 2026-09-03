# CR-GC-466 — Spike: Der Repository-Stil, gemessen statt behauptet

**Status:** ABGESCHLOSSEN (Spike, 2026-09-03) — Ergebnis-Nachtrag unten; der produktive Graph ist unverändert (SHA im Test asserted)
**Angelegt:** 2026-09-03 · **Herkunft:** Bottom-up-Entwurf gegen die Doktrin (Session 2026-09-03,
graph-view-edit), Fortsetzung von CR-DRAFT-GC-460/461 und CR-SM-279
**Vorgänger im Muster:** CR-GC-436 (Trockenübung, Kill-Kriterien, temp-Store gate-hart)

## Die These, die der Spike prüft

graphcode ist ein System im **Repository-Stil**: ein governter Zustand, ein Gate, viele Leser.
In diesem Stil ist die Nabe die Architektur — was CR-461 bereits gemessen hat (drei Gate-Flüsse
tragen 17 von 34 Grenzüberschreitungen). Die These geht einen Schritt weiter: **wenn der Stil
benannt ist, folgt daraus ableitbar, welche Flüsse architektonisch sind** — und CR-SM-279 braucht
dafür kein neues Attribut, sondern liest den Gate-Block.

Zwei Modell-Befunde, die derselbe Stil verlangt und die vor dem Spike feststehen:

1. **`Graph-State` hat 17 Produzenten** (`metrics()`, `encode()`, `moduleMetrics()`,
   `computeFitAdvisory()` — Leser, als Schreiber modelliert). Unter L1 hat der Zustand genau
   einen Produzentenblock. **Im Code stimmt es:** Kuzu-Schreibstatements existieren nur in
   `kernel/harness.ts` und `kernel/merge.ts`; `seedFromJson`/`reseed`/`replayBranchLog` sind
   Kernel-Methoden, die `surface` nur aufruft. Der Code ist ein-Schreiber, das Modell nicht.
2. **Der Kern kennt seine Klienten** — im Code, nicht im Modell: `kernel → projections` (5),
   `kernel → surface` (1), `kernel → index` (1). 17 gerichtete Modul-Kopplungen, 14 in Zyklen.
   Das ist das eigentliche Architekturdefizit; das Mesh im Bild ist die Signatur des Stils.

## Schon gemessen (2026-09-03, `metrics(G, {layer:'arch'})`, se-engine link-mode, SSOT unverändert)

| Variante | modif | faultT | flowEff | **coher** | viab | scal | Δ·w |
|---|---:|---:|---:|---:|---:|---:|---:|
| heute | 2,899 | 5,000 | 0,829 | **3,730** | 4,975 | 4,015 | — |
| ohne `Graph-State` | 2,967 | 5,000 | 0,754 | 3,763 | 4,975 | 4,199 | −0,034 |
| ohne die 3 Gate-Flüsse | 3,170 | 5,000 | 0,609 | **3,954** | 4,925 | 4,334 | +0,052 |
| ohne 19 Strukturblöcke (CR-460 A, wörtlich) | 2,789 | 5,000 | **0,119** | 3,581 | 4,973 | 3,808 | **−0,393** |

Drei Lesarten, alle ehrlich:

- **Die Nabe kostet `coherence` 0,22.** Messbar, aber kein Stil-Blindflug: die Hypothese „das
  Gewicht 1,0 misst den Stil statt der Qualität" ist in ihrer starken Form **falsch**. Das
  Zielprofil trägt den Stil schon (`scalability −0,2`, Anker `kernel-hub-fuenf-vertraege`);
  die Gewichte müssen dafür nicht angefasst werden.
- **CR-460 Option A ist so nicht umsetzbar.** `layer:'arch'` behält `compose`- und
  `allocate`-Kanten (`layer.ts:28`: alle Traces zwischen ARCH_TYPES). Ein Strukturblock ist
  deshalb **kein** „Knoten ohne Nachbarn" — er trägt die `compose`-Pfade des Waldes. Entfernt man
  ihn samt Kanten, fragmentiert der Wald: `flowEfficiency` 0,83 → 0,12. Die Mechanik-Erklärung in
  CR-460 („Knoten ohne io = Knoten ohne Nachbarn") stimmt nicht; der Coherence-Effekt entsteht,
  weil `compose`-Kanten die erkannten Communities kreuzen.
- **`faultTolerance` steht auf 5,000 — gesättigt.** Die Dimension ist für diesen Graphen
  informationslos (Gewicht ist 0, also folgenlos — aber zitierfähig ist sie nicht).

## Was der Spike misst

**M1 — Graph-State auf einen Produzenten**, gate-hart im temp-Store (Rig aus CR-GC-436:
`mkdtempSync`, eigener Disk-Kuzu, SHA-256 des SSOT vorher = nachher asserted). Die 16 falschen
`→ Graph-State`-Kanten werden zu `← Graph-Snapshot` bzw. entfallen, wo die Funktion gar nicht
liest. Gemessen: ℝ⁶-Vektor, CR-01-Grenzen, `graph_suggest`-Top-5 vorher/nachher.

**M2 — `architectural` ableiten statt setzen.** Menge A = Flüsse, die am Gate-FUNC hängen
(`mutate(commands)` und seine `io`-Nachbarn). Vergleich mit den drei in CR-461 benannten Flüssen.
Sind die Mengen gleich, beantwortet das CR-SM-279 Punkt 4 (Missbrauch): das Attribut ist lesbar,
nicht behauptbar — die Doktrin des Repos („projection, not edge") auf seine eigene Messung
angewandt. Sind sie ungleich, bleibt Option A aus CR-SM-279 nötig, mit der Differenzmenge als
Begründung.

**M3 — CR-460 korrigiert.** Zwei Varianten gegen die wörtliche Option A: (a) Strukturknoten
ausschließen, ihre `compose`-Pfade aber **durchziehen** (Kinder direkt an den Elternpfad);
(b) Option B — je Ebene messen (Wurzelprojektion und Blattebene getrennt ausweisen). Gemessen:
derselbe Vektor, plus der CR-459-Zug (Ebene einziehen) als Testfall — er muss nach der Korrektur
**nicht mehr negativ** ranken.

## Kill-Kriterien

- **M1 bewegt weder Vektor (|Δ·w| < 0,05) noch CR-01 noch das Ranking** ⇒ die Korrektur ist
  Modellhygiene ohne Steuerungswert. Sie wird trotzdem gemacht (das Modell lügt über den
  Schreiber), aber als Pflege-CR ohne Architektur-Claim — nicht als „Aufräumung".
- **M2: Menge A ≠ die 3 Flüsse** ⇒ Ableitung reicht nicht, CR-SM-279 braucht das Attribut.
  Ehrliches Ergebnis, kein Workaround.
- **M3: keine der beiden Varianten macht den CR-459-Zug positiv** ⇒ CR-460 ist kein Metrik-,
  sondern ein Konzept-CR (welche Ebene misst der Vektor überhaupt?) und geht so an die Familie.

## Ausdrücklich nicht

- **Kein Modulumbau, kein Umhängen** — CR-461 bleibt. Der Modulschnitt ist der
  Abhängigkeitsbaum, der Story-Schnitt der Wertbaum; sie *sollen* verschieden sein.
- **Keine Code-Änderung.** Die Entzyklisierung des Codes (14 invertierte Importe in drei
  Gruppen, 16 Tool-Interface-Typimporte, 7 Barrel-Importe) ist ein eigener Strang und für
  den Vektor **unsichtbar** — `layer:'arch'` kennt keine Import-Kanten. Wer nach der
  Entzyklisierung eine Fitness-Bewegung erwartet, misst das Falsche.
- **Keine Änderung am Target-Konzept.** Gewichte und Werte reichen, um den Stil zu tragen;
  der Spike ändert `.graphcode/target-profile.json` nicht.

## Dateien (≤ 3)

1. `tests/repository-style.spike.test.ts` — Rig + M1–M3, SSOT-SHA asserted
2. `scripts/spike-repository-style.mjs` — Ablation und Ableitung, nachvollziehbar ohne Kuzu
3. dieser CR (Ergebnis-Nachtrag)

## Entscheidung, die dieser Draft festhält

Der **Stil wird benannt**, bevor die nächste Metrik-Diskussion beginnt — ein Satz in `CLAUDE.md`
unter „Locked constraints": *Repository-Stil — ein Zustand, ein Gate, der Kern kennt keine
Klienten.* Ob daraus ein ableitbares `architectural` folgt, sagt M2.

---

# Ergebnis-Nachtrag (2026-09-03)

Rig: `tests/repository-style.spike.test.ts` (Temp-Kuzu, Korrektur durch den `graph_mutate`-Tool-
Handler, SSOT-SHA vorher = nachher asserted). M2/M3 ohne Kuzu: `scripts/spike-repository-style.mjs`.

## M1 — Graph-State auf einen Produzentenblock

8 der 17 Produzenten sind Leser oder Aufrufer (`decode`, `graph-export-snapshot`, `nd-similarity`,
`rewind`, `session-shutdown`, `own-kuzu-host`, `migrate-schema` ohne Code, `ACTOR-owner`); ihre
Produzenten-Kanten fallen, Konsumenten-Kanten bleiben. 17 → **9** Produzenten, alle in
`kernel/harness.ts`, `merge.ts`, `harness-import.ts` — das Modell sagt jetzt, was der Code tut.

| | modif | faultT | flowEff | coher | viab | scal | CR-01 Warnungen | Verträge über Grenzen |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| vorher | 2,875 | 5,000 | 0,826 | 3,713 | 4,975 | 4,021 | 13 | 58 |
| nachher | 2,898 | 5,000 | 0,811 | 3,760 | 4,975 | 4,200 | **9** | **52** |
| Δ | +0,023 | 0 | −0,015 | +0,047 | 0 | **+0,178** | −4 | −6 |

**Δ·w = +0,006** — Kill-Kriterium (|Δ·w| < 0,05) **greift**: unter dem Zielprofil ist die Korrektur
Modellhygiene. Aber: vier CR-01-Warnungen weniger (13 → 9), sechs Grenz-Verträge weniger, und die
`graph_suggest`-Top-5 ändern sich (zwei von fünf Zeilen). Ehrliche Lesart: das Zielprofil sieht den
Effekt nicht (es gewichtet `scalability` mit −0,2, wo die Korrektur +0,178 bringt) — die Regeln und
die Rangliste sehen ihn. **Entscheidung: die Korrektur als Pflege-CR am produktiven Graphen fahren,
ohne Architektur-Claim** — sie ist wahr, nicht wirksam.

## M2 — `architectural` ableiten statt setzen

Menge A (io-Nachbarn von `FUNC-mutate`) = { Mutate-Command, Gate-Verdikt, Graph-State,
**Fit-Advisory, Format-E-Artefakt, Aufgezeichnete Gate-Entscheidung** }. Die drei aus CR-461 sind
enthalten; A ist eine **Obermenge** (6). Kill-Kriterium („A ≠ die 3") greift wörtlich. Inhaltlich sind
die drei zusätzlichen ebenfalls Gate-Pfad: was das Gate liest (Format-E-Artefakt) und was es ausgibt
(Fit-Advisory, Audit-Eintrag). **An die Familie (CR-SM-279 Punkt 4):** die Ableitung „Flüsse am
verriegelten Gate-FUNC" liefert eine begründbare, nicht behauptbare Menge — größer als die Hand-Liste.
Ob 3 oder 6, ist eine Entscheidung; dass sie ableitbar ist, ist gemessen.

## M3 — CR-460 korrigiert

| Variante | flowEff | coher |
|---|---:|---:|
| heute (flach, alle Ebenen) | 0,826 | 3,713 |
| CR-460 A wörtlich (Knoten + Kanten raus) | **0,119** | 3,638 |
| M3a Strukturknoten raus, `compose`-Pfade durchgezogen | **0,119** | 3,887 |
| M3b1 nur Blattebene, ohne `compose` | 0,433 | 3,667 |

Keine Variante hält `flowEfficiency`. Mechanik (deckt sich mit CR-SM-279 „Messung zu Frage 1"): im
`arch`-Teilgraphen sind die drei Strukturwurzeln die **einzigen Quellen** (Eingangsgrad 0);
`sourceSinkPaths` misst von dort. Nimmt man Struktur heraus — wie auch immer — verschwinden die
Quellen, und die Zahl kollabiert. **Kill-Kriterium greift: CR-460 ist kein Metrik-, sondern ein
Konzept-CR** — was misst `flowEfficiency`, wenn `compose`-Kanten im arch-Layer liegen? Geht so an die
Familie; Option A aus CR-460 ist damit vom Tisch.

## Zusätzlicher Befund

`steering.architecture-causality.test.ts` (T-C2 ×2, T-C4) ist rot auf jedem Stand seit `c826ff2`:
`graph_suggest` liefert auf der Fixture 0 auf `arch`. Dieselbe Klasse wie M3 — die Rangliste sieht
den Zug nicht. Gehört in den Konzept-CR.

## Entscheidungsvorlage

1. **M1 als Pflege-CR** am produktiven Graphen (8 `delete-edge`, durchs Gate) — ohne Claim.
2. **M2 an CR-SM-279:** Ableitung statt Attribut, Menge = io-Nachbarn des Gate-FUNC (6 Flüsse).
3. **M3 + Zusatzbefund als Konzept-CR** an die Familie: Messebene des ℝ⁶-Vektors bei `compose`.
