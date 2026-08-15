# CR-GC-335 — graphcode auf contracts 5.x nachziehen (Policy komplett, eine Fokus-Schwelle)

**Status:** done · **Datum:** 2026-08-14 · **Abgeschlossen:** 2026-08-15
**Ziel:** graphcode 0.12.x
**Ontologie:** v4.0.0 — **unverändert**
**Vorbedingung:** CR-SM-236 + CR-SM-235 in `sigloch-modules` abgeschlossen.
_(Die dort genannten Versionen 5.1.0/0.5.0 waren lokale Zwischenstaende und wurden beim
Release zu contracts **4.0.0**, graph-api-core **3.0.0**, se-steering **0.4.0**,
se-optimizer **0.4.0** zusammengefasst — publiziert wurde nie eine 5.x.)_
**Bezug:** [CR-GC-329](../done/CR-GC-329-policy-in-der-config.md) (Config + `focusThreshold`,
dort §5 als Folge-CR angekündigt), CR-SM-236 (die letzten drei Schwellen als Policy-Parameter),
CR-SM-235 (`applicable`-Nenner + `readyThreshold` ohne Default)

---

## 1. Problem

Die Familie ist weitergezogen, graphcode nicht. **Gemessen am lokal gelinkten Stand vom
2026-08-14** (contracts 5.1.0, graph-api-core 3.0.0, se-steering 0.5.0, se-optimizer 0.4.0):

**1. Der Host startet nicht mehr.** `MetricPolicySchema` hat seit contracts 5.0.0 drei
Pflichtfelder mehr; `graphcode.config.jsonc` kennt sie nicht:

```
FAIL: graphcode.config.jsonc: does not match GraphcodeConfigSchema —
  metricPolicy.crossingFlows: expected object, received undefined;
  metricPolicy.riskRpn: expected number, received undefined;
  metricPolicy.moduleSize: expected object, received undefined
```

Das ist **CR-GC-329s Fail-Fast, das korrekt anschlägt** — kein neuer Defekt, sondern der
gewollte Abbruch statt eines stillen Defaults. Solange er steht, kommt ein neu gestarteter
MCP-Server nicht hoch; der laufende Prozess arbeitet nur weiter, weil er seinen Code beim Boot
geladen hat.

**2. Ein Typfehler, genau einer:** `computeReadiness` nimmt seit se-steering 0.5.0 die
Fokus-Schwelle als dritten Pflichtparameter.

```
src/steering-snapshot.ts(57,13): error TS2554: Expected 3 arguments, but got 2.
```

**3. Und damit fällt die letzte offene Zusage aus CR-GC-329.** Dort steht `focusThreshold` seit
zwei Tagen in der Config **ohne Konsument** — bewusst, weil der Konsument erst gebaut werden
konnte, wenn `computeReadiness` die Schwelle als Parameter ohne Default nimmt. Genau das hat
CR-SM-235 jetzt getan. Bis dieser CR läuft, beantworten weiterhin **zwei** Werte dieselbe Frage
„ist diese Dimension zu schwach?": die Config und der Default-Parameter `threshold = 0.8` in
`src/generate.ts:136`.

---

## 2. Ziel

Der Host startet wieder, und die Fokus-Schwelle existiert im Betrieb genau einmal — in der
Config, von dort in `computeReadiness` **und** in die Fokuswahl des Treibers.

---

## 3. Nicht-Ziele

