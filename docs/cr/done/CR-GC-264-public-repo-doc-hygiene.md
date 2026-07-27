# CR-GC-264: Public-Repo-Doc-Hygiene — Belege rein, Entstehungsgeschichte raus

**Status:** Done (2026-07-26) · **Max Files:** 4
**Herkunft:** Publish-Audit 2026-07-26, direkte Vorbedingung fürs Public-Schalten des Repos.

## Problem (Why)

Zwei gegenläufige Fehler im getrackten Doc-Bestand:

1. **Belege fehlen.** `docs/articles/01` und `03` verlinken `docs/spikes/SPIKE-GC-*.md` als Quelle
   für die 50×- und 27B-Zahlen — der Ordner ist gitignored. Im public Repo führt genau der Link,
   der die Kernbehauptung stützt, ins Leere. Die Spikes enthalten keine internen Referenzen
   (geprüft: kein `bok/`, kein Absolutpfad, kein Fremd-Repo) — sie sind ohne Redaktion
   veröffentlichbar.
2. **Historie ist drin.** `docs/views/spec.md` (114 KB) und `docs/views/cr-list.md` (52 KB) sind
   generierte Views, die die vollständige interne CR-Prosa samt Pfaden nach `docs/cr/` (gitignored)
   auskippen. Für die zwei realen Zielgruppen ist das falsch: wer graphcode **benutzt**, sieht sie
   ohnehin nie (das npm-Tarball enthält `dist` + `.claude/*`, keine Doku); wer **mitarbeiten**
   will, braucht die Architektur-Views, nicht die Entstehungsgeschichte.

## Design

1. `docs/spikes/` aus `.gitignore` nehmen und die drei SPIKE-Dateien committen. Die Artikel-Links
   (`../spikes/…`) stimmen dann ohne Textänderung.
2. `docs/views/spec.md` + `docs/views/cr-list.md` in `.gitignore` aufnehmen und aus dem Index
   entfernen (`git rm --cached`). Sie werden weiter lokal erzeugt — **kein** Sonderfall im
   Exporter: `graph_export` bleibt deterministisch bei 16 Views, nur zwei davon sind
   Arbeitsstand, kein Repo-Inhalt.
3. README: einen Satz, der auf `docs/spikes/` als Rohdaten zu den Artikel-Zahlen zeigt.

## Akzeptanzkriterien

- [ ] `docs/spikes/*.md` sind getrackt; die vier Artikel-Links lösen im Repo auf.
- [ ] `docs/views/spec.md` + `cr-list.md` sind nicht mehr getrackt, werden aber weiter erzeugt
      (`graph_export` schreibt unverändert 16 Views).
- [ ] Kein getracktes Markdown verlinkt mehr in gitignorede Pfade (Prüfung: Link-Grep über
      `git ls-files '*.md'`).
- [ ] `npm test` grün (die Exporter-Tests prüfen weiterhin alle 16 Views).

## Nicht in diesem CR

Übersetzung der deutschen Docs · CI-Workflow (kommt mit CR-GC-262, wenn Registry-Deps einen
Build ohne private Siblings erlauben) · Repo-Sichtbarkeit selbst (eigener Schritt nach dem Release).
