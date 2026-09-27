# Auswertung CR-GC-682: Inventar-Zuschnitt, Blindurteil über die Spec

Stand 2026-09-27. Neun Läufe qwen3-coder-30b über das sigllm-Gateway, Korpus `sigllm-gcrun`
(Prosa-Auftrag, Saat `SYS-sig-local`), 40 Runden, je 3 Läufe pro Zuschnitt: `fund` (Befund-Kontext,
heute), `index` (alle Knoten als `uid · type · name`), `faltung` (Compose-Faltung + nackte uids).

## Ergebnis

**Der Zuschnitt ändert die Qualität der Spec nicht messbar — alle neun Specs sind unbrauchbar.**
Kein einziger der 28 Auftragspunkte ist in irgendeiner Spec voll abgedeckt. Die Mengenvorteile von
`index` (mehr Elemente, weniger Ablehnungen, weniger Lese-Aufrufe) sind kein Qualitätsvorteil: der
Rekordlauf `gcrun-310` (193 Elemente) hat 35 Dubletten unter 49 REQ.

| Zuschnitt | Läufe | ~ von 28 (✓ = 0 überall) | O-Punkte offen geführt | erfundene Werte | Dubletten | Notensumme (5–25) |
|---|---|---|---|---|---|---|
| fund | 300 · 301 · 302 | 8 · 8 · 9 | 1 · 0 · 0 | 6 · 14 · 7 | 32 · 16 · 17 | 6 · 7 · 7 |
| index | 310 · 311 · 312 | 4 · 9 · 8 | 0 · 0 · 0 | 9 · 13 · 13 | 35 · 10 · 18 | 5 · 5 · 5 |
| faltung | 320 · 321 · 322 | 6 · 6 · 3 | 0 · 0 · 0 | 8 · 12 · 10 | 9 · 8 · 12 | 5 · 7 · 7 |

Notensumme = Treue + Dubletten + REQ + Tests + Struktur, je 1–5. Der Boden liegt bei 5.

## Was die Specs gemeinsam haben

Aus den neun Gutachten, in jeder Spec genannt:

- **Login statt Auftrag.** Jede Spec baut ein Passwort-Login mit Sitzungen, oft mit Kontosperre
  („5 Fehlversuche / 15 min“). Der Auftrag kennt kein Login; er verlangt widerrufbare Zugänge je
  Nutzer und Gerät und einen Neustart **ohne** Anmeldung. Herkunft: die Vorbilder im Executor-Prompt
  (`src/loop/executor-prompt.ts:46–72`) — siehe deterministische Prüfung unten.
- **Beide Abnahmefälle fehlen oder sind verdreht** (Arbeitstagebuch, Erreichbarkeitsprüfung).
- **Offene Punkte werden erfunden:** O3 (Antwortbeginn) bekommt 2 s oder 5 s. Das einzige „Zielwert
  offen“ steht meist an `REQ-login-dauer` — dem Vorbild aus CR-GC-667, also an der falschen Größe.
- **Erfüller ohne Inhalt:** Wirkketten aus einer einzigen „nimmt die Anfrage entgegen“-FUNC, die
  fast jede REQ erfüllen soll; viele REQ ohne Erfüller; Module fehlen meist ganz.

## Deterministische Prüfungen (ohne Urteil)

| Lauf | REQ | Login/Passwort-REQ | REQ ohne kinds | kinds-falscher Erfüller | namensgleiche REQ | REQ ohne Erfüller |
|---|---|---|---|---|---|---|
| fund 300 · 301 · 302 | 23 · 31 · 21 | 2 · 3 · 2 | 0 | 0 | 0 · 8 · 0 | 12 · 7 · 0 |
| index 310 · 311 · 312 | 49 · 28 · 31 | 5 · 3 · 6 | 0 | 0 | 30 · 6 · 7 | 0 · 0 · 13 |
| faltung 320 · 321 · 322 | 19 · 22 · 24 | 5 · 4 · 4 | 0 | 0 | 4 · 0 · 2 | 0 · 7 · 6 |

- **Leck aus dem Prompt-Vorbild in 9 von 9 Läufen.** `REQ-login-dauer` (Vorbild seit CR-GC-667)
  steht in 6 von 9 Läufen wörtlich. ITEM-2026-607.
- **kinds und Erfüller-Typ stimmen überall** — das hält der Preflight. Das Problem sitzt im Inhalt,
  nicht in der Form.

