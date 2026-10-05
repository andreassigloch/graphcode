# Kennzahlverlauf der S2-Runden

Eine Zeile je S2-Runde, geschrieben von `rig/greenfield-systemtest/verlauf.mjs` (CR-GC-709); je Lauf ein
Wert, getrennt durch „/". Definitionen: [`kennzahlen.md`](kennzahlen.md) (Executor-Züge) und der Kopf von
`verlauf.mjs`. Eine Änderung am Executor gilt erst als wirksam, wenn ihre Zeile hier steht.

| Datum | Anlass | Läufe × Runden | Elemente | Gate-Durchgang | Dubletten | Ketten mit 1 FUNC | Ähnlichkeit Golden | Fokusfunde Ende | Lösungsquote Fokus | MOD |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-09-24 | Basis (12 Runden, vor CR-GC-652) | 3 × 12 | 47 / 51 / 50 | 70 % / 54 % / 62 % | 0 % / 0 % / 0 % | — / — / — | — / — / — | 47 / 57 / 42 | — / — / — | 0 / 0 / 0 |
| 2026-09-25 | Runde 21: Hinweis-Basis (12 Runden) | 3 × 12 | 47 / 45 / 58 | 100 % / 92 % / 73 % | 0 % / 2 % / 5 % | 3/3 / 1/3 / 2/3 | 37 % / 37 % / 44 % | 26 / 28 / 27 | — / — / — | 0 / 0 / 0 |
| 2026-09-26 | CR-GC-702/703 (12 Runden) | 3 × 12 | 46 / 38 / 47 | 86 % / 80 % / 80 % | 13 % / 0 % / 4 % | 0/3 / 0/1 / 0/0 | 33 % / 30 % / 22 % | 52 / 34 / 53 | — / — / 20 % | 0 / 0 / 0 |
| 2026-09-27 | CR-GC-702–704 | 3 × 35–40–38 | 83 / 91 / 71 | 49 % / 84 % / 76 % | 4 % / 5 % / 4 % | 7/7 / 7/7 / 3/3 | 46 % / 48 % / 44 % | 46 / 33 / 15 | 35 % / — / — | 5 / 0 / 0 |
| 2026-09-27 | CR-GC-705: FC-04-Skelett | 3 × 40 | 94 / 97 / 109 | 85 % / 69 % / 55 % | 48 % / 32 % / 5 % | 3/3 / 4/4 / 7/7 | 56 % / 56 % / 59 % | 13 / 15 / 13 | — / — / — | 0 / 0 / 1 |
| 2026-09-27 | CR-GC-707: Treiber ohne Eintrittspunkte | 3 × 40 | 187 / 147 / 116 | 50 % / 80 % / 67 % | 44 % / 9 % / 19 % | 3/4 / 7/8 / 3/5 | 59 % / 56 % / 63 % | 183 / 22 / 23 | 32 % / 76 % / 63 % | 26 / 2 / 2 |
