# CR-GC-292 — Preflight-Erweiterung: Zirkuläre Composition (R-12)

**Status:** done — GESCHLOSSEN OHNE BAU (2026-08-04): Der saubere Recount
(v19, 16+7 Runden kumuliert nach Sleep-Kill-Unterbrechung, caffeinate, CR-290/
291 + R-15/uc-Fix aktiv) erreichte die arch-Ebene (8 FUNC, 3 FCHAIN) und
lieferte **R-12 = 0 Treffer in 86 Audit-Records**. Die Vorbedingung „weiterhin
zweistellig" ist klar verneint — der Zyklus-Check wird nicht gebaut.
Vorbehalt ehrlich benannt: kleiner Endgraph (31 El); sollte R-12 in künftigen
Läufen wieder zweistellig auftreten, diesen CR als Vorlage reaktivieren.
Artefakte: rig/greenfield-systemtest/results/ (v19-recount .graph/.log/.audit).
**Datum:** 2026-08-03 (Nachtrag 2026-08-04)
**Kontext:** CR-GC-283-Folgechat, Audit-Analyse über alle Greenfield-Systemtest-Läufe.

## Ausgangslage

`R-12` (zirkuläre Composition, z.B. `Circular compose between UC-login and
FCHAIN-audit-log-scenario`) — 65 Treffer aggregiert, warning-severity. Preflight
(`src/preflight.ts`) prüft heute nur **paarweise** Kantenlegalität (R-18 Auto-Flip) und
Referenz-Existenz (R-08) — ein Zyklus über mehr als eine Kante (A compose B compose ...
compose A) ist strukturell ein Traversal-Problem, kein Paar-Check, und fällt durch das
aktuelle Preflight-Raster durch bis zum Gate.

**Voraussetzung, bevor das gebaut wird:** die Zahl ist rückläufig — im neuesten
Best-of-N-Lauf (`v16-bo3`) nur noch 3 Treffer, gegenüber zweistelligen Werten in älteren
Läufen. CR-GC-290 (Fund-Fenster-Sortierung) und CR-GC-291 könnten den Rest schon
mit-adressieren, ohne dass ein Zyklus-Check nötig wird. **Neu zählen nach 290/291,
diesen CR erst dann scharf schalten, wenn R-12 weiterhin zweistellig bleibt.**

## Nachtrag 2026-08-04 — Nachzählung durchgeführt, aber KONFUNDIERT (inkonklusiv)

Zwei Messläufe (devstral, `v18-bo3`-Konfiguration MIT CR-290/291 aktiv,
`http://localhost:1234`, mistralai/devstral-small-2-2512) sollten R-12 nachzählen.
**Beide sind für diese Frage nutzlos:** der Graph blieb 24 Runden lang in der
`uc`-Dimension hängen (44 UC / 35 FCHAIN / 10 ACTOR / 1 SYS, 0 REQ/TEST/FUNC/MOD) und
erreichte die `arch`-Dimension — wo R-12 (UC↔FCHAIN-Zyklen über compose) überhaupt
auftreten kann — **nie**. R-12 = 0 Treffer in beiden Läufen ist deshalb KEIN Beleg,
dass CR-290/291 das Problem gelöst haben, sondern nur, dass die Architektur-Ebene nie
gebaut wurde.

Root Cause dieser Stagnation (unabhängig von R-12, aber die eigentliche Blockade):
`R-15` (FCHAIN ohne FUNC-Mitglieder) lebt in der `uc`-Dimension, aber das
`uc`-Generierungs-Template kannte den Fix (FUNC anhängen) nicht — Details und Fix in
`CR-GC-290` (Nachtrag). Der Fix wurde in einem 6-Runden-Spotcheck (candidates=1, gleicher
festgefahrener Graph) live bestätigt: die eine erfolgreiche Runde fügte FUNC-Elemente an
die leeren FCHAINs, statt neue UC/FCHAIN/ACTOR zu erzeugen.

**Aktueller Stand:** mit dem R-15/uc-Fix sollte ein Lauf jetzt die `arch`-Ebene
erreichen können — aber ein sauberer, vollständiger 24-Runden-Recount NACH dem Fix
wurde in dieser Session nicht mehr gefahren (Ressourcen-/Zeit-Grenze: bereits zwei
volle ~2h-Läufe plus ein Spotcheck verbraucht; die lokale LM-Studio-Box zeigte im
Spotcheck bereits Timeout-Symptome unter der kumulierten Last). **CR-GC-292 bleibt
deshalb offen** — die eigentliche Vorbedingungs-Frage ("R-12 weiterhin zweistellig
nach 290/291?") ist unbeantwortet, nicht negativ beantwortet.

## Ziel (falls scharf geschaltet)

Preflight um einen Erreichbarkeits-Check erweitern: vor dem Anwenden eines
`add-edge`-`compose`-Commands prüfen, ob das Ziel den Ursprung bereits (transitiv) über
bestehende `compose`-Kanten in Graph ∪ Batch erreicht — wenn ja, `blocked` mit
Zyklus-Pfad im `fixHint`, analog zum bestehenden R-18/R-08-Muster (kein zweites Gate,
kein Regel-Fork, dieselben Imports).

## Abgrenzung

- Kein Contracts-Änderung, keine neue Regel — R-12 existiert bereits im Gate-Katalog;
  Preflight fängt sie nur früher mit besserem Feedback ab, exakt wie R-18/R-08 heute.
- Nicht bauen, solange die Voraussetzung (weiterhin zweistellige Treffer nach 290/291)
  nicht bestätigt ist.

## Validierung (falls scharf geschaltet)

- Unit (`tests/executor.preflight.test.ts`): drei-Knoten-Zyklus im Batch → `blocked`,
  Zyklus-Pfad im `fixHint`.
- Messlauf: R-12-Treffer nach dem Fix erwartet 0 in einem Wiederholungslauf.

## Dateien (≤6, falls scharf geschaltet)

- `src/preflight.ts`
- `tests/executor.preflight.test.ts`

## Nächster Schritt

Ein sauberer 24-Runden-Recount (devstral, v18-bo3-Konfiguration, R-15/uc-Fix aktiv)
auf frischer LM-Studio-Box (nicht unter Last), dann R-12 auszählen wie ursprünglich
geplant.

## Akzeptanzkriterien

- [ ] Nachzählung nach CR-GC-290/291 UND dem R-15/uc-Fix: R-12-Treffer weiterhin
      zweistellig? (unbeantwortet — braucht sauberen Re-Lauf; Ja → weiter unten;
      Nein → CR schließen, kein Bau nötig)
- [ ] (falls weiter) Preflight erkennt transitive Zyklen, blockt lokal mit Pfad-Hinweis
- [ ] (falls weiter) Unit-Test + Messlauf grün
