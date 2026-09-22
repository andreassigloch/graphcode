# CR-GC-610: Code-Test (Leitlinie Satz 7): Scheduler-Scheibe aus sigllm, gefuehrt (Modell + graphcode) gegen frei laufendes Claude Code — Aufgabe, Vertrag, verdeckte Abnahme, Messung

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-472 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-472.json (Lane: graph)

---

## Warum

Leitlinie Satz 7: der Beweis muss im Code ankommen, gegen frei laufendes Claude Code. Bisher hat kein
Rig-Lauf Code erzeugt; jedes Code-Urteil war "nicht pruefbar" (Bewertung der Leitlinie, 2026-09-22).

## Aenderung — der Code-Test wird vorbereitet, nicht gefahren

`rig/code-test/` (neu), Einzelheiten in dessen README:
- `aufgabe.md`, `vertrag/contract.ts` — Scheduler-Scheibe aus sigllm (MOD-scheduler), fuer beide Arme wortgleich.
- `abnahme/scheduler.abnahme.test.ts` + `vitest.config.ts` — verdeckte Abnahme, 15 Tests zu Punkt 1–10.
- `referenz/src/index.ts` — belegt die Abnahme: Referenz 15/15, Mutante ohne Persistenz 11/15.
- `run-code.mjs` — Arme `gefuehrt` (graphcode + Golden im Store) und `frei`; `NUR_AUFBAU=1` baut nur auf.
- `messen.mjs` — Funktion, eigene Tests, Code-Kennzahlen, Architektur per `import-code` (beide Arme gleich),
  Kongruenz (gefuehrt), Effizienz.
- `tests/systemtest-rig.test.ts` — Code-Kennzahlen (Stubs/Tests ausgeschlossen, Zyklus).

Umfang 11 Dateien, fast alle neu im eigenen Rig-Verzeichnis — bewusst nicht gesplittet: die Teile sind nur
zusammen pruefbar (Abnahme braucht Referenz, Messung braucht Treiber).

## Nachweis

- Probeaufbau ohne Modell: beide Arbeitsbereiche entstehen; `gefuehrt` mit Golden im Store (255 Knoten, 506 Kanten).
- Messkette am Stueck an einer Probe (Referenz im freien Arbeitsbereich): 15/15, Kennzahlen, Import, Steuerwert.
- Kongruenz-Zweig am geführten Arbeitsbereich ohne Code: "nicht pruefbar", Bindung 0/20.

## Offen (Entscheidung Auftraggeber)

Der bezahlte Lauf (~2 × 10–20 $), n je Arm (Vorschlag: 1, dann 3), ein dritter Arm mit Auto-Spezifikation.

