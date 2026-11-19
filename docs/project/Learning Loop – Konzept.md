# Learning Loop – Konzept

Nov 18, 2026 · @Andreas Sigloch · abgeglichen mit der FAQ-Pflege am 2026-11-19

Der Learning Loop sorgt dafür, dass dieselbe Korrektur an Modellen und Spezifikationen nicht zweimal nötig wird. Er ist die FAQ-Pflege in aise-bok, erweitert um die Fehlersignale unten. Die FAQ-Pflege ersetzt seit 2026-11-13 die learning-engine (`bok/docs/governance/learning-engine-governance.md`).

## Ziel

- **Ziel:** gute Modelle und Spezifikationen. Maßstab sind Leitlinie, Marken, Regeln und Blindurteil.
- **Fehler:** jede nötige Korrektur gegen diesen Maßstab, durch einen Menschen oder ein Gate.
- **Aufgabe des Loops:** dieselbe Korrektur soll nicht wieder nötig sein.
- **Nebenbedingungen:** Keine Regel blockiert gültige Arbeit. Es gilt die schwächste Form, die reicht: FAQ vor Skill vor Regel.
- Kein Abwägen gewichteter Dimensionen; der Prüf-Agent prüft nur: Ziel erreicht, Nebenbedingung verletzt?

## Was schon läuft (aise-bok)

| Baustein | Stand | Fundstelle |
| --- | --- | --- |
| Nachtlauf: Abgleich FAQ–CRs, Index, Vorgaben-Liste, Messung, Pflege-Agent | läuft jede Nacht; Agent höchstens 5 USD, zuletzt 4,0 und 4,7 USD | `scripts/nacht.mjs`, CR-AB-001, -006, -011, -014 |
| Quelle des Lernens | Abschnitt „Entscheidungen" geschlossener CRs der Familie | CR-AB-003, CR-AB-006 |
| Messung aus vorhandenen Logs, kein neuer Speicher | `~/.claude/projects`, git, CR-Dateien | `scripts/lib/messung.mjs` |
| Zähler je FAQ-Eintrag | bewährt 17, lückenhaft 22, ungenutzt 0 von 242 (2026-11-19) | `docs/pflege/BERICHT.md` |
| Rückfragen an den Autor je geschlossenem CR und Woche | 0,41 → 0,24 (Oktober bis 2026-11-09) | CR-AB-006 |
| Rangfolge Regel vor Skill vor FAQ; Aussage für Regel oder Skill wird CR, Eintrag wird gekürzt | entschieden | `faq/README.md`, CR-AB-010, CR-AB-013 |
| Zweiter Agent prüft jeden geänderten Eintrag gegen | entschieden | CR-AB-013 |
| Index im Kontext jedes Agenten mit graphcode | 3 von 8 Agenten lasen die FAQ nur mit Verweis; deshalb Index im Kontext | CR-AB-010, CR-GC-935 |

## Signale

| Signal | Bedeutung | heute erfasst |
| --- | --- | --- |
| Rückfragen des Coding-Agenten | Lücke in der Spezifikation; vor dem Implementierungsgate okay, danach nicht | nur gezählt, nicht eingeordnet, ohne Trennung am Gate |
| Rejections bei graph\_mutate, Gate-Verstöße (RC, BQ) | Regel greift, war dem Agenten aber nicht früh genug bekannt | nein |
| Nacharbeit (Folge-CR korrigiert geschlossenen CR) | Fehler ist durchgerutscht | nein |
| Eigene Korrekturen nach dem Agenten | Maßstab nicht erreicht | nein |
| Abweichung Modell–Code (RC-11, RC-12) | Code passt nicht zum Modell | nein |
| Blindurteil (graphanalyze) | Gesamtqualität | nein |

Zusammenführung pro CR, möglichst über se-retro (misst seit CR-GC-914 den Verlauf aller Graph-Stände).

## Zähler je Regel

Gleiches Muster wie die Zähler je FAQ-Eintrag in `messung.mjs`, übertragen auf Regeln. Aufgeteilt nach vor/nach dem Implementierungsgate und nach Projekt. Ob die Logs eine Gate-Marke tragen, ist nicht geprüft.

| Befund | Folge |
| --- | --- |
| Schlägt oft vor dem Gate an | Regel wirkt, Agent kennt sie zu spät → in den Skill |
| Schlägt nach dem Gate an | echter Handlungsbedarf |
| Schlägt nie an | Kandidat zum Streichen |

## Einordnung: drei Ebenen

1. **Werkzeug:** Die Frage betrifft graphcode selbst (Befehl, Format, Fehlermeldung). Direkt erkennbar, ändert sich nicht durch Wiederholung.
2. **Inhalt:** Alles andere zunächst. Wird im Projekt geschlossen.
3. **Methode:** Erst wenn dieselbe Art Inhaltslücke in mindestens zwei Projekten auftaucht. Nur zentral erkennbar.