- **Keine Kalibrierung.** Ob `crossingFlows.warning = 3` oder `moduleSize.large = 12` richtig
  sind, entscheidet dieser CR nicht; er übernimmt die Alt-Semantik unverändert
  (CR-SM-236: „die bisherigen Literale, jetzt an einer grep-baren Stelle").
- **Keine neue Kenngröße, keine Regeländerung.** Nur Durchreichen.
- **Kein Umbau von `computeWeightVector`.** `src/steering.ts:68` übergibt einen fertigen
  Report — die Report-Überladung bleibt gültig und ist **nicht** anzufassen.

---

## 4. Anforderungen

1. **Config vollständig.** `graphcode.config.jsonc` bekommt die drei neuen Felder mit der
   Alt-Semantik und je einem Satz, warum der Wert so steht:
   ```jsonc
   "crossingFlows": { "warning": 3 },   // vorher inline `count > 2`
   "riskRpn": 100,                      // FM-03, vorher inline
   "moduleSize": { "large": 12, "coupled": 8, "crossings": 2 }
   ```
   Kein Schema-Duplikat in `src/config.ts` — dort wird weiter `MetricPolicySchema` importiert,
   also wächst die Config-Prüfung von selbst mit.
2. **`focusThreshold` bekommt seinen Konsumenten.** `takeSteeringSnapshot` reicht ihn an
   `computeReadiness` durch — dieselbe Quelle wie die Policy (`harness.getGraphcodeConfig()`),
   kein zweiter Ladepfad.
3. **Der Default-Parameter in `generate.ts` fällt.** `threshold = 0.8` wird zum Pflichtparameter;
   der Wert kommt aus der Config. **Damit auch:** das optionale `threshold`-Feld von
   `graph_generate` (`src/tools/suggest.ts:134`) fällt nicht weg — es bleibt der bewusste
   Einzelfall-Override —, aber sein **Fallback ist der Config-Wert**, nicht 0.8. Ein Literal
   0.8 darf nach diesem CR in `src/` nicht mehr stehen.
4. **Tests ziehen nach**, nicht umgekehrt: `tests/config.test.ts` schreibt heute zweifeldrige
   Policies (die jetzt zu Recht abgewiesen werden), `tests/generate.test.ts` ruft
   `generationStep` 42-mal mit dem alten Signaturschnitt.

---

## 5. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `graphcode.config.jsonc` | drei Felder mit Begründung |
| `src/steering-snapshot.ts` | `focusThreshold` an `computeReadiness` |
| `src/generate.ts` | Default-Parameter raus, Pflichtparameter rein |
| `src/tools/suggest.ts` | Fallback des Overrides = Config-Wert |
| `tests/config.test.ts` | Fixtures vollständig |
| `tests/generate.test.ts` | Aufrufe nachziehen (mechanisch) |

6 Dateien — Obergrenze erreicht. Fällt beim Umsetzen eine siebte an (z. B.
`tests/steering.test.ts`), ist das der Punkt zum Splitten, nicht zum Weitermachen.

---

## 6. Akzeptanzkriterien

- [x] `npx tsc --noEmit` fehlerfrei; `loadGraphcodeConfig(repoRoot)` liefert `source: "config"`.
- [x] Ein **neu gestarteter** MCP-Server kommt hoch (nicht nur „Tests grün" — der Startabbruch
      war der Anlass).
- [x] `grep -rn "0\.8" src/` findet keine Fokus-Schwelle mehr.
- [x] Ein geänderter `focusThreshold` in der Config verschiebt **beides** nachweislich: das
      `ready`-Flag in `dimension_readiness` und die Fokuswahl von `graph_generate`. Ein Test,
      der nur eins davon prüft, belegt die Einheit der Schwelle nicht.
- [x] `ms`-Dimension **vorher/nachher gemessen und im CR notiert**: CR-SM-235 korrigiert den
      MS-03-Nenner (feuert je CR, zählte gegen MS-Knoten). Auf graphcode steht `ms` heute bei
      **0 % (97 Verstöße / 21 applicable)** — der Wert muss sich bewegen, sonst ist der
      Nenner-Fix nicht angekommen.
- [x] Volle Suite: keine **neuen** roten Tests. `tests/distribution.test.ts` bleibt rot, bis die
      vier Pakete publiziert sind (zieht sie aus der Registry) — das ist die Vorbedingung dieses
      CRs, kein Befund.

---

## 7. Folgen

Danach ist die Schwellen-Geschichte zu Ende erzählt: **contracts rechnet, die Config bestimmt,
graphcode reicht durch, der Renderer zeigt.** `docs/MESSGROESSEN.md` §„Schwellen — zwei Ebenen,
nie im Code" beschreibt dann den Ist-Zustand statt eines Ziels, und der Satz „eine Schwelle je
Frage" ist eingelöst statt behauptet.

**Reihenfolge, hart:** erst publishen, dann dieser CR. Gegen die lokale Arbeitskopie
implementiert, ist jedes „grün" nur so lange gültig, bis jemand nebenan neu baut — genau die
Stale-Dist-Falle, die in CR-SM-233 schon einmal fünf Regeln unbemerkt hat verschwinden lassen.

@author andreas@siglochconsulting

---

## Nachweis (2026-08-15)

**Die Kernmessung — `ms` bewegt sich, die Verstoesse nicht:**

| | vorher | nachher |
|---|---|---|
| `ms` auf `docs/graph/graphcode.graph.json` | **0 %** (97 / 21) | **43,9 %** (97 / 173) |

Identische 97 Verstoesse, Nenner 21 → 173. Nur die Grundgesamtheit hat sich korrigiert — genau
die Behauptung von CR-SM-235. Der alte Nenner zaehlte MS-03 („CR ohne Milestone", feuert je CR)
gegen die MS-Knoten.

Voller Readiness-Stand nach dem CR:

| Dimension | score | Verstoesse / anwendbar | ready (0.8) |
|---|---|---|---|
| req | 0.814 | 211 / 1132 | ja |
| uc | 0.891 | 13 / 119 | ja |
| arch | 0.955 | 77 / 1707 | ja |
| alloc | 0.937 | 6 / 95 | ja |
| ver | 0.874 | 60 / 476 | ja |
| schema | 0.713 | 23 / 80 | **nein** |
| cr | 0.851 | 94 / 632 | ja |
| ms | 0.439 | 97 / 173 | **nein** |

**Weiteres:**
- `npx tsc --noEmit` fehlerfrei; `loadGraphcodeConfig(repoRoot)` liefert `source: "config"`.
- `grep -rn "0\.8" src/` findet als **Wert** nur noch `DEFAULT_FOCUS_THRESHOLD` in `config.ts` —
  die eine Quelle. Alle uebrigen Treffer sind Kommentare, die auf sie verweisen.
- `graphcode.config.jsonc` traegt die vier neuen Felder mit je einer Begruendung.

## Abweichungen

**1. Vier Felder, nicht drei.** Der CR nennt `crossingFlows`, `riskRpn`, `moduleSize`. Dazu kam
**`apTable`** (CR-SM-229, am selben Tag): die AIAG-VDA-Tabelle als Policy-Feld. In der Config
steht sie auf `null` — mit dem ausdruecklichen Hinweis, dass sie dort **nicht hingehoert**,
weil die Datei eingecheckt ist. Wer eine Lizenz hat, legt sie nach `.graphcode/ap-table.json`.

**2. `computeWeightVector` musste doch fallen.** Der CR fuehrt „Kein Umbau von
`computeWeightVector`" als Nicht-Ziel. CR-SM-237 hat den Vektor am selben Tag gestrichen — das
Nicht-Ziel ist von CR-GC-336 ueberholt, nicht verletzt.

**3. `harness.getFocusThreshold()` kam dazu**, analog zu `getMetricPolicy()`. Der CR sagt
„dieselbe Quelle wie die Policy, kein zweiter Ladepfad" — das ist die Form, die das erzwingt.

**4. Bekannt offen** (nicht dieser CR, in der Suite sichtbar): `testRef`→`testRefs` in acht
graphcode-Quellen (CR-SM-231s vertagter Konsumenten-CR), die verschobene Fokus-Dimension in
`generate.test.ts`/`executor.bestofn.test.ts`, und `distribution.test.ts`, das erst nach dem
npm-Publish gruen werden kann — es installiert aus der Registry.
