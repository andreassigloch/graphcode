# CR-GC-366 — Wirkketten-Abdeckung: jede FUNC gehört in eine Wirkkette

**Status:** open
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
