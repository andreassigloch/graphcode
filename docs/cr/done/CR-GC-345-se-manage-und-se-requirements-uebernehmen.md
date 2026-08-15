# CR-GC-345 — `se-manage` und `se-requirements`: übernehmen oder streichen

**Status:** done (2026-08-15, Entscheid **A/A**) · **Angelegt:** 2026-08-15 · **Files:** 3
**Herkunft:** Befund beim Abarbeiten von CR-SM-234 — `@sigloch/claude-plugin` pflegt einen
zweiten, aimprove-gebundenen Skill-Satz neben dem, den graphcode ausliefert.
**Entscheid vorab (2026-08-15):** *„Alles, was gegen aimprove läuft, ist tot."* Diese beiden
Skills kommen deshalb hierher — **dieser CR entscheidet, ob graphcode sie braucht.**

---

## 1. Ausgangslage

Es gibt **zwei** SE-Skill-Sätze:

| | `claude-plugin` (sigloch-modules) | **graphcode** |
|---|---|---|
| Anzahl | 8 | **30** |
| Verteilung | `bin/install.sh`, Paket ist `private: true` | `graphcode skills sync` |
| Datenpfad | HTTP gegen `${AIMPROVE_API:-localhost:3002}` — **tot** | MCP-nativ |
| Überschneidung | `se-review`, `se-status`, `se-test` — hier neuer | |

Die aimprove-gebundenen Skills sind damit erledigt. **Zwei haben in graphcode kein Gegenstück
und sind der Grund für diesen CR:** `se:manage` und `se:requirements`.

---

## 2. Was davon ist schon abgedeckt

| Bestandteil | graphcode-Gegenstück |
|---|---|
| se-manage: Impl-/Integrationsplan | **`se-plan`** — leitet die CR-Reihenfolge aus dem depends-DAG ab, schneidet CRs |
| se-manage: Views implplan/intplan/changelog | **`se-view/implplan`**, **`se-view/intplan`**, **`se-view/changelog`** |
| se-manage: View `decisionlog` | **existiert nicht** — toter View-Name (nicht in `MARKDOWN_VIEWS`) |
| se-requirements: ConOps | **`se-conops`** (CREATE, Betriebsbelange vor den UCs) |
| se-requirements: IRR | **`se-irr`** (Assumption Review) |
| se-requirements: Views conops/rtm | **`se-view/conops`**, **`se-view/rtm`** |
| se-requirements: View `irr` | **existiert nicht** — toter View-Name |
| se-requirements: REQ/UC anlegen | **`se/author-req`**, **`se/author-uc`** |

**Der Funktionsumfang ist zum größten Teil da**, verteilt auf spezialisierte Skills statt auf
zwei Sammelskills.

---

## 3. Was NICHT übernommen werden darf: die Regel-Filter

Beide Skills führen eine Liste von Regel-IDs, nach der sie Verstöße filtern. **Diese Listen sind
eine handgepflegte Kopie von `RULE_TO_DIMENSION` — und sie sind bereits gedriftet:**

| Skill | Liste | entspricht | **fehlt gegenüber dem Katalog** |
|---|---|---|---|
| `se-manage` | 5 IDs | Dimensionen `ms` + `cr` | **CR-R04, MS-03, AF-05** |
| `se-requirements` | 21 IDs | Dimensionen `req` + `uc` | **R-15, FC-04, FM-01, FM-02, AF-01, AF-03** |

Das ist exakt die Defektklasse aus CR-SM-235 (eine zweite Tabelle, die hinter dem Regelsatz
herhinkt), nur eine Ebene höher. **Eine übernommene Fassung fragt `rules_get_violations` und
gruppiert nach Dimension** — sie bringt keine eigene Liste mit. Sonst ist der nächste neue Regel-
Eintrag wieder unsichtbar.

---

## 4. Was wirklich einzigartig ist

Zwei Konventionen aus `se-requirements` §5, die **nirgends sonst kodiert** sind:

