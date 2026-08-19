# CR-GC-366 — Wirkketten-Abdeckung: jede FUNC gehört in eine Wirkkette

**Status:** done (2026-08-19)
**Datum:** 2026-08-19
**Herkunft:** `docs/spikes/SPIKE-GC-minimal-whitebox-RESULTS.md` — der Wirkketten-Radius
(„welche UC sind von dieser Funktionsänderung betroffen") ist deterministisch berechenbar und
liefert eine Ein-Satz-Antwort statt einer Knotenliste: CR-GC-114 → 1 FCHAIN / 1 UC,
CR-GC-115 → 1/1, CR-GC-340 → 2/2, gegen 35–49 Knoten im alten Blast-Radius.

## Problem

Er ist nur für **43 %** der Funktionen beantwortbar. Im graphcode-Selbstmodell haben
**47 von 82 FUNC (57 %)** weder eine `FCHAIN -compose-> FUNC`-Anbindung noch ein
`FUNC -satisfy-> UC`. Für diese Funktionen kann niemand sagen, welchem Use Case sie dienen —
und keine Regel meldet es.

Die Ontologie deckt heute nur die Gegenrichtung ab:

| Regel | Aussage | Richtung |
|---|---|---|
| R-14 | UC braucht ≥ 1 `compose` (→ FCHAIN oder REQ) | UC abwärts |
| R-15 | FCHAIN braucht ≥ 1 `compose` (→ FUNC) | FCHAIN abwärts |
| R-21 | FUNC↔FUNC-Verbindung *als FCHAIN deklariert* braucht Integrationstest | FCHAIN-Paar |
| — | **FUNC ohne jede Wirkketten-Anbindung** | **fehlt** |

R-15 verlangt, dass eine FCHAIN Funktionen hat. Niemand verlangt, dass eine Funktion zu einer
FCHAIN gehört. Genau diese Lücke ist der blinde Fleck.

## Lösung

Neue Regel **R-30 (warning)**: eine FUNC ohne `FCHAIN -compose-> FUNC` **und** ohne
`FUNC -satisfy-> UC` ist nicht in eine Wirkkette eingebunden.

- **Severity warning, nicht error.** 57 % Trefferquote auf dem eigenen Modell — ein error
  würde jedes `mutate()` auf dem Delta-Gate blockieren (vgl. Apply-Gate-Delta-Semantik) und
  wäre Neubau-Zwang statt Steuerung.
- `fix_hint`: „FUNC in eine FCHAIN aufnehmen (`FCHAIN -compose-> FUNC`) oder direkt einem UC
  zuordnen (`FUNC -satisfy-> UC`)".
- `candidate_targets`: die existierenden FCHAIN + UC — damit das Fix-Template im
  Autorier-Loop greift, statt nur die Symptom-Message zu zeigen.
- Dimension: `arch` in `RULE_TO_DIMENSION` (dieselbe Dimension wie R-15).

**Regel-Ort = `@sigloch/contracts/se`, nie lokal** (Drift-Lock L1/L2, CLAUDE.local.md): neue
Rule ⇒ Familie-Review + Version-Bump. graphcode importiert sie nur; ein lokaler Rule-Parser
wäre ein Parallelpfad.

## Abgrenzung

- **Kein** neuer ElementType, **keine** neue TraceType — R-30 wertet vorhandene `compose`/
  `satisfy`-Kanten aus.
- **Nicht** Teil dieses CRs: der Wirkketten-Radius als Query/Tool (eigener CR, s.u.) und die
  Nachmodellierung der 47 Funde im graphcode-Selbstmodell (Folge-Arbeit, gate-getrieben).

## Dateien (≤ 6)

| Repo | Datei | Änderung |
|---|---|---|
| sigloch-modules | `packages/contracts/src/se/rules.ts` | R-30 + `RULE_TO_DIMENSION`-Eintrag |
| sigloch-modules | `packages/contracts/src/se/index.ts` | Export/RULES_VERSION-Bump |
| sigloch-modules | `packages/contracts/tests/unit/se-rules.test.ts` | R-30 rot→grün, inkl. `candidate_targets` |
| graphcode | `package.json` / `package-lock.json` | contracts-Range auf die neue Version |
| graphcode | `docs/graph/graphcode.graph.json` | ONTOLOGY/RULES_VERSION nachziehen |

## Akzeptanzkriterien

- [ ] `rules_evaluate` meldet R-30 als **warning** für eine FUNC ohne FCHAIN/UC-Anbindung.
- [ ] Auf dem graphcode-Selbstmodell: **47 Funde** (Ist-Stand 2026-08-19), keine false positives
      bei den 35 angebundenen FUNC.
- [ ] `readiness` zeigt R-30 in der Dimension `arch`; `graph_generate` kann die Funde
      fokussieren (Fix-Template greift, `candidate_targets` gefüllt).
- [ ] Kein `mutate()` wird durch R-30 blockiert (warning-Semantik, Delta-Gate unberührt).
- [ ] `npm run build` + Tests in beiden Repos grün; keine lokale Regel-Definition in graphcode.

## Folge-CR (nicht hier)

`graph_effect_chain(uid)` — der Wirkketten-Radius als read-only Query („welche FCHAIN/UC sind
betroffen"), Gegenstück zu `graph_impact`. Erst sinnvoll, wenn R-30 die Abdeckung treibt:
eine Query, die für 57 % der Funktionen leer zurückkommt, erzieht niemanden.

---

## Ergebnis (2026-08-19)

Der Zuschnitt hat sich beim Bauen an drei Stellen geaendert — alle drei auf Entscheidung:

**`FUNC -satisfy-> UC` ist gestrichen**, nicht nur als zweiter Weg geduldet. Es war die billigere
Abkuerzung: eine FUNC konnte einen UC bedienen, ohne in dessen Kette zu stehen, womit IO-01 und
R-21 sie nie sahen. ONTOLOGY 6.0.0 → 7.0.0. Damit entfaellt auch der zweite Disjunkt in R-30 —
die Regel fragt nur noch nach der FCHAIN.

**R-31 kam dazu.** Die Messung fand eine groessere Luecke als die im CR beschriebene: 54 FUNC ohne
io-Ein- oder -Ausgang gegen 60 ohne Kette. R-10 stellt dieselbe Frage vom FLOW aus und sieht eine
FUNC ohne jede io-Kante nie.

**R-02 war zieltyp-blind.** Ein `satisfy` auf einen UC schaltete es stumm, obwohl kein Requirement
erfuellt war — 6 von 33 Faellen verdeckt.

### Zwei Design-Entscheidungen, die nicht im CR standen

- R-30 vererbt Ketten-Mitgliedschaft ueber `FUNC -compose-> FUNC` nach unten. Ohne das waeren 76
  der 82 FUNC Fehlbefunde, weil sie Kinder sind.
- R-31 meldet **einen** Befund je FUNC, nicht je fehlender Seite — sonst uebersteigt der Zaehler
  seinen Nenner-Beitrag (CR-SM-242).

### Gemessen (82 FUNC)

| | vorher | nachher |
|---|---|---|
| R-18 (error) | 26 | **0** |
| R-30 | — | 60 |
| R-31 | — | 54 |
| R-02 | 27 | 33 |

**error-Verstoesse im Selbstmodell gesamt: 0.** 808/808 Tests gruen.

### Rollout

contracts 5.0.0 (+5.0.1: Selbst-Dependency entfernt, die eine contracts-4.2.0-Kopie ins
node_modules nistete) → graph-api-core 4.0.0 → graphcode-client 0.10.0 · se-optimizer 0.6.0 ·
se-steering 0.7.0 · graph-cypher-wasm 0.2.4 → graph-view-edit 0.4.0 → graphcode.

`se-optimizer` trug echte Arbeit: `CLASS_MAP` deckt R-30/R-31 als **Operator** ab; ohne Eintrag
waeren sie als `unclassified` durch `applyRule`/`suggestEdits` gefallen, also wirkungslos.

### Nicht Teil dieses CRs

Die 13 Waisen, die ihre satisfy-Kante verloren haben, sind jetzt R-30-Warnungen — sie waren es
vorher schon (R-30 zaehlt 60 vorher wie nachher), die Kante hat das nur verdeckt. Ihre
Ketten-Zuordnung ist gate-getriebene Folgearbeit. Analyse liegt vor: 8 → `FCHAIN-live-update`,
1 → `FCHAIN-impact-testing`, `FUNC-import` → `capture`, `FUNC-merge-nodes` → `codec-roundtrip`.
`FUNC-harness-cli` (npx-Lifecycle) und `FUNC-migrate-schema` (Re-Validierung bei Version-Bump)
passen in keine bestehende Kette und brauchen eine eigene.
