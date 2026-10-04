# CR-GC-711: Planer statt Befund-Schleife: Paket-Warteschlange je Ebene, k=2 Reparaturrunden, Fremdbefunde an den Besitzer; T-SYS mit Auftragszuordnung

**Status:** ⏸ Geparkt (2026-10-04, Entscheid Autor) — Abnehmer war der Executor, der seit dem Leitlinien-Entscheid 2026-10-03 eingefroren ist. Wieder aufnehmen nur, wenn die Vorschlagsfolge im interaktiven Rig (CR-GC-715) dieselben Muster zeigt (Ebenensprünge, halbe UCs, Module unter Inhalts-Fokus); dann 711 für den Vorschlag neu schneiden.
**Typ:** aus Item ITEM-2026-641 (idea)
**Erstellt:** 2026-09-28
**Item:** bok/items/ITEM-2026-641.json (Lane: code)

---

## Neuschnitt (2026-09-28)

Zielkette ist D2 (CR-GC-714): der Planer gehört nicht als Schleife in den Executor allein, sondern
als Werkzeug „nächstes Paket" an graphcode — für jeden Client (Kette A) und für den Executor (D2)
gleich. Vor Beginn so neu schneiden.

## Befund

Ab der ersten FUNC wählt die schwächste Readiness-Dimension über den ganzen Graphen den nächsten
Schritt (`generate.ts`, Phase `expand`). Gemessen 2026-09-28 (`zuege.mjs`, gcrun-342..344): 76 % der
Runden vervollständigen halbe Blöcke; Fokusregeln ohne eigenen Auftrag werden nie gelöst (IO-01, R-16,
FC-03, MT-02: 0 %); 10 von 12 MOD-Neuanlagen geschahen unter einem Inhalts-Fokus.

## Ziel

Ein **Planer** ersetzt die Phase `expand`: eine Warteschlange von Paketen, in der Breite je Ebene.
- Ein Paket = ein Batch, dann Gate, dann höchstens **k = 2** Reparaturrunden nur für die Befunde dieses
  Pakets; danach abgeschlossen oder „offen mit Grund".
- Fremdbefunde gehen an den Besitzer-Anker (`elternBaum`, `faltung.ts`).
- **T-SYS** als erstes Template: ACTOR, UCs, Zuordnung der Auftragsabsätze zu UCs (Vorversuch
  2026-09-27: 19/19 Absätze bei beiden lokalen Modellen).

Hängt an CR-GC-710 (Paket-Werkzeug). Die Readiness bleibt Messung, bestimmt aber nicht mehr den Schritt.

## Umfang

`generate.ts` (Phase `expand` → Planer), `executor.ts` (Schleife je Paket), neue Planer-Datei; der alte
Fokuspfad wird entfernt, nicht daneben gelassen. Mehr als 10 Dateien → vor Beginn weiter schneiden.

## Akzeptanz

- S2-Runde (3 × qwen3-coder), Zeile in `docs/messung/verlauf.md`; Blindurteil (T-E10) gegen
  `auftragspunkte.json`. Ein Planer, der das Blindurteil nicht hebt, ist widerlegt.
