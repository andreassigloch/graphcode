# CR-GC-433 — Triggerkonzept: die Optimierung im Nicht-Auto-Modus anstoßen und sehen

**Status:** DONE (2026-08-27) · **Angelegt:** 2026-08-26 · **Voraussetzung CR-GC-431:** erledigt
**Entwurf (final):** https://claude.ai/code/artifact/e555fc68-f3de-412c-96d1-4d807131f1fa
**Herkunft:** Auftraggeber 2026-08-26, wörtlich: *„wenn wir nicht im Automodus unterwegs sind,
weiß der Kunde ja gar nicht, was unsere Regel- und Architekturmaschine vorschlägt. Das
Triggerkonzept fehlt uns völlig."*

## Befund — es gibt heute keinen einzigen ungefragten Kanal

| Kanal | was er heute tut | was ihm fehlt |
|---|---|---|
| `mutate()` → `fitAdvisory` | bewertet, was gerade geschah | schlägt nichts vor |
| `graph_suggest` | rankt Architektur-Kandidaten | rein ziehend — jemand muss fragen |
| `graph_next_step` | nennt die schwächste Dimension | wird nur auf Abruf gelesen; Architektur kommt darin nicht vor |
| Rundenprompt (`generate.ts:279`) | nennt `graph_suggest` **erst im `handoff`** | Handoff = Endzustand (alle Dimensionen über Schwelle, 0 Fehler, kein offenes Gate) |
| Dashboard (gve) | Readiness, Verstöße, Artefakte, Health, Autopilot | **kein einziger Architektur-Vorschlag** |

Der Mensch sieht Hygiene. Was die Architekturmaschine vorschlägt, sieht er nie — es sei denn,
er ruft ein Werkzeug auf, von dem er wissen muss, dass es existiert.

**Verschärfend:** Solange CR-GC-431 offen ist, rankt `graph_suggest` nach einer Sonde statt nach
dem ausgelieferten Edit. Ein Trigger auf die heutige Zahl würde die falsche Empfehlung
prominent machen. **431 ist Voraussetzung, nicht Nachbar.**

## Die drei Trigger-Arten (Vorschlag des Auftraggebers, ergänzt)

1. **Ziehend, explizit — ein Empfehlungs-Skill.** `/se:optimize` o. ä.: erhebt Zielprofil (falls
   fehlt), ruft `graph_suggest`, zeigt die Top-Vorschläge mit ihrem Δm und der Frage „anwenden?".
   Billigste Variante, sofort baubar, aber der Mensch muss ihn kennen und starten.
2. **Zeigend, permanent — das Dashboard.** Eine Karte „Was die Maschine vorschlägt": Top-k aus
   `graph_suggest` gegen das aktuelle Zielprofil, je mit Regel, Element, Δm und Anwendbarkeit
   (auto-apply / Fund-only). Das ist der Kanal, der **ohne Wissen des Nutzers** wirkt — er sieht
   es, weil er ohnehin hinschaut.
3. **Schiebend, im Fluss — den nächsten Schritt anzeigen.** Der Rundenprompt bzw.
   `graph_next_step` wird sichtbar, statt nur im Autopilot-Loop zu leben. Offene Frage: als
   Dashboard-Zeile, als Hook-Ausgabe nach `mutate`, oder beides.

## Die Vorfrage — entschieden: (a)

**Architektur gehört an den Anfang, nicht ans Ende** (Auftraggeber, 2026-08-26): *„mit den
Func-of-Func und den Wirkketten und der Allokation FUNC zu Modulen bestimme ich die Architektur,
DAS ist Prio. Der Rest ist Hygiene."*

Heute ist die Reihenfolge umgekehrt: der Handoff auf `graph_suggest` liegt hinter „alles grün".
Solange das so bleibt, ist jeder Trigger ein Pflaster auf einer falschen Reihenfolge. Zur Wahl
standen: (a) Architektur-Kanal parallel zur Hygiene dauerhaft offen · (b) Architektur zuerst,
Hygiene folgt · (c) wie heute am Ende, nur sichtbarer.

**Entschieden (2026-08-26, Entwurf oben): (a).** Die Zeile „Der nächste Zug" steht permanent
im Dashboard — Architektur- und Hygiene-Empfehlung nebeneinander, kein Handoff-Endzustand als
Voraussetzung.

Belege für (a)/(b) aus dem Bestand: graphcode selbst hat nach 206 gegateten Mutationen, null
Fehlern und acht Dimensionen `ready:true` den Handoff **nie erreicht** (`graph_next_step` sagt
`req`, Defizit 0,182). Und die Blockebene kam per Retrofit (CR-GC-405), nachdem RD-04 anschlug —
nicht aus einer Architektur-Entscheidung.

## Ausdrücklich nicht

- Kein Auto-Apply: die Maschine schlägt vor, der Mensch entscheidet (Gate-Prinzip unberührt).
- Keine neue Metrik, keine 7. Dimension.
- Kein Trigger, bevor CR-GC-431 die Ranking-Zahl korrigiert hat.

## Entscheidungen (getroffen 2026-08-26, siehe Entwurf)

1. Reihenfolge: **(a)** — Architektur-Kanal permanent parallel zur Hygiene.
2. Trigger-Arten: **alle drei** — im Entwurf als eine Fläche: permanente Zeile „Der nächste
   Zug" (Art 3), Karte 2 „Wo steht die Architektur?" mit graph_suggest-Befunden gegen das
   Zielprofil (Art 2), Button `/se:optimize` (Art 1).
3. Rundenschritt außerhalb des Autopilot-Loops: **ja** — als die permanente Dashboard-Zeile.

## Dateien (beim Start zu schneiden)