Umsetzungsform je Kandidat: prüfbar → Regel, Vorgehen → Skill, nur Erklärung → FAQ. Rejection wegen Format = Werkzeug, wegen Modellierungsregel = Methode; in beiden Fällen keine neue Regel, sondern Regel früher bekannt machen (Skill) oder Fehlermeldung verbessern.

Abweichung zur FAQ heute: Sie trennt die drei Ebenen nicht (ein Format für alle, CR-AB-003). Sie nimmt eine Frage ab zwei CRs auf, nicht ab zwei Projekten (CR-AB-005). Einträge, die nur ein Repo betreffen, sind gestrichen oder tragen „In <Repo> entschieden; für andere nicht entschieden" (CR-AB-009).

## Auslieferung

- Kunde bekommt ein festes FAQ-Set (Werkzeug und Methode) als statischen Doku-Bestandteil, wie die Regeln. Bei ihm läuft nichts aktiv.
- Kein Rückkanal aus der per npx installierten Version.
- Die Engine läuft nur bei Andreas, in aise-bok als zentralem Aggregator und Lerner; fragt später auch graphcode-Instanzen auf eigenen Servern ab (mit Zustimmung).
- Eigene Kunden-FAQ vorerst weggelassen.
- Heute fehlt dafür: Der Index kommt per Hook aus dem lokalen Pfad von aise-bok (CR-GC-935). Viele der 243 Einträge sind Familien-Interna (z. B. `link-modus-bedienen`, `paket-patch-bump`). Das Kunden-Set braucht einen Filter auf Werkzeug und Methode und einen Platz im npm-Paket.
- Zu prüfen: „Regel früher bekannt machen (Skill)" setzt voraus, dass der Skill beim Kunden ankommt; `init`/`upgrade` entfernen se\*-Skills, die das Paket nicht mehr ausliefert (FAQ `skills-nicht-mehr-ausgeliefert`).

## Markt

Der generische Loop existiert auch außerhalb: ein freier Claude-Skill mit Remember → Extract → Promote → Review und Mindestanzahl an Wiederholungen für die Beförderung zur Regel ([borghei/Claude-Skills](https://github.com/borghei/Claude-Skills/blob/main/engineering/self-improving-agent/SKILL.md)), Tools wie Agnost AI für die ganze Schleife mit Review per Pull Request ([Übersicht](https://dev.to/shubhampalriwala/self-improving-ai-agents-what-they-are-how-they-work-and-the-tools-that-do-it-2026-jn5)), Scorecards je Lerneinheit mit Aussortieren schwacher Regeln ([Entelligence](https://entelligence.ai/research/self-improving-coding-agents)).

**Folgerung:** Der eigene generische Loop ist mit der FAQ-Pflege schon gebaut (16 CRs). Die fremden Loops dienen als Vergleich für Beförderung und Aussortieren, nicht als Ersatz. Eigener Vorsprung liegt in der Domäne: Loop für Spezifikationen und Modelle, Gates vor der Implementierung, Abgleich Modell–Code.

## Frühere Versuche

- learning-engine (Stand 2026-06-11): nie gebaut, am 2026-11-13 durch die FAQ ersetzt.
- aimpro: seit 2026-08-22 stillgelegt, hängt an aufgegebenen Paketen.
- Für beide ist kein Grund des Scheiterns dokumentiert.

## Nächster Schritt

- [x] CR-AB-017 (aise-bok, geschlossen 2026-11-19): `messung.mjs` zählt je Regel und Repo aus `.graphcode/audit*.jsonl` und schreibt `docs/pflege/REGELN.md`. Ausgangswert ab 2026-09-01: 154 abgelehnte Änderungen, 47 Regeln mit Anschlag, 34 ohne. Nicht gezählt: Trennung am Implementierungsgate (keine Marke im Protokoll) und RC-Regeln (nicht im Gate-Protokoll).
- [x] CR-AB-018 (aise-bok, geschlossen 2026-11-19): `REGELN.md` zeigt je Woche einen gleitenden Schnitt über 4 Wochen, gesamt, je Repo und je Regel, bezogen auf die Menge der Änderungen. Rückwirkend ab 2026-09-21: 8,1 Ablehnungen je 100 Änderungen, Tiefstand 3,2 (Ende Oktober), zuletzt 6,8.
- [ ] Prüfen, ob dieselben Befunde seltener werden, am Verlauf in `REGELN.md`. Werden sie nicht seltener, Zählung verwerfen.
- [ ] Danach: Filter für das Kunden-Set (Werkzeug und Methode) und Auslieferung im npm-Paket.
