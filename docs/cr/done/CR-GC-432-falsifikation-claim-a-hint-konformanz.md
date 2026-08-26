# CR-GC-432 — Spike: Falsifikation von Kern-Claim A („Die Regeln lassen Agenten selbst steuern")

**Status:** done — 2026-08-26 (Spike-Ergebnis dokumentiert, alle AK belegt) ·
**Ergebnis: NO-GO — Claim A ist mit dem heutigen Bestand nicht messbar (2026-08-26)** ·
**Angelegt:** 2026-08-26 · **Typ:** Spike (Timebox 1 Session)
**Folgearbeit (nicht hier):** die drei fehlenden Stempel → **CR-GC-434** (offen).
**Frage:** Folgten die **realen** Reparaturen in der History den **Regel-Hinweisen**? Wenn ja, hat
die Regel gesteuert; wenn die Violation auf anderem Weg verschwand (Löschung, veränderte
Grundgesamtheit, Zufall), hat sie es nicht.

## Herkunft

- **CR-GC-427 (GO):** 678 Violation-Episoden über 73 historische Graph-Stände, Violations/Element
  0,954 → 0,039. Bewiesen ist dort: der Graph wächst und wird sauberer, und **5,6 %** der
  Schließungen liefen über Löschen. **Nicht** bewiesen: dass die Regel die Handlung *gewählt* hat.
- **CR-GC-340 §2.1** (Auftrennung Regler/Aktor) ist die methodische Grundlage: nur der **Aktor**
  (LLM) ist stochastisch, der **Regler** (Fokus, Hinweis, Ranking) ist deterministisch. Claim A
  behauptet, dass der Aktor dem Regler folgt — **ohne menschliche Zwischenkorrektur**. Genau das
  misst dieser Spike, deterministisch, ohne LLM.
- Claim A ist heute nur zur Hälfte belegt: das Gate blockt reaktiv, `graph_next_step` zeigt
  deterministisch auf die schwächste Dimension. Der Schritt vom Zeigen zum **Wählen** ist offen.

## Messaufbau

`scripts/spike-hint-konformanz.mjs` — read-only, kein Produktionscode, kein Modell-Schreibvorgang.
**Messpfad = Produktpfad, identisch zu CR-GC-427:** derselbe `elementToNode`-Mapper, derselbe
`createSeDescriptor(metricPolicy)` + `DefaultRuleEngine`, Regel-Build `--core` = gepinnter
Produktstand (**core 5.2.1 / contracts 6.3.0**), der verlinkte Baum (contracts 9.1.0) als
Sensitivitätsprobe.

Je Episode wird gemessen:

1. **Was der Hinweis verlangt** — der `fix_hint` der Violation im letzten Stand **vor** dem
   Schließen. Die Übersetzung Hinweis → geforderte Handlung ist eine **explizite Tabelle**
   (`HINT_DEMANDS`), kein Fuzzy-Matching: 33 distinkte Hint-Texte, jeder im Skript als Kommentar
   zitiert, Katalog reproduzierbar über `--dump-hints`.
2. **Was tatsächlich geschah** — ein **feiner** Element-Diff über den Schließ-Schritt: welche
   Attribute (ohne `created_at`/`updated_at`), welche Kanten **nach Typ, Richtung und Typ des
   Gegenstücks**, welcher Statuswechsel, oder Löschung. Die `how`-Klassifikation aus CR-GC-427 ist
   dafür zu grob (priorisiert Status > Kante > Attribut und nennt weder Kantentyp noch Attributnamen).
3. **Urteil:** konform · abweichend (etwas anderes) · abweichend (gelöscht statt repariert) ·
   nicht entscheidbar (vier benannte Gründe).

Zwei Schärfungen gegen Scheinkonformanz: bei **MS-03** muss die `relation`-Kante vom CR **ausgehen**
und auf ein **MS** zeigen (so lautet das Prädikat); bei **R-31** wird die fehlende Seite aus der
Meldung (`missing: input + output`) gelesen — fehlen beide, müssen **beide** io-Kanten kommen.

