# CR-GC-322 — `GRAPHCODE-STEERING.md`: die Anleitung für den Menschen (Steuerung + `docs/views/`)

**Status:** done · **Datum:** 2026-08-11 · **Geschlossen:** 2026-08-12
**Ziel:** graphcode 0.12.x
**Ontologie:** v4.0.0 — **unverändert** (reines Scaffold-Artefakt, keine neuen Element-/Trace-Typen)
**Bezug:** CR-GC-207 (graph-first Guardrails), CR-GC-208 (Skill-Tabelle derived), CR-GC-220 (View-Exporter),
CR-GC-264 (View-Katalog im Client), CR-GC-295/307 (Zielprofil, Themen im Hintergrund), CR-GC-306 (Onboarding)

---

## 1. Problem

Nach `graphcode init` liegen 17 Anleitungen im Repo — und **keine davon ist für den Menschen
geschrieben**. Alle 17 (`.claude/commands/se*`) sind Arbeitsanweisungen an den Agenten, in
Ontologie-Sprache: „Alternativen als `graph_mutate {formatE, dryRun:true}` einreichen; Verdicts
vergleichen — `tier` und `fitAdvisory` (Δm auf layer:arch)". `GRAPHCODE.md` deklariert sich in Zeile 1
selbst als Harness-Guardrails; der README hat drei Sätze („sag das zu deinem Agenten").

Zwei konkrete Lücken, beide in einer Fremdrepo-Session am 2026-08-11 aufgeschlagen:

**(a) Steuerung.** Der Nutzer hat genau vier Hebel — Intent-Absatz, Beantworten der Domänenfragen,
Entscheiden zwischen vorgelegten Alternativen, Zielprofil. Sie stehen verstreut in `se/generate.md`
(Schritt 1, 3, 5) und `se/target-profile.md`, jeweils in der zweiten Person **an den Agenten**
gerichtet. Der Mensch kann sie nur rekonstruieren, indem er Agent-Skills liest, die ihm ausdrücklich
sagen, dass ihr Vokabular nicht für ihn gedacht ist (CR-GC-307: „the steering vocabulary is **our**
device … a customer cannot act on 'intent anchor'"). Folge: das Zielprofil wird nie gesetzt
(`.graphcode/target-profile.json` fehlt, `intentCoverage: null`), und der stärkste Hebel — die
Qualität des Intent-Absatzes — wird ungeführt bedient. Der Gate beweist Konsistenz des Modells, nie
dass es *das gewollte System* ist; genau diese Lücke füllt nur der Mensch.

**(b) `docs/views/`.** 15 generierte Dokumente, nirgends erklärt. Nicht im README, nicht in
`GRAPHCODE.md` (dort steht zu `docs/views/` **nur** die `dashboard.url`), nicht als README im
Verzeichnis selbst. Wer `docs/views/icd.md` sieht, erfährt weder, was drinsteht, noch dass es ein
deterministischer Render ist, dessen Hand-Edit beim nächsten `graph_export` verschwindet. Der
`GENERATED`-Header steht in der Datei — er wird gelesen, nachdem man sie geöffnet hat, nicht bevor
man beschließt, sie zu pflegen.

**(c) Nebenbefund, gleiche Ursache.** `guardrailsContent()` sagt zweimal, die Skills lägen in
`.claude/skills/` (`src/scaffold-templates.ts:376`, `:392`). Real schreibt `installSkills()` nach
`COMMANDS_DIR` = `.claude/commands/`; `.claude/skills/` ist seit CR-GC-277 das Legacy-Layout, das
`removeLegacySkills()` aktiv **entfernt**. Die scaffoldete Doku beschreibt einen Pfad, den derselbe
Scaffold-Lauf löscht.

---

## 2. Ziel

1. Ein scaffoldetes Dokument `GRAPHCODE-STEERING.md`, das der Mensch nach `init` liest: was ohne ihn
   läuft, welche vier Entscheidungen nur er treffen kann, und was `docs/views/` ist.
2. Die View-Tabelle darin ist **derived** aus `MARKDOWN_VIEWS`/`VIEW_FILENAMES` — ein neuer View kann
   nicht undokumentiert bleiben (Typ-Fehler + roter Test).
3. `GRAPHCODE.md` nennt den korrekten Skill-Pfad und verweist einmal auf die Steuerungsdatei.

---

## 3. Nicht-Ziele

- **Kein Abschnitt in `GRAPHCODE.md`.** Zwei Zielgruppen, zwei Verträge: `GRAPHCODE.md` ist der
  Agent-Vertrag und wird graph-first gelesen (kurz, Query-Pfade, Verbote). Die Steuerungsanleitung
  ist Prosa für den Menschen. In eine Datei gemischt, liest der Agent Onboarding-Prosa mit, die er
  nicht braucht, und der Mensch sucht seine vier Hebel zwischen Format-E-Regeln.
- **Keine `docs/views/README.md`.** Sie stünde im generierten Verzeichnis und würde beim Aufräumen
  eingesammelt; außerdem liest sie niemand, der nicht schon dort ist. Die Erklärung gehört dahin, wo
  man sie *vor* dem ersten Blick findet — in die Steuerungsdatei im Repo-Root.
- **Kein neuer Steuerungs-Mechanismus.** Dieser CR dokumentiert die vier existierenden Hebel; er
  ändert weder `graph_generate` noch das Zielprofil-Schema noch den Gate.
- **Keine Contracts-Regel** („Repo ohne Zielprofil" als Violation). Ein bewusst gleichgewichtetes
  Projekt ist legitim (`se/target-profile.md` §1: „All 0 is valid").
- **Keine Übersetzung.** Englisch wie `README.md` und `GRAPHCODE.md`; das Paket ist öffentlich.

---

## 4. Anforderungen

| REQ | Kind | Anforderung | Verification |
|---|---|---|---|
| REQ-S01 | functional | `init` **und** `update` schreiben `GRAPHCODE-STEERING.md` ins Repo-Root; `remove` entfernt es restlos. Der Pfad steht in `InstallResult` — `created` beim ersten Mal, `preserved` bei unveränderter Wiederholung, `updated` beim Refresh eines abweichenden Stands (`writeArtifact`-Kontrakt, identisch zu `GRAPHCODE.md`). | test |
| REQ-S02 | functional | Das Dokument benennt alle vier Steuerhebel: Intent-Absatz, Domänenfragen, Entscheidung zwischen vorgelegten Alternativen, Zielprofil (`.graphcode/target-profile.json`). | test (String-Assertion je Hebel) |
| REQ-S03 | functional | Es enthält den wörtlichen Startsatz für beide Fälle — leeres Repo (`se:generate` + Intent) und bestehendes Modell (`graph_readiness`) — so, dass man ihn kopieren kann. | test |
| REQ-S04 | functional | Es erklärt `docs/views/` als deterministischen Render: `graph_export` erzeugt es, gleicher Graph → byte-gleiche Datei, Hand-Edit verschwindet beim nächsten Export; Änderung geht über `graph_mutate`. | test |
| REQ-S05 | functional | Die View-Tabelle hat für **jeden** Eintrag aus `MARKDOWN_VIEWS` genau eine Zeile mit dem Dateinamen aus `VIEW_FILENAMES` und einem Satz, was das Dokument beantwortet. | test (Iteration über den Katalog) |
| REQ-S06 | negative | `dashboard.url` wird als **kein** View ausgewiesen (Live-Adresse, von GVE geschrieben/entfernt) — sonst sucht man dort einen Render. Und keine Portnummer im Text. | test |
| REQ-S07 | functional | `GRAPHCODE.md` nennt `.claude/commands/` als Skill-Ort (nicht `.claude/skills/`) und verweist genau einmal auf `GRAPHCODE-STEERING.md`. | test |
| REQ-S08 | negative | `GRAPHCODE-STEERING.md` wird wie `GRAPHCODE.md` bei `update` **überschrieben** (Refresh), nicht bewahrt — es ist geshippte Doku, kein Nutzerinhalt. | test (Stale-Inhalt vor `update`, danach weg) |

---

## 5. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/scaffold-templates.ts` | `STEERING_FILE`-Konstante; `VIEW_BLURBS: Record<MarkdownView, string>` + `viewTableRows()` (derived, Muster `skillTableRows()`); `steeringContent()`; in `guardrailsContent()` beide `.claude/skills/`-Stellen → `.claude/commands/` + eine Verweiszeile |
| `src/scaffold.ts` | `steeringAbs` in `init`/`update` schreiben, in `remove` entfernen |
| `tests/cli.scaffold.test.ts` | `TEST-steering-doc` — REQ-S01..S08 |
| `README.md` | die neue Datei in der `init`-Artefakttabelle (sonst dieselbe Drift, nur eine Ebene höher) |
| `docs/cr/open/CR-GC-322-steuerungsanleitung-fuer-menschen.md` | dieser CR |

Fünf Dateien, unter dem 6-Datei-Limit.

**Umsetzungsnotiz:** `VIEW_BLURBS` als `Record<MarkdownView, string>` getippt — ein neuer View im
Katalog bricht die Kompilierung, bis er einen Satz hat. Das ist die billigere Hälfte von
`skillTableRows()` (dort Frontmatter-Read, hier Typ-Zwang), erreicht aber dieselbe Garantie: die
Tabelle kann nicht unvollständig sein. Die Sätze selbst sind hier authored, weil der Katalog
bewusst zod- und beschreibungsfrei bleibt (CR-GC-264).

---

## 6. Akzeptanzkriterien

1. [x] `init` in einem leeren Repo legt `GRAPHCODE-STEERING.md` an; `remove` lässt keine Spur.
2. [x] Die View-Tabelle deckt alle 15 Katalog-Einträge ab.
3. [x] `GRAPHCODE.md` enthält `.claude/commands/` und **nicht** `.claude/skills/se-*.md`.
4. [x] `npm run build` + volle Suite grün — 85 Test-Dateien, 630 Tests (2026-08-11).
5. [x] Mutationsproben: jede trifft **genau den** Test, der sie abdecken soll.

| Mutation | erwartet rot | Ergebnis |
|---|---|---|
| Zielprofil-Absatz aus `steeringContent()` entfernt | REQ-S02 | rot, übrige 36 grün |
| `dashboard.url`-Zeile entfernt | REQ-S06 | rot, übrige 36 grün |
| `viewTableRows()` auf `MARKDOWN_VIEWS.slice(1)` verkürzt | REQ-S05 | rot (`architecture.md has a table row`) |
| `icd`-Eintrag aus `VIEW_BLURBS` entfernt | Build | `TS2741: Property 'icd' is missing` |

---

## 7. Nachtrag

Der CR-Knoten `CR-GC-322` ist am 2026-08-12 durch den Gate gegangen (`graphVersion` 66 → 67, `tier:
suggest`) und steht in `docs/views/changelog.md`. Damit ist der in §7 der Ursprungsfassung notierte
Rest erledigt — die schreibende Session hing am Store eines anderen Repos.
