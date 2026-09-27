# CR-GC-701: Die Auftrags-Pruefliste misst Wortlaut gegen die strukturierte Projektdefinition und ist damit zwischen strukturiertem und prosaischem Lauf nicht vergleichbar: 42/42 vs 1/42 bei mehr Elementen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-360 (finding)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-360.json (Lane: code)

---

_(kein Body im Item — Befund/Zielbild hier ausarbeiten, BEVOR die Lane startet)_

---

## Umfang (10 Dateien)

Messwerkzeug ohne Modellknoten: `rig/greenfield-systemtest/{metrics,report,run}.mjs`,
`rig/sigllm-spezifikation/{lauf,lauf-gcrun,lauf-prosa}.env`,
`rig/sigllm-spezifikation/golden/anforderungen-auftrag.json` (geloescht),
`rig/sigllm-spezifikation/golden/auftragspunkte.json` (Hinweis), `docs/graphcode_leitlinie.md` §9.4.

## Ergebnis

Ersetzt, nicht repariert. Die Frage „ist der Auftrag gedeckt?" beantwortet seit CR-GC-682 das
Blindurteil (`blindurteil.mjs`, T-E10) gegen das Raster `auftragspunkte.json`, das aus der
PROSA gezogen ist, die die Laeufe lesen. Die Wortlaut-Pruefliste lief daneben weiter
(`briefCoverage` in `metrics.mjs`, Abschnitt in `report.mjs`, `CHECKLIST` in drei Lauf-Profilen) —
ein zweiter Pfad fuer dieselbe Frage, mit bekannt falscher Antwort. Entfernt: Funktion, Parameter,
Report-Abschnitt, Env-Variable, JSON-Datei; Leitlinie §9.4 nennt das Raster.

**Nachweis, dass das Blindurteil den Wortlaut nicht misst** (2026-09-27, zwei Gutachter blind):

| Lauf | Auftrag | Pruefliste (alt) | Blindurteil P* ✓ · ~ · ✗ | O* offen | Notensumme |
|---|---|---:|---|---:|---:|
| opus5-3 (Lauf 2) | Prosa | 1/42 | **25 · 3 · 0** | 1/5 | 17/25 |

Derselbe Lauf, den die Pruefliste mit 1/42 bewertete, deckt im Blindurteil 25 von 28 Punkten voll.

**Vorbehalt:** Die Gegenseite (Lauf 1, strukturiert, Pruefliste 42/42) ist nicht nachgemessen —
`runs/opus5-0` wurde am 2026-09-23 von einem Web-App-Lauf ueberschrieben (Gutachter: 0/28, anderes
System). → ITEM-2026-624. Die Vergleichbarkeit in beide Richtungen zeigt erst ein neuer Lauf auf
dem strukturierten Korpus.

## Akzeptanz

- [x] Kein Code-Pfad liest mehr die Pruefliste (`grep checklist|CHECKLIST|briefCoverage` in `rig/` leer).
- [x] `systemtest-rig`, `rig-verhalten`, `messung` gruen (61/61); `report.mjs` laeuft (exit 0).
- [x] Blindurteil am Prosa-Lauf: 25/28 statt 1/42.
- [ ] Strukturierte Gegenseite — offen, braucht einen neuen Lauf (ITEM-2026-624).
