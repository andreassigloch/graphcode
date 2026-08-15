# Messgrößen — die normative Übersicht

**Claim:** deterministisch ermittelte Kenngrößen steuern Ablauf, Architektur, Regelkonformität und
Optimierung. Damit das trägt, gilt für jede Zahl: **eine** Definition, **eine** Rechenstelle, **ein**
Konsument, der darauf handelt. Wonach niemand handelt, ist keine Kenngröße und steht hier nicht.
Erzählend: `articles/07-the-scoring-landscape.md`.

Eine Regelauswertung → vier Projektionen · zwei unabhängige Messfamilien (Topologie) ·
ein abgeleiteter Steuervektor. Handeln dürfen genau drei: **Gate**, **Treiber** (Auswahl → nächster
Prompt), **Anzeige**. Der orange Kreis im Bild ist die Schleife aus „Regeln stoppen Fehler, KPIs
zeigen den Weg" (`articles/img/rule-kpi-loop.svg`) — dort von außen, hier von innen.

![Messgrößen-Landschaft: Quellen, Projektionen und wer darauf handelt](articles/img/measurement-landscape.svg)

| Größe | Rechenstelle | Skala / Nenner | Handelt darauf |
|---|---|---|---|
| Regelverstoß | `contracts/se`; `SE_DESCRIPTOR` = SE-Profil | Zählung, `error` blockend | **Gate** (blockt) · **Treiber** (Fundfenster je `rule_id` → Prompt) |
| `completeness` | graphcode-client | covered/total über die **Element**-Population | **Gate** (offen solange < 1) |
| Creation-Freshness | graphcode-client | vorhanden + aktuell | **Gate** |
| `phase_readiness` | graphcode | Regel-IDs ohne offene Verstöße / alle des Gates | **Treiber** (`currentPhaseGate` → offenes Gate des Schritts) |
| `dimension_readiness` (8) | se-steering | `1 − Verstöße / applicable`; `applicable` aus der **Domain-Deklaration je Regel** | **Treiber** (unter Fokus-Schwelle → Fokus; Δ = 1. Rangkriterium) |
| `steeringDelta` | graphcode | Δ je Dimension, vor/nach Kandidat | **Treiber** (Rang 2 + 3) |
| Architecture Fitness ℝ⁶ | `se-optimizer` | 6 Topologiewerte, ganzer Teilgraph | **Treiber** (Tiebreaker, Σ der Δ) |
| `moduleMetrics` je MOD | `contracts/se/metric-rules` | `[0,1]` / ℕ / `[0,1]`; `null` = nicht messbar | **Anzeige** (Ist gegen Zielwert) · speist MT-01/MT-02 |
| `compliance` | graphcode-client | Elemente ohne error / alle | **Anzeige** |
| `intentCoverage` | graphcode | je Thema adressiert / nicht | **Treiber** (`isIntentTooThin`, Prompt-Kontext) |
| Retro-KPIs (`KPI.md`) | `scripts/retro-kpi.mjs` | je KPI eigen | **Skill** `se-retro` |

## Schwellen — zwei Ebenen, nie im Code

Keine Urteilsschwelle steht als Literal im Regelcode. Sie steht auf einer von zwei Ebenen, und die
Zuordnung entscheidet, **wer sie ändern darf**:

| Ebene | Inhalt | Wer setzt sie | Charakter |
|---|---|---|---|
| **1 — Verfahren** (graphcode) | Maße des Messgeräts: ND-Ähnlichkeit, BQ-04-Ähnlichkeit, Schema-Overlap; die unvalidierten Startwerte von MT-01/MT-02, CR-01, R-04 | mit dem Werkzeug ausgeliefert, versioniert | **Startwerte**, nicht durch Messreihen belegt. Änderung = Messgerät ändern, gehört in eine Release-Notiz |
| **2 — Zielarchitektur** (Projekt) | Was dieses Projekt erreichen will: Instabilität, LCOM4, Crossing Flows, Fokus-Schwelle, Risiko-RPN, Modulgröße | der Mensch, je Repo | **Ziel**. Änderung = Anspruch ändern, gehört ins Projektprotokoll |

Beide liegen in `graphcode.config.jsonc`, getrennt ausgewiesen. `null` heißt auf beiden Ebenen
„messen, nicht urteilen" — und ist auf Ebene 1 der Weg, einen unbelegten Startwert loszuwerden,
ohne die Zahl zu verlieren. Jede Schwelle verlässt den Host **mit** der Größe, über die sie urteilt.

## Drei Sätze, die das Diagramm nicht zeigt

- **Regeln sehen keine Abwesenheit.** Eine Regel je Element feuert bei null Elementen null mal —
  `completeness` ist die einzige Projektion, die „fehlt komplett" messen kann.
- **`dimension_readiness` ist keine zweite Achse zu den Verstößen**, sondern deren thematische
  Verdichtung. Unabhängig sind nur `moduleMetrics` und Architecture Fitness; im Ranking kommen die
  ersten drei Kriterien aus **einem** Strom, Fitness ist das einzige eigenständige Signal.
- **Zwei Wörter „Kohäsion":** `cohesion` misst Kanten innerhalb der *erklärten* Modulgrenze (in
  flow-geführten Architekturen nahe 0 → bewusst schwellenlos), Architecture Fitness misst
  *algorithmisch gefundene* Cluster. Zwei Fragen, ein Wort.

## Eine Schwelle je Frage

„Ist diese Dimension zu schwach?" wird genau einmal beantwortet — von der Fokus-Schwelle aus der
Config. Ein zweiter Wert für dieselbe Frage (ein `ready`-Flag neben einer Generator-Schwelle) ist
per Definition ein Widerspruch, kein Komfort.

## Gestrichen: was keinen Konsumenten hat

`overallScore` (Mittel über gestartete Dimensionen), das `ready`-Flag und der Gewichtsvektor D1–D6
werden gerechnet und von nichts gelesen — kein Gate, kein Treiber, keine Anzeige. Sie sind keine
Kenngrößen dieses Systems, sondern Reste des aimprove-Prompt-Scorers. Entweder bekommt eine davon
einen handelnden Konsumenten, oder sie fällt.

*Offen bis zur Umsetzung: CR-SM-233 · CR-SM-235 · CR-GC-329.*

@author andreas@siglochconsulting