## Prüfung der Gutachter

Vier Befunde stichprobenartig am Graphen nachgesehen, alle bestätigt:
`REQ-throughput-latency` „innerhalb von 5 Sekunden“ (`gcrun-301`); `REQ-nachtlauf-aufgaben-erfolg`
„mindestens einmal pro Planung“ gegen „nie zweimal“ (`gcrun-312`), dort fünf REQ mit „5 s“; dreimal
wortgleich „per Passwort in unter 2 s“ (`gcrun-310`); das einzige ✓ bei O3 (`gcrun-300`) steht zu
Recht — `REQ-interaktive-session` führt den Zielwert offen.

**Methodenfehler, korrigiert:** die erste Gutachterrunde lief auf Specs, die alle REQ als „ohne kinds“
zeigten — der Renderer las `kinds` unter `attributes`, der Export trägt es am Element. Die Runde wurde
verworfen und auf korrigierten Specs wiederholt; nur diese zweite Runde steht oben.

## Wie das Modell arbeitet (Verhaltensanalyse, 9 Läufe)

**Kurz:** Das Modell kopiert die Vorbilder des Executors, füllt sie mit den drei Satzteilen der
Seed-Beschreibung und befolgt jeden Auftrag wörtlich. Den Auftrag (`auftrag.md`) liest es in Runde 1 —
seine Gliederung (Scheitern-Punkte, Abnahmefälle) übernimmt es nicht. Die Form hält der Preflight; der
Inhalt kommt aus dem Prompt, nicht aus dem Auftrag.

### 1. Ablehnungen

| Was | Anzahl (9 Läufe) |
|---|---|
| Preflight: bestehender Knoten neu angelegt (abgefangen) | **927** — REQ 275, FUNC 198, UC 124, TEST 94 |
| Preflight-Block R-18 (Erfüller passt nicht zu `kinds`) | 195 — davon FUNC→REQ 95, MOD→REQ 20 |
| Gate-Ablehnung, häufigste Regeln | R-18 96, STRUCT 42, RD-05 20, R-31 18, IO-02 18, FC-03 16 |
| Preflight-Autokorrektur (TEST-Stub angehängt / Kante gedreht) | 59 / 15 |

Das Modell schreibt in jedem Batch große Teile des Bestands noch einmal hin, statt ihn zu referenzieren.
Die `kinds`-Semantik (FUNC erfüllt nur funktionale REQ) versteht es nicht; Preflight und Gate fangen
es ab — deshalb ist die Form in jedem Lauf korrekt.

### 2. Was die Dubletten auslöst

125 Dubletten (REQ 69, FUNC 38, UC 15, FCHAIN 3). Form: gleicher Name mit neuer uid (61), Suffix an
den Zwilling (41: `-neu`, `-decompose-n`, `-altN`), ähnlicher Text (22).

- **Der Phasenauftrag `arch`** (`src/loop/generate.ts:285`): „Schlage je Fund 2 alternative
  Zerlegungen vor … Lass das Gate wählen.“ Mit einem Kandidaten wählt kein Gate — beide landen, dann
  Alternativen der Alternativen (`gcrun-310`: `-decompose-1-alt2-alt1`). Das erklärt die späten
  Dubletten im Arm `index` (Median bei 84 % des Laufs; `index` erreicht die Phase am häufigsten).
  ITEM-2026-610.
- **Ohne Befund:** 75 der 125 entstehen in Zügen ohne `respondsTo` — Seed- und Architekturphase.
- **Nicht Sichtbarkeit:** im Arm `fund` war der Zwilling in 14 von 15 Fällen nicht in der
  Element-Liste — aber `index`, wo alles sichtbar ist, hat die meisten Dubletten. Sehen verhindert das
  Duplizieren nicht; der Preflight-Hinweis „ähnlich vorhanden 78 %“ blockiert nicht und wird ignoriert.

### 3. Struktur: was immer da ist, was immer fehlt

Die Läufe gleichen sich untereinander zu **85 %** (Jaccard über die Menge der Typ-Kante-Typ-Muster),
der Hand-Referenz `sigllm-v98` nur zu **41–48 %**.

- **Immer da (9/9):** UC→REQ, TEST→REQ, FUNC→REQ, FCHAIN→FUNC, FCHAIN→REQ, UC→FCHAIN, SYS→UC,
  ACTOR→FLOW→FUNC, FLOW→SCHEMA — das Szenario-Skelett.