Je Trigger ein eigener CR:
- **Art 1:** Skill `/se:optimize` (`.claude/skills/`) — graphcode-Repo.
- **Art 2 + 3:** Zeile „Der nächste Zug" + Karte 2 nach Entwurf — eigener CR im gve-Repo;
  Datenquelle `graph_next_step`/`graph_suggest`, ggf. SSE-Bridge-Erweiterung in graphcode.
- Karte 1 des Entwurfs („Wirkt die Arbeit?") läuft als CR-DRAFT-GC-410, nicht hier.

**Voraussetzung unverändert:** CR-GC-431 (Ranking nach ausgeliefertem Edit) vor Art 1 + 2 —
der Entwurf zeigt selbst warum: „13 Befunde, 0 anwendbar".

---

## Abschluss 2026-08-27

### Bestandsabgleich — was zwischen Entwurf und Umsetzung schon gebaut wurde

Der Entwurf beschrieb drei Trigger-Arten als Neubau. Bis zum Start war davon das meiste
der **Art 2** bereits fertig; nur die Lücke wurde ergänzt, keine zweite Karte danebengebaut.

| aus dem Entwurf | Stand beim Start | Quelle |
|---|---|---|
| Karte 1 „Wirkt die Arbeit?" | **fertig** | CR-GC-410 |
| Karte 2 „Was die Maschine dazu sagt" — Architektur-Befunde R-04/RD-04/MT-02/R-23 als Tabelle mit `applicable`-Spalte aus `graph_suggest`, plus Zielmarken je Metrik-Dimension gegen `.graphcode/target-profile.json` | **fertig** (deckt Art 2 „zeigend, permanent" weitgehend ab) | CR-GVE-262 |
| Host-Datenweg fürs Dashboard (`callHost` über `.graphcode/host.sock`, `readinessSource`-Banner bei Fallback) | **fertig** — von diesem CR mitbenutzt, kein neuer Weg | CR-GC-402 |
| Vorschläge erstmals anwendbar (retire/Umhängen als Verbund) | **fertig** — prägt hier die Anwendungsvorschrift | CR-GC-435 |
| Art 1 — Skill `/se:optimize` | fehlte | **dieser CR** |
| Art 3 — permanente Zeile „Der nächste Zug" (Architektur **und** Hygiene nebeneinander, ohne Handoff-Endzustand) | fehlte ganz: `graph_next_step` war im Dashboard nirgends | **dieser CR** |
| Rest-Lücke aus Art 2: das **Δm des Zuges** und der **konkrete Edit** waren nirgends sichtbar (die Tabelle zeigt die Zahlen der Regel-Meldung, nicht die des Vorschlags) | offen | **dieser CR** (in der Zeile) |

### Was dieser CR ergänzt hat

**Art 1 — `graphcode`:** Skill `.claude/commands/se/optimize.md` (`/se:optimize`). Erhebt das
Zielprofil nicht selbst, sondern verweist auf `se:target-profile` (keine zweite Erhebung derselben
Config); ruft `graph_suggest`; zeigt je Vorschlag Regel/Element, Δm, `applicable` und den konkreten
Zug und fragt einzeln „anwenden?"; wendet ausschließlich über `graph_mutate` an. Ein Vorschlag mit
`retire` geht als **EIN** Batch `[delete-edge, add-edge]` durchs Gate — genau der Verbund, den der
dryRun beurteilt hat (CR-GC-435). Im Graph modelliert als `FUNC-se-optimize` (allocate → MOD-skills,
satisfy → REQ-skill-authors-through-gate), gegatet, kein Hand-Edit des SSOT.

**Art 2 + 3 — `graph-view-edit`:** permanente Zeile „Der nächste Zug", ganz oben im Dashboard,
zwei gleichrangige Spalten (Architektur links aus `graph_suggest` Top-1, Hygiene rechts aus
`graph_next_step`). Datenweg = der von CR-GC-402, kein neuer. Drei Zustände je Kanal bleiben
getrennt: **ausführbarer Zug** (Δm + Edit + ggf. `retire`/`codeImpact`) · **Fund ohne Zug**
(`applicable:false` — die Zahl misst dann die Sonde, das steht dabei) · **kein Host**. Kein
Auto-Apply, keine Schaltfläche: die Zeile nennt `se:optimize`/`graph_mutate` als den Weg.

### Nicht getan (bewusst)

- Keine zweite Architektur-Karte — die Karte aus CR-GVE-262 bleibt, wie sie ist.
- Keine neue Metrik, keine 7. Dimension, kein Auto-Apply (Nicht-Anforderungen des Entwurfs).
- Kein „Button `/se:optimize`" im Dashboard: der Viewer kann keinen Chat-Skill starten. Die Zeile
  **benennt** den Skill; das ist der ehrliche Ersatz für eine Schaltfläche, die nichts auslöste.

### Nebenbefund

Die Zeile brachte einen dritten Host-Roundtrip pro `/api/dashboard`. Der lief in Tests, die schon
bei 4,1 s gegen ein 5-s-Fenster standen, in den Timeout. Symptom-Fix (Timeout erhöhen) wurde nicht
gemacht: `graph_readiness` und `graph_next_step` sind reine Lesezugriffe und gehen jetzt in EINER
Welle (`Promise.all`), `graph_suggest` bleibt bewusst allein danach (es fährt je Kandidat einen
dryRun). Netto ist das Dashboard nicht langsamer als vorher.

### Offen

- Die Hygiene-Handlungsanweisung kommt englisch aus `DIMENSION_ACTION` (graphcode
  `src/steering/steering.ts`) und steht so im deutschsprachigen Dashboard. Der Viewer übersetzt sie
  bewusst **nicht** (das wäre eine zweite Fassung derselben Aussage). Wenn das stören soll, gehört
  die Übersetzung nach graphcode — eigener CR.
