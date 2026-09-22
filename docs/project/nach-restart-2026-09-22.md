# Nach dem Restart: Stand 2026-09-22, Ende Session

Ausgangslage siehe Git-Historie dieser Datei. Diese Fassung hält das ERGEBNIS fest.

## A+B — alle zehn CRs geschlossen

| CR | Repo | Ergebnis |
|---|---|---|
| CR-SM-357 | sigloch-modules | Root Cause: der Fix-Roundtrip wandte die generische Sonde `applyRule` an statt die Vorlage `fixFor`. Daran starben R-18 (Klasse Constraint) und UC-02 (der UC hat keine legale additive Kante). `suggestEdits` hatte die Frage längst beantwortet — „trennen kann das nicht die Klasse, sondern nur das TEMPLATE". Dabei fiel auf: **SC-02 war tot** — die Vorlage zeigte in die falsche Richtung. Ergebnis: **11/11 Vorlagen greifen, 10/11 schließen den Fund** (R-31 bleibt ehrlicher Teil-Fix) |
| CR-GC-616 | graphcode | Regel-Matrix trägt **Fix** und **Folge-Regeln** aus `FIX_ROUNDTRIP`; Regelzahl 69 → 66 in drei Artikeln und der Zusage; `it.todo` „Steuerregel nie info" scharf |
| CR-GC-615 | graphcode | `captureArtifacts` überlebt die Export-Verweigerung — ein bezahlter Lauf geht nicht mehr an einem Schutzmechanismus verloren |
| CR-GC-551 | graphcode | `kinds` wird beim SCHREIBEN normalisiert. Bestand gemessen: **20 von 926 REQ** tragen den String (19 graphify, 1 gve) — keine Migration |
| CR-GC-550 | graphcode | `se-plan` zählt die Deckung über Blatt-REQ. Am echten Lauf nachgerechnet: **v101 = 40 von 64**, exakt die vorab genannte Zahl; heute 65/65 |
| CR-GC-613 | graphcode | Lesewerkzeuge antworten über die Arbeitsmenge der Sitzung: **83.584 → 9.137 Zeichen** für die drei Aufrufe |
| CR-GC-612 | graphcode | GRAPHCODE.md **15.150 → 5.989**, Werkzeugbeschreibungen **25.741 → 10.770**, Marker-Überlappung **15 → 0** |
| CR-GC-614 | graphcode | Zugvermerk als Gedächtnis zwischen den Zügen, begrenzt und angesagt |
| CR-GC-608 | graphcode | war bereits implementiert (`b3d58aa`) — nachgeprüft, 10/10 Fälle gedeckt, Datei geschlossen |
| CR-GC-610 | graphcode | der Testlauf selbst — siehe unten |

## Zwei Zusagen, die NICHT erreicht wurden — und warum

Beide stehen ausgeschrieben im jeweiligen CR, nicht als Fußnote:

1. **`graph_context` unter 3.000 Zeichen bei `depth: 2`** (CR-GC-613). Nicht erreichbar: die
   30-Knoten-Scheibe kostet allein an Format-E-**Struktur** 4.080 Zeichen, bevor ein Wort Prosa
   dazukommt. Erreicht sind 9.036 → 6.696 (−26 %); bei `depth: 1` sind es 2.926. Der Hebel liegt im
   Ablauf, nicht im Werkzeug.
2. **Denkblöcke auch INNERHALB eines Schrittes verwerfen** (CR-GC-614). Verboten: CR-GC-572 hat
   gemessen, dass die Anthropic-API dann auf Turn .2 abbricht — im ersten `gcrun-frontier`-Lauf
   folgte daraus keine einzige Reparatur nach einer Gate-Ablehnung. Der Schnitt war fertig und wurde
   zurückgenommen, als der Roundtrip-Test rot wurde.

## C — die Nachprüfungen

- **graph-view-edit Compliance-Texte:** bereits korrekt („Anteil der Elemente ohne *blockierenden*
  Regelverstoss", „Schwere *error* … die blockieren, alles andere nicht"). Nichts zu tun.
- **TR-01 nachstempeln:** genau ein Repo betroffen — `prod/sigllm`, `SYS-sig-local`. Auf
  `CR-SL-001` gestempelt (die einzige CR mit `decides`-Kante), TR-01 danach 0 Funde im ganzen Modell.
- **`aise doctor`: 10 → 9 Befunde, 1 → 0 Fehler.** Geschlossen: die doppelte Nummer CR-GF-131 in
  graphify (die offene CR heißt jetzt CR-GF-150, die abgeschlossene behält 131 — sie steht in zwei
  Testdateien) und die npx-Startzeile in graph-view-edit. Die tote `dashboard.url` war ein
  transientes Falsch-Negativ (antwortet 200).

## Offen — und was daran hängt

1. **Publish.** Der Zug steht vorbereitet und unpubliziert: `@sigloch/contracts@10.11.0`,
   `@sigloch/graph-api-core@5.7.1`, `@sigloch/se-engine@1.8.0`, Tags gesetzt. `npm publish` fährt der
   Auftraggeber. Danach `@sigloch/graphcode@0.25.0` und `aise rollout`.
   **Der Bump ist minor, nicht major:** entfallene Regeln sind im Urteil von `aise release prepare`
   ausdrücklich minor („weniger Forderungen, nie ein Bruch"); major gilt nur für entfallene
   ElementTypes/TraceTypes/TRACE_PATTERNs. Die CR-Notiz „RULES_VERSION MAJOR" meint den
   REGELKATALOG (32.0.0), nicht die Paketversion. Ein major hätte sechs Peer-Ranges in vier Repos
   kaskadieren lassen — genau das, was `judgeBump` als „zu-gross" abweist.
2. **`npm update @sigloch/graphify` in sigloch-modules** (0.3.0 → 0.4.0) scheitert im Link-Modus an
   der unpublizierten contracts 10.11 — nach dem Publish nachziehen.
3. **Die zwei Kipp-Kriterien** aus CR-GC-612/613 sind Aussagen über einen LAUF und werden im
   Bestätigungslauf gemessen, nicht im Code behauptet.
