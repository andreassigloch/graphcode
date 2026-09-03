# CR-DRAFT-GC-466 — Spike: Der Repository-Stil, gemessen statt behauptet

**Status:** draft — Spike, Timebox 1 Session, ändert den produktiven Graphen nicht
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
