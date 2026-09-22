# CR-GC-610: Code-Test (Leitlinie Satz 7): Scheduler-Scheibe aus sigllm, gefuehrt (Modell + graphcode) gegen frei laufendes Claude Code — Aufgabe, Vertrag, verdeckte Abnahme, Messung

**Status:** ✅ Done (2026-09-22)
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

## Gefahren 2026-09-22 — n = 1 je Arm

Auftrag des Auftraggebers: „ein testlauf spezifikation und coding mit claude code". Beide Arme
Opus 5 in Claude Code, dieselbe `dist`, derselbe Tag. Volle Auswertung:
**`docs/research/testlauf-2026-09-22.md`**.

| | `gefuehrt-0` | `frei-0` |
|---|---:|---:|
| Verdeckte Abnahme | **15/15** | **15/15** |
| Dateien / Verzeichnisse | 6 / 1 | **10 / 4** |
| `import-code`: MOD/FUNC/FLOW/SCHEMA | 9 / 20 / 18 / 11 | 16 / 19 / 6 / 5 |
| Steuerwert des Codes | 1,722 | 1,111 |
| Kongruenz (RC) | **kongruent** | kein Modell |
| Bindung Scheibe / Modell | 80 % / 20 % | — |
| Kosten / Turns / Sekunden | $10,44 / 107 / 1.293 | **$2,29 / 32 / 474** |

**Das Ergebnis, unbeschönigt: die Funktion ist Gleichstand, der Schnitt geht an den freien Arm,
die Rückverfolgbarkeit an den geführten — bei 4,6-fachen Kosten.**

Der Steuerwert-Vergleich trägt dabei **nicht**: der freie Arm exprimiert 6 FLOW / 5 SCHEMA gegen
18 / 11, und was nicht als Vertrag ausgedrückt ist, kann keine Vertragskonzentration auslösen. Wer
weniger Vertrag sichtbar macht, gewinnt die Kennzahl (ITEM-2026-483). Ohne diese Reparatur kann der
Code-Test seine Kernfrage nicht beantworten.

Der Spezifikationslauf lief getrennt (157 Elemente, Compliance 1,0, 4/8 Gates, Steuerwert `worst` 0,
0 Rückfälle, $9,04 / 74 Turns) — nach einem ersten Abbruch am Rig-Standardtimeout (ITEM-2026-479).

## Offen (Entscheidung Auftraggeber)

- **n = 3 je Arm** für eine Aussage statt einer Spanne. Zwei Vorläufe desselben Arms lagen bei
  $8,31 und $14,47 — die Streuung ist größer als jeder heute gemessene Unterschied.
- **Ein dritter Arm mit Auto-Spezifikation** (Phase 1 + 2 in einem Lauf). Der geführte Arm bekommt
  heute ein von Hand verfeinertes Golden; gemessen wird „modellgeführt gegen frei", nicht
  „Auto-Spezifikation plus Code gegen frei". Erst dort steht die Führung gegen die Alternative,
  die sie ersetzen soll.

