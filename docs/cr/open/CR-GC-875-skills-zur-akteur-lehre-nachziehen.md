# CR-GC-875: Skills zur Akteur-Lehre nachziehen

**Status:** ✅ Done (2026-10-28)
**Typ:** aus Item ITEM-2026-1110 (finding)
**Erstellt:** 2026-10-28
**Item:** bok/items/ITEM-2026-1110.json (Lane: code)

---

Skills zur Akteur-Lehre nachziehen: se:author-actor (antwortende Dienste sind keine Akteure, Vorab-Lieferung, Akteur in der Mitte, parallele Auslöser, Quittung), se:top-level Regel 4 (FC-06 Vorab-Lieferung, Quittung), se-view:conops Quelle (chainRoles statt ACTOR io UC), se-fmea Positionen mit Abschnitten, se-vorbereitung/se-laufzeit async am Akteur-Fluss. Befund aus Review 2026-10-28 nach CR-SM-420/422.

---

## Anlass

Seit CR-SM-420 und CR-SM-422 leitet contracts die Rolle eines Akteurs je Kette ab (`chainRoles`), und FC-06
meldet die Kette. Die Lehre dahinter (immo-infra CR-INF-009 bis CR-INF-012) steht nur im Regelcode und in
`se:top-level` Regel 4. Ein Agent, der mit `se:author-actor` den Akteur-Schnitt macht, legt antwortende
Dienste wieder als Akteure an: Schritt 3 sagt dort „Keep every … external service".

## Die Lehre, die in die Skills gehört

1. Ein Akteur löst eine Kette aus oder empfängt ihr Ergebnis. Datenquellen, Schreibziele, ein Modell und ein
   Backup antworten nur; die Funktion ruft sie selbst, ohne Fluss im Modell.
2. Ein Akteur, der nur vorab liefert, ist keiner. Die ausgelöste Funktion liest die Daten selbst (Datei,
   Speicher). FC-06 meldet das als `[predelivery]`.
3. Eine Kette geht vom ersten Auslöser bis zur letzten Senke. Ein Akteur in der Mitte (Freigeber) bekommt
   einen `sync`-Fluss aus der Kette und speist das nächste Glied; dort zerfällt die Kette in Abschnitte.
4. Mehrere Auslöser nur am selben Glied mit demselben Vertrag (SCHEMA), sonst eine eigene Kette.
5. Wer `async` ablegt, bekommt eine `sync`-Quittung zurück und ist dort Senke. Die Quittung löst nichts aus;
   die Kette läuft danach weiter (Beispiel immo-infra: KI-Agent „ins Cockpit gemeldet", danach Freigeber).
6. Die Rolle ist kein Attribut. Sie ist ein Feld im Ergebnis von `chainRoles`, je Eingang und Kette.

## Umfang (6 Dateien + 1 Test)

| Datei | Änderung |
|---|---|
| `.claude/commands/se/author-actor.md` (v1 → v2) | Punkte 1–6; Schritt 3 ohne „external service"; Prüffrage „antwortet er nur?" |
| `.claude/commands/se/top-level.md` (v5 → v6) | Regel 4: FC-06 nennt auch `[predelivery]`; Quittung (Punkt 5) |
| `.claude/commands/se-view/conops.md` (v3 → v4) | §3 Quelle: `chainRoles` mit den Rollen „Ausgeloest von / Beteiligt / Empfaenger / Liefert zu" statt `ACTOR io UC` |
| `.claude/commands/se-fmea.md` (v9 → v10) | Positionen: Akteur in der Mitte und Abschnitte aus `chainRoles.segments` |
| `.claude/commands/se-vorbereitung.md` (v6 → v7) | `async` am Fluss eines Akteurs ohne Rückfluss ist eine Vorab-Lieferung (FC-06), kein Merkmal zum Setzen |
| `.claude/commands/se-laufzeit.md` (v1 → v2) | derselbe Satz an der Merkmal-Erklärung |
| `tests/skill-top-level-ausloeser.test.ts` | prüft die neuen Sätze in author-actor und top-level |

Kein Modellzug außer den `relation`-Kanten vom CR-Knoten auf die Skill-Knoten, falls das Modell sie führt.
Nicht im Umfang: FC-06 für die Rolle `answer` (Entscheidung des Autors offen, eigener contracts-CR).

## Akzeptanz

- Kein Skill nennt mehr einen antwortenden Dienst als Akteur; `grep -n "external service" .claude/commands` ist leer.
- Regel 4 in `se:top-level` nennt alle vier FC-06-Fälle.
- `se-view:conops` §3 nennt keine unzulässige Kante (R-18).
- Der Test schlägt vor der Änderung fehl und läuft danach grün; die Suite bleibt grün.
- Verteilung an immo-infra und sirail erst mit Release und Neustart der Hosts.

## Ergebnis (2026-10-28)

- Sechs Skills nachgezogen: author-actor v2, top-level v6, se-view:conops v4, se-fmea v10, se-vorbereitung v7, se-laufzeit v2. Die Rolle `answer` steht in keinem Skill.
- `tests/skill-top-level-ausloeser.test.ts` um den Block „Akteur-Lehre in den Skills" erweitert: vor der Skill-Änderung 9 von 15 rot, danach 15 von 15 grün.
- Drei Versions-Prüfungen in `skill-fmea-orte`, `skill-laufzeit-antwortweg`, `skill-vorbereitung-felder` auf die neuen Versionen gestellt.
- `grep -n "external service" .claude/commands` ist leer. `npm run type-check` grün. `npm test`: 1662 grün, 1 rot (`tests/distribution.test.ts`, contracts unveröffentlicht, bekannt).
- Kein Modellzug: am Modell liegen keine Skill-Knoten.
- Offen: Verteilung an immo-infra und sirail mit Release und Neustart der Hosts; FC-06 für die Rolle `answer` (eigener contracts-CR).