- **Nie da (0/9), in der Referenz tragend:** MOD satisfy REQ (Referenz 20), REQ compose REQ (18),
  TEST verify SCHEMA (24), SYS compose MOD (7), die CR/MS-Ebene. Selten: FUNC allocate MOD (3/9, Referenz 24).
  **Die Architektur- und Qualitätsebene fehlt ganz** — median 0 MOD gegen 7, 6 SCHEMA gegen 24.
- **Zu breit, zu flach:** median 9 UC gegen 3; 23 von 39 Wirkketten bestehen aus genau **einer** FUNC
  (Referenz: 4–13).

### 4. Was allen gemeinsam ist

- **Die drei Use Cases sind der Seed-Satz** („tagsüber interaktiv bedient, nachts selbständig
  arbeitend, unterwegs lokal“): interaktiv 9/9, nachts 9/9, unterwegs 7/9. Die Scheitern-Punkte des
  Auftrags erreicht nur ein Teil der Läufe, und nur als REQ-Text (Schlüsselbund 1/9, Nachholen 3/9,
  Arbeitstagebuch 3/9).
- **Die „Annahme“-FUNC:** 63 FUNCs „Anfrage annehmen / accept / entgegennehmen“, 43 davon ohne
  Befund angelegt. Vorlage ist wörtlich das Vorbild in `src/loop/generate.ts:241–243`
  (`ACTOR-nutzer → FLOW-anfrage → FUNC-anfrage-annehmen`, `SCHEMA-anfrage`, `FCHAIN-sitzung`) — daher
  auch `ACTOR-nutzer` in 7/9 und die „Sitzungs-ID“ in den Schemas.
- **Login:** `REQ-…login…`/`…dauer` in 9/9 — das Vorbild aus `executor-prompt.ts`. ITEM-2026-607.
- Über FUNC- und UC-uids gibt es sonst **keinen** Begriff, der in ≥ 7 Läufen vorkommt: jenseits der
  Vorbilder und des Seed-Satzes erfindet jeder Lauf frei.

### 5. Die Inventar-Varianten, wie das Modell sie sieht

Erzeugt aus `gcrun-311` (89 Knoten), Fund `REQ-login-dauer`:

| Variante | Umfang | Sortierung |
|---|---|---|
| `fund` | 6 Zeilen, 437 Zeichen | uid-sortiert (`fund-kontext.ts:122`) |
| `index` | 90 Zeilen, 6 151 Zeichen | uid-sortiert — damit nach Typ-Präfix gruppiert: ACTOR, FCHAIN, FLOW, FUNC, MOD, REQ, SCHEMA, SYS, TEST, UC |
| `faltung` | 52 Zeilen, 5 909 Zeichen | Abschnitte Offen → Box → Kanten → Index; Knoten je Abschnitt uid-sortiert, Kanten in Graph-Reihenfolge, Index als Komma-Liste |

## Folgerung

1. **Den Default nicht nach diesem Lauf umstellen.** `index` ist billiger (weniger Lese-Aufrufe), aber
   nicht besser; die Mehr-Elemente sind Dubletten.
2. **Der Engpass ist nicht der Kontext, sondern der Inhalt:** das kleine Modell übernimmt den Inhalt der
   Vorbilder, erfindet Werte und verdrängt den Auftrag. Das deckt sich mit Runde 20 (qwen3-coder:
   „unbrauchbar“) und mit dem Befund aus `test_local`: für die Spezifikation taugt qwen3.8, nicht der Coder.
3. **Nächster Hebel:** ITEM-2026-607 (Vorbild-Leck, zwei Quellen) und ITEM-2026-610 (Alternativen bei N=1). Erst danach lohnt ein Vergleich der Zuschnitte
   mit qwen3.8 — mit dem Coder misst er nur Rauschen am Boden.

## Grenzen

- n = 3 je Arm; die Gutachter sind Claude-Subagenten mit je einer Spec, ohne Vergleichsgutachten.
- Raster neu festgelegt (`rig/sigllm-spezifikation/golden/auftragspunkte.json`, 28 + 5 Punkte) —
  nicht identisch mit den 26 Punkten aus Runde 20, die nicht abgelegt waren.

## Artefakte

`blind-cr682/` — die neun gerenderten Specs, die Gutachten (JSON) und `zuordnung.json`.
Renderer: `spec-render.mjs`. Ergebnisdateien der Läufe: `results-cr682-{fund,index,faltung}.json`.