> **UC-Abhängigkeiten über shared FUNC + REQ.** UC-Sequenzierung („UC.002 braucht fertigen
> Kontakt aus UC.001") wird über eine geteilte Funktion plus eigenes REQ ausgedrückt:
> ```
> CheckContactExists.FN.006 -satisfy-> ContactExists.RQ.010
> CaptureInterestMain.FC.002 -compose-> CheckContactExists.FN.006
> ```
> Kein `depends`-Edge nötig — das bestehende Metamodell reicht.

> **Batching-Konvention für UC-Komplettierung.** Batches nach Einsatzort × Akteur × funktionaler
> Kopplung; max. 4–5 UCs pro Batch (ein Chat-Kontext); pro Batch Vorschlag → Review → Mutation →
> Violations prüfen; Cross-cutting-Elemente (shared FUNCs, REQs) im ersten Batch klären.

Beide sind Modellierungswissen, keine Werkzeugbedienung. **Wenn etwas verloren geht, dann das** —
und der Verlust fällt nicht auf, weil kein Test darauf zeigt.

Die Checklisten (ConOps: ACTOR-io, `operatingModes`, UC-ACTOR-Verbindung; IRR: BQ-01/02/06/07,
RD-01; Impl-Plan: MS-Scope, MS-Zyklen, CR→MS, kritischer Pfad) sind dagegen Prosa-Fassungen
existierender Regeln — sie gehören in die Regel, nicht in eine Checkliste, sonst driften sie.

---

## 5. Die Entscheidung, die dieser CR trifft

| Option | wann richtig |
|---|---|
| **A — beide streichen** | wenn `se-plan` + `se-conops` + `se-irr` + die View-Skills den Bedarf decken. Die zwei Konventionen aus §4 wandern nach `se/author-uc`, damit sie nicht verloren gehen. |
| **B — `se:requirements` übernehmen** | wenn ein *Sammel*-Einstieg für REQ/UC-Arbeit fehlt, den die spezialisierten Skills nicht bieten. Dann MCP-nativ, ohne eigene Regel-Liste, ohne tote View-Namen. |
| **C — beide übernehmen** | wenn dasselbe auch für Planung gilt. |

**Empfehlung: A für `se-manage`, B für `se-requirements`.** `se-plan` ist deutlich schärfer als
die Planungs-Checkliste; für REQ/UC gibt es dagegen nur die Autoren-Skills (`author-req`,
`author-uc`) und kein „zeig mir den Zustand meiner Anforderungen".

### Getroffen: **A für beide** (2026-08-15)

Begründung — gemessen am Inhalt, nicht am Namen: die beiden Skills bestehen aus **13
Abschnitten, genau einer davon ist einzigartig** (`se-requirements` §5, die zwei
Konventionen). Der Rest teilt sich in

- **abgedeckt:** State-Holen → `graph_readiness`/`rules_get_violations`; Views → 12
  `se-view/*`-Skills; „3 nächste Aktionen" → `graph_next_step` + `se-status`;
- **schlechter als vorhanden:** die Dimensions-Anzeige (`graph_readiness` liefert
  `dimension_readiness` — alle 8 Scores mit `score/violations/applicable/ready`, der Skill
  filtert nur) und die Phase (`phase_readiness` aus `RULE_TO_PHASE` **berechnet** SRR/PDR/CDR/TRR,
  der Skill **behauptet** sie);
- **aktiv driftend:** die Regel-ID-Listen (Handkopie von `RULE_TO_DIMENSION`, 3 bzw. 6 IDs
  fehlen bereits) und die vier Checklisten (Prosa-Fassung von BQ-01/02/06/07, RD-01,
  MS-01/02, IO-01) — Defektklasse CR-SM-235;
- **tot:** `decisionlog` und `irr` sind keine `MARKDOWN_VIEWS`.

Option B wurde verworfen: ein übernommener `se:requirements` wäre ein **zweiter
Status-Einstieg** neben `se-status`/`se-review` — paralleler Pfad — für zwei Absätze
Substanz. Bleibt Bedarf nach einer Anforderungs-Linse, ist der Ort ein Dimensions-Filter
**in** `se-status`, kein neuer Skill.

**Umgesetzt:** die zwei Konventionen sind in `.claude/commands/se/author-uc.md`
(§„Two conventions for a coherent UC set"); der Nachweis ist der Test
`CR-GC-345: se/author-uc carries the two conventions rescued from se:requirements`
in `tests/skills.mcp-conformance.test.ts` (rot ohne den Abschnitt verifiziert).
`se-manage` und `se-requirements` werden **nicht** nach graphcode übernommen.

**Nicht Teil dieses CRs:** was mit `@sigloch/claude-plugin` insgesamt passiert. Sein Skill-Satz,
seine drei Hook-Skripte und `bin/install.sh` hängen alle an `${AIMPROVE_API}` und sind nach dem
Entscheid vom 2026-08-15 tot — das ist ein eigener CR in `sigloch-modules`.

---

## 6. Akzeptanzkriterien

- [ ] Für jeden der beiden Skills steht die Entscheidung (A/B/C) **mit Begründung** im CR.
- [ ] Übernommene Skills sind MCP-nativ: `rules_get_violations`, `graph_readiness`,
      `graph_export`. Kein `curl`, kein `AIMPROVE_API`.
- [ ] Übernommene Skills bringen **keine eigene Regel-ID-Liste** mit — sie gruppieren nach
      Dimension aus der Antwort.
- [ ] Jeder genannte View-Name existiert in `MARKDOWN_VIEWS` (`decisionlog` und `irr` **nicht**).
- [ ] Die zwei Konventionen aus §4 sind erhalten — im übernommenen Skill oder in `se/author-uc`.
      **Ein Test oder ein Grep belegt, wo sie gelandet sind.**
- [ ] `skills.mcp-conformance` grün: kein `attributes.<key>`, das die Ontologie nicht deklariert.

---

## 7. Anhang: die beiden Skills im Original

Vollständig hier, damit die Entscheidung ohne das Vorgänger-Repo getroffen werden kann und
nichts verloren geht, falls `claude-plugin` verschwindet.

### `se-manage` (claude-plugin)

```markdown
---
name: "se:manage"
description: Planning/Tracking — Impl-Plan, Integration-Plan, Decision Log, Change Log
---

## 2. Filter violations to management profile
MS-01 Milestone empty scope, MS-02 Milestone dangling dependency,
CR-R01 CR must track, CR-R02 Done requires commit, CR-R03 No concurrent mutation

## 4. Checklisten
### Impl-Plan Checklist
- Alle MS-Elemente haben Scope (compose-Traces zu FUNC/REQ/UC)
- MS-Abhaengigkeiten konsistent (keine Zyklen, keine Dangling)
- Jeder CR ist einem MS zugeordnet
- Kritischer Pfad identifiziert

### Integration-Plan Checklist
- Alle Module haben Integrations-Reihenfolge
- Cross-Module Abhaengigkeiten dokumentiert (IO-01)
- Integrations-Tests pro MS definiert

## 5. Gate-Review Score
Readiness-Dimensionen: ms, cr — mit Prozentbalken. Phase und PASS/FAIL nennen.
```

### `se-requirements` (claude-plugin)

```markdown
---
name: "se:requirements"
description: REQ/UC work — quality rules, ConOps, IRR, RTM
---

## 2. Filter violations to requirements profile
P1 Anforderungsqualitaet: BQ-01/02/04/06/07, RD-01/02/03
P2 UC/Szenario: UC-01..06, FC-01..03, R-14, R-16, R-17, CL-01

## 4. Checklisten
### ConOps Checklist
- Alle ACTORs haben mindestens 1 io-Trace
- Jeder ACTOR hat operatingModes definiert (@operatingModes)
- Alle UCs haben mindestens 1 ACTOR-Verbindung
- System-Context vollstaendig (SYS compose UC)

### IRR Checklist
- Alle REQs haben mindestens 20 Zeichen Beschreibung (BQ-07)
- Keine Weasel Words in REQs (BQ-01)
- Alle REQs haben messbares Kriterium (BQ-02)
- REQs folgen "System shall" Pattern (BQ-06)
- Keine unresolved leaf REQs (RD-01)

## 5. Konventionen  ← der einzigartige Teil, s. §4
[UC-Abhaengigkeiten ueber shared FN + REQ; Batching-Konvention]

## 6. Gate-Review Score
Readiness-Dimensionen: req, uc — mit Prozentbalken. Phase (SRR/PDR) und PASS/FAIL nennen.
```

---

## 8. Gate-Evidenz

- **Gemessen, nicht geschätzt:** 8 vs. 30 Skills gezählt; Überschneidung per `comm` ermittelt
  (`se-review`, `se-status`, `se-test`); die Filter-Listen gegen `RULE_TO_DIMENSION` abgeglichen
  und die 3 bzw. 6 fehlenden IDs benannt; `decisionlog`/`irr` gegen `MARKDOWN_VIEWS` geprüft.
- **Kein Prior Art:** `docs/cr/{open,done}` nach `se-manage`, `se-requirements`, `claude-plugin`
  durchsucht.
- **Der CR entscheidet nicht vorab:** §5 nennt drei Optionen mit Bedingung; die Empfehlung ist
  als solche markiert.
