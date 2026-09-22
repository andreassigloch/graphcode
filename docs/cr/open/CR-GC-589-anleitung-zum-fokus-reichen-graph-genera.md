# CR-GC-589: Anleitung zum Fokus reichen: graph_generate nennt je Fokus-Dimension den passenden se-Skill — heute liest Claude Code se:generate einmal bei 2-5 % und die Anlege-Skills erst am Ende, eine Skill-Korrektur erreicht keinen laufenden Agenten

**Status:** 🟠 Open — Body ausgearbeitet
**Typ:** aus Item ITEM-2026-438 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-438.json (Lane: graph)

---

**Reihenfolge:** nach CR-GC-587.

## 1 Befund

Claude Code liest `se:generate` einmal bei 2–5 % des Laufs (Bericht „Zeitlinie“, Spalte „1. Skill“)
und haelt sich danach an das, was im Kontext steht — auch als der Skill die veraltete Rangfolge
trug (CR-GC-583). Die Anlege-Skills (conops, fmea, trade, plan, irr) kamen erst am Ende, um
Frischestempel zu erfuellen, in Lauf 7 per `cat` als Datei statt ueber das Skill-Werkzeug (Bericht
„Navigation“, Spalte „Doku“: 7). Der Executor bekommt die Anleitung je Runde frisch (Kanal
`guidance`, Rang 5); Claude Code nie.

## 2 Zielbild

`graph_generate` nennt je Fokus-Dimension den passenden Skill als **Verweis** (`skill:
"se:author-req"`), nicht als Rumpf — der Rumpf bleibt im Skill, der Host laedt ihn bei Bedarf.
Dieselbe Zuordnung Dimension → Skill, die der Executor fuer seinen Rumpf nutzt: eine Tabelle, zwei
Transporte.

## 3 Umfang

`src/loop/generate.ts` (Feld), die vorhandene Dimension→Skill-Zuordnung des Executors (verschieben,
nicht kopieren), Test, `.claude/commands/se/generate.md` (Satz: „lade den genannten Skill“).

## 4 Kriterien

1. Eine Zuordnung fuer beide Treiber (Grep: kein zweites Mapping).
2. Gemessen wird mit dem Standardbericht (`report.mjs`, Abschnitte CR-GC-585 „Steuerung“ und CR-GC-586 „Auto gegen Hand“), Claude-Code-Arm, sigllm-Prosa-Korpus, n ≥ 2. Anlege-Skills werden im Lauf geladen, nicht erst in den letzten 10 %; „Doku als Datei“ sinkt.