**Stände: 74 auswertbar, 0 nicht auswertbar.** Der 74. Stand (2026-08-26) schließt keine Episode,
die Grundgesamtheit ist damit **exakt die 678 Episoden aus CR-GC-427** — die Zahl stimmt überein.

## Ergebnis

### Die Quote

| Urteil | Episoden | Anteil |
|---|---|---|
| **konform (Hinweis befolgt)** | **611** | 90,1 % |
| abweichend — Element gelöscht statt repariert | 38 | 5,6 % |
| abweichend — etwas anderes geschah | 12 | 1,8 % |
| nicht entscheidbar — Hinweis nennt keine prüfbare Einzelhandlung | 7 | 1,0 % |
| nicht entscheidbar — Element unberührt (Grundgesamtheit anderswo verändert) | 5 | 0,7 % |
| nicht entscheidbar — kein `fix_hint` (MT-02) | 5 | 0,7 % |

**Hint-Konformanz-Quote: 611/661 = 92,4 %** auf den entscheidbaren Episoden.
**Nicht entscheidbar: 17/678 = 2,5 %** — ausdrücklich keiner Seite zugeschlagen.
Untergrenze (unentscheidbare als nicht-konform): 90,1 %.
Sensitivitätsprobe mit contracts 9.1.0: 602/653 = **92,2 %**, gleiche Urteilsstruktur.

### Je Regel

| Regel | Epis. | entsch. | konform | Quote | unentsch. | geforderte Handlung |
|---|---|---|---|---|---|---|
| CR-R02 | 126 | 126 | 126 | 100,0 % | 0 | `commitRef` \| `architectureOnly` |
| MS-03 | 97 | 97 | 97 | 100,0 % | 0 | Kante `relation` → MS |
| R-30 | 64 | 64 | 55 | 85,9 % | 0 | Kante `compose` ← FCHAIN |
| R-31 | 63 | 63 | 53 | 84,1 % | 0 | Kante `io` ↔ FLOW (fehlende Seite) |
| VR-01 | 56 | 56 | 56 | 100,0 % | 0 | `testRefs[].result` |
| R-19 | 44 | 44 | 44 | 100,0 % | 0 | `testRefs` \| `concept` |
| R-02 | 39 | 39 | 32 | 82,1 % | 0 | Kante `satisfy` → REQ |
| R-20 | 37 | 37 | 36 | 97,3 % | 0 | `realRef`/`codeRef` \| `concept` \| `external` |
| CR-R01 | 25 | 25 | 25 | 100,0 % | 0 | Kante `relation` → UC/REQ/FUNC/MOD |
| R-18 | 24 | 24 | 24 | 100,0 % | 0 | illegale Kante entfernen |
| **R-29** | **16** | **15** | **1** | **6,7 %** | 1 | `testRefs`-Eintrag abgeben |
| R-22 | 12 | 12 | 12 | 100,0 % | 0 | Kante `allocate` → MOD |
| RD-01 | 10 | 10 | 10 | 100,0 % | 0 | Kante `satisfy` ← FUNC/FCHAIN/MOD/SYS |
| R-26 | 9 | 9 | 9 | 100,0 % | 0 | `realRef` \| `concept` \| `external` |
| UC-05 | 9 | 8 | 7 | 87,5 % | 1 | Kante `compose` → REQ |
| UC-06 | 9 | 8 | 7 | 87,5 % | 1 | Kante `compose` → REQ |
| IO-01 | 7 | 5 | 3 | 60,0 % | 2 | Kante `io` ↔ FLOW |
| CR-R03 | 5 | 0 | 0 | — | 5 | (strukturell, kein Einzel-Edit) |
| MT-02 | 5 | 0 | 0 | — | 5 | (kein `fix_hint`) |
| CR-R04 | 3 | 3 | 1 | 33,3 % | 0 | Kante `relation` → FUNC |
| UC-04 | 3 | 3 | 2 | 66,7 % | 0 | `description` |
| 12 Regeln < 3 Epis. | 15 | — | 11 | — | — | — |

Die Abweichungen auf R-30/R-31/R-02 sind **ausnahmslos Löschungen**; die 12 Fälle „etwas anderes"
konzentrieren sich auf R-29 (6), CR-R04 (2), IO-01 (2), R-21 (1), FC-04 (1).

### Warum die 92,4 % Claim A **nicht** stützen — die ehrliche Hälfte

**1 — Die Quote ist zu 95,6 % tautologisch.** Für 648 der 678 Episoden ist der `fix_hint` die
**wörtliche Negation des Regel-Prädikats**, und das Prädikat liest nur Eigenschaften **des
Elements**. Beispiele, an der Regelquelle (`contracts/dist/se`) belegt:

| Regel | Prädikat | Hinweis |
|---|---|---|
| CR-R02 | `status===done && !architectureOnly && !commitRef` | „Add commitRef …, or set architectureOnly=true" |
| MS-03 | kein `CR -relation-> MS` | „Add CR→MS [relation] trace" |
| R-31 | FUNC ohne io-Kante auf einer Seite | „Connect the FUNC to a FLOW on the missing side" |

Dort gibt es genau **zwei** Wege, die Violation zu schließen: den Hinweis befolgen oder das Element
löschen. Die Konformanz ist dann keine Beobachtung über Steuerung, sondern eine Ableitung aus der
Regeldefinition. **Auf den erzwungenen Regeln: 607/641 = 94,7 % — das misst „repariert statt
gelöscht", nicht „der Hinweis wählte die Handlung."**

Wo der Agent eine **echte Wahl** hatte (R-29, IO-01 elementübergreifend; R-04/RD-04/CR-R03
strukturell): **30 Episoden, davon 20 entscheidbar, Quote 4/20 = 20,0 %.** Das ist der einzige
Teil der Messung mit Trennschärfe — und er ist zu klein, um etwas zu tragen.

**2 — Der Informationsgewinn gegenüber CR-GC-427 ist 4,3 Prozentpunkte.** Kreuztabelle über alle
678 Episoden: 427 sagte „repariert statt gelöscht" für 640, dieser Spike sagt „Hinweis befolgt" für
611. **Differenz 29 Episoden.** Die feinere Messung reproduziert im Wesentlichen eine bereits
bekannte Zahl.

**3 — Zirkularität: der Kill FEUERT.** `applyRule`/`suggestEdits` (`@sigloch/se-engine`) erzeugen
für jede Regel der Klasse **Operator** einen fertigen Template-Edit — und der Kantentyp kommt dort
aus **`inferTraceType(v.fix_hint)`**: das Template **liest den Hinweis**. Wer so einen Vorschlag
anwendet, ist per Konstruktion hint-konform. In der History feuern 19 dieser Operator-Regeln;
sie tragen **392 Episoden (57,8 %)** und **57,9 % aller konformen Episoden**. Ohne sie: 257/273 =
94,1 %. — Präzisierung: gemessen ist, dass ein hint-abgeleitetes Template **existiert**, nicht dass
es **benutzt** wurde. Genau das ist nirgends gestempelt (s. Punkt 4), also ist der Fall nicht
auflösbar, sondern nur benennbar.

**4 — Confounder Mensch: der Kill FEUERT, und zwar hart.**

- Schließ-Commits insgesamt: **42**. Die Top-10 tragen **583/678 Episoden (86,0 %)**.
- **92,6 %** aller Episoden schließen in **Kampagnen-Commits** (≥ 5 Schließungen auf einmal) —
  Aufräum-Aktionen, keine beiläufigen Schritte eines arbeitenden Agenten. Die drei größten:
  `#49 Milestones geschlossen, CR-Liste als Rollup` (141), `#47 Modell-Löcher geschlossen
  (CR-GC-389)` (134), `#48 Skills in Wirkketten gehängt (CR-GC-390)` (65).
- **75,7 %** der Episoden schließen in Commits, deren Betreff **einen CR nennt**.
- **Episoden, die weder in einer Kampagne noch in einem CR-benannten Commit liegen: 1 von 678
  (0,1 %)** — `R-19 / TEST-greenfield-systemtest` in `476ff7b` („concept was a string, not bool").
  Das ist die gesamte unkonfundierte Grundgesamtheit.
- Der git-Autor **aller** 678 Schließungen ist `andreassigloch`. Das ist erwartbar (der Mensch
  committet, was der Agent schrieb) und trennt deshalb **nichts**.

Die Trennung „Agent folgte dem Regel-Hinweis" vs. „Mensch beauftragte einen CR, der zufällig
dasselbe tat" **geben die Daten nicht her**. Das ist der Befund.

**5 — Chirurgisch vs. Sammel-Edit.** 362 der 611 konformen Episoden (59,2 %) schließen mit **genau
einer** Änderung am Element — das ist mit einem gezielten Hinweis-Fix vereinbar. 249 (40,8 %)
schließen als Teil eines Sammel-Edits am selben Element, also innerhalb einer Umschreibaktion.
Auch diese Kennzahl trennt nicht kausal; sie zeigt nur, dass die Kampagnen-Lesart nicht die
Mehrheit der Einzelfälle erklärt.

### Was nirgends gestempelt ist — die Ursache der Nicht-Messbarkeit

`.graphcode/trajectory.jsonl`, 289 Zeilen, 2026-07-03 … 2026-08-26:

- Felder: `ts, operation, outcome, applied, consumerId, consumerType, graphVersion, opCounts, violations`.
- `operation` kennt **nur `mutate` (215) und `validate` (74)**. Ein Aufruf von `graph_next_step`,
  `graph_suggest` oder `rules_evaluate` hinterlässt **keine Spur** — es gibt kein Artefakt, aus dem
  hervorginge, dass ein Hinweis vor einem Edit überhaupt **gelesen** wurde.
- `consumerType` ist für **alle 289 Zeilen** `agent`; ein `author`-Feld gibt es nicht, ein
  Auslöser-Feld (`trigger`/`cr`/`prompt`) für **0** Zeilen.

**Drei Stempel fehlen**, und ohne sie ist Claim A auch künftig nicht messbar:

1. **`respondsTo: {ruleId, elementId}`** am Mutate — welchen Fund dieser Edit beantwortet.
   Ohne ihn ist jede Zuordnung Edit→Regel eine Rekonstruktion aus dem Ergebnis, also zirkelnah.
2. **`trigger`** am Mutate — menschlicher Auftrag (mit CR-Referenz) vs. agenteninterne Runde,
   plus `consultedTools` (welche Regel-/Steuer-Abfrage der Edit-Entscheidung vorausging).
   Ohne ihn ist Kampagne nicht von Autopilot trennbar.
3. **`editSource: 'suggestion-template' | 'authored'`** — ob der Edit wörtlich aus einem
   `graph_suggest`-Template kam. Ohne ihn bleibt die Zirkularität (Punkt 3) unauflösbar.

Das ist **nicht** dasselbe wie CR-DRAFT-GC-328 (Lauf-Stempel am TEST) oder CR-DRAFT-GC-348
(Learning-Feed-Format, geparkt); beide betreffen andere Artefakte.

## Entscheidung

**NO-GO für Claim A in der behaupteten Form.** Die Daten stützen ihn nicht — und widerlegen ihn
auch nicht. Sie sind **für die Frage nicht trennscharf**:

- 92,4 % Hint-Konformanz sind zu **95,6 %** eine Folge der Regeldefinition (Hinweis = Negation des
  Prädikats), nicht eine Beobachtung über Steuerung.
- **57,9 %** der konformen Episoden liegen auf Regeln, deren Template-Edit **aus dem Hinweis
  erzeugt** wird.
- **Eine** von 678 Episoden liegt außerhalb menschlich beauftragter Kampagnen-/CR-Commits.

**Was die Zahl belegen darf:** dass geschlossene Befunde **repariert und nicht wegdefiniert**
wurden — 611 Reparaturen gegen 38 Löschungen und 12 Umgehungen. Das ist die Aussage von CR-GC-427,
neu bestätigt, nicht mehr.

**Was der Claim öffentlich sagen dürfte, bis die Stempel existieren:** „Die Regeln machen die
nächste Handlung **eindeutig und deterministisch benennbar**, und die realen Reparaturen sind ihr
gefolgt statt sie zu umgehen." **Nicht:** „Agenten steuern sich damit selbst" — dafür fehlt der
Nachweis, dass der Hinweis die Handlung *ausgelöst* hat.

**Nächster Schritt (eigener CR, nicht dieser):** die drei Stempel aus §„Was nirgends gestempelt
ist". Erst danach ist der Test wiederholbar mit Trennschärfe — dann als **A/B**: Episoden mit
`respondsTo` + agenteninternem `trigger` gegen Episoden aus beauftragten Kampagnen.

## Akzeptanzkriterien

| AK | Beleg |
|---|---|
| Je Episode: Regel, Forderung des `fixHint`, tatsächliche Handlung, Passung | 678/678, feiner Element-Diff (Attributname · Kantentyp+Richtung+Gegenstück-Typ · Status · Löschung); JSON-Export mit `verdict` + `verdictWhy` je Episode |
| Hint-Konformanz-Quote gesamt und je Regel | 611/661 = **92,4 %**; Regeltabelle oben (21 Regeln ≥ 3 Episoden + Rest gesammelt) |
| Nicht entscheidbare Episoden ausdrücklich benannt, keiner Seite zugeschlagen | **17 (2,5 %)**, vier benannte Gründe, separat ausgewiesen |
| Zirkularitätsprüfung getrennt ausgewiesen | **FEUERT**: 19 Operator-Regeln, 57,9 % der konformen Episoden; Mechanismus `inferTraceType(v.fix_hint)` in `@sigloch/se-engine/rule-apply` |
| Confounder Mensch getrennt, so weit die Daten es hergeben | **FEUERT**: 92,6 % Kampagnen-Commits, 75,7 % CR-Nennung, **1 unkonfundierte Episode**; fehlende Stempel benannt |
| Ergebnis: gestützt / nicht gestützt / nicht messbar | **nicht messbar**, mit Begründung und den drei fehlenden Stempeln |
| Diff berührt nur `scripts/` und diesen CR | `scripts/spike-hint-konformanz.mjs` + diese Datei. Kein Produktionscode, kein Modell-Schreibvorgang, keine Regeländerung. `src/tools/suggest.ts` (CR-GC-431, paralleler Agent) nur gelesen. |

## Reproduktion

```bash
# Regel-Build des PRODUKTS (gepinnte Range), separat installiert:
mkdir -p /tmp/pinned && cd /tmp/pinned
echo '{"type":"module","dependencies":{"@sigloch/graph-api-core":"^5.1.0","@sigloch/contracts":"^6.0.0"}}' > package.json
npm install

# Hint-Katalog (die Grundlage der HINT_DEMANDS-Tabelle):
node scripts/spike-hint-konformanz.mjs --core /tmp/pinned --dump-hints

# Messung inkl. Kreuztabelle gegen CR-GC-427:
node scripts/spike-hint-konformanz.mjs --core /tmp/pinned --vs427 <427-json> --json /tmp/hint.json

# Sensitivitaetsprobe mit dem verlinkten Arbeitsbaum (contracts 9.1.0):
node scripts/spike-hint-konformanz.mjs --json /tmp/hint-workingcopy.json

# Einzelfaelle einer Regel zur Handpruefung:
node scripts/spike-hint-konformanz.mjs --core /tmp/pinned --sample R-29
```

**Vorbestehend rot, nicht Gegenstand dieses CR:** die Testsuite (43 von 119 Dateien,
Grammatik-Drift verlinktes contracts 9.1.0 gegen nicht migrierten SSOT → CR-GC-429). Dieser Spike
hängt nicht daran; er misst mit dem gepinnten Produkt-Build und weist die 9.1.0-Reihe separat aus.
