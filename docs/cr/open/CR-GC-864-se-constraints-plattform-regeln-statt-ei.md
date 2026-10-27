# CR-GC-864: se:constraints: Plattform-Regeln statt Einzelfälle, Erweiterbarkeit fehlt, Lauf vor dem ersten Schnitt

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1093 (finding)
**Erstellt:** 2026-10-26
**Item:** bok/items/ITEM-2026-1093.json (Lane: graph)

---

## Befund (immo-infra, erster Lauf 2026-10-26, graphVersion 13 → 14)

1. **Die Fragen je Dimension führen zu Einzelfällen.** Der Agent schlug 11 Constraints vor, etwa „Website ohne
   VPS“, „Report ohne Anthropic“ und „Modul ≤ 9 Funktionen“. Der Autor hat 9 davon verworfen: „das sind nicht alles
   Architektur-Constraints“. Übrig blieben zwei Plattform-Regeln, die für jede künftige Komponente gelten:
   „Anwendung als Plugin“ (jeder Fluss über die Grenze trägt eines von fünf Schemas) und „Daten nur über einen
   Adapter in immo-gate“. Das Kriterium des Skills („ein Zug am Modell kann sie brechen, ohne dass sich Code
   ändert“) ließ auch die Einzelfälle durch: „Website ohne VPS“ (Fluss async) erfüllt es.
2. **Die wichtigste Dimension fehlt in der Tabelle: Erweiterbarkeit.** Die Frage „Wie kommt ein neues Teil dazu,
   ohne dass sich der Rest ändert?“ steht nicht in der Tabelle. Sie liefert das Plugin-Schema und die Adapter-Regel.
   Änderbarkeit fragt nur nach dem Bestand.
3. **Lauf vor dem ersten Schnitt ist nicht beschrieben.** Laut Beschreibung läuft der Skill vor `se:top-level`.
   Schritt 1 liest aber Ketten und Module, und die gibt es dann noch nicht. Es fehlt die Anweisung, die Elemente zu
   benennen, die der Schnitt anlegen muss (hier `MOD-anwendungen`, `MOD-immo-gate`, fünf SCHEMA), und den Test
   bewusst rot zu lassen, bis der Schnitt steht. `se:top-level` liest die Constraints nicht als Vorgabe.
4. **Zwei Prüffunktionen fehlen in `@sigloch/graphcode/constraints`.** immo-infra hat sie lokal geschrieben
   (`tests/lib/constraints.ts`):
   - `grenzeNurMitSchema(graph, elternMod, schemas)`: Jeder Fluss über die Grenze eines Kind-Moduls trägt ein
     Schema aus der Liste, und zwischen Kind-Modulen gibt es keinen Fluss.
   - `einAdapterJeAkteur(graph, elternMod, akteure)`: Jeder Fluss zu einem Akteur endet in genau einem Kind-Modul,
     und jedes Kind-Modul bedient genau einen Akteur.
5. **Die ersten `testRefs` im Repo lösen 32 Warnungen R-19 aus.** Alle laufbaren TEST ohne Datei melden ab dann
   „ohne Bindung“, auch Abnahmetests am VPS, die nie eine Datei bekommen. Der Skill sagt nicht, dass das kommt.
6. **Ausgeliefert ist der Skill nicht.** immo-infra steht auf 0.34.0 und hat `se:constraints` nicht.
   Der Agent las die Datei aus dem Repo graphcode.

7. **`se:top-level` hält gleiche Ketten für doppelte Use Cases. Bei einer Plugin-Architektur ist das falsch.**
   Der Skill sagt: Laufen Varianten durch dieselbe Kette, sind sie ein Feld im Vertrag und kein eigener Use Case.
   Der Agent legte deshalb 9 der 11 Use Cases von immo-infra zu 2 zusammen (graphVersion 15). Der Autor hat das
   zurückgenommen: Ein Use Case beschreibt, was eine Person vom System will, unabhängig davon, wie es gebaut ist.
   Er kann mehrere Ketten haben. Laufen alle Plugins durch dieselbe Kette, zeigt das gute Kapselung und kein Doppel.
   Die Prüffrage 2 („Are the use cases disjoint?“) und der Abschnitt „Sub use cases“ brauchen eine Ausnahme: Gleiche
   Ketten sind erlaubt, wenn sich die Use Cases in Akteur, Ziel oder Freigabe-Regel unterscheiden und die Kette über
   eine Plugin-Grenze läuft.

8. **RD-05 arbeitet gegen einen gesetzten Constraint.** In immo-infra (graphVersion 19) meldet RD-05 sieben Adapter
   unter `MOD-immo-gate` mit 1 bis 2 Funktionen („Dissolve the level into its parent“). Legt man sie zusammen, bricht
   der Constraint „ein Adapter je Ziel“ (`REQ-daten-ueber-gate`). Der Skill warnt vor Konflikten zwischen zwei
   Constraints, nicht vor solchen zwischen einem Constraint und einer Regel. `se:optimize` und `se:close-violations`
   würden RD-05 folgen. Nötig ist: Eine Warnung, deren Behebung einen Constraint-Test rot macht, wird als Zielkonflikt
   gezeigt, nicht als Aufgabe (vgl. ITEM-2026-1077).

## Zielbild

- Der Skill fragt **zuerst nach Plattform-Regeln**: „Was muss für jede künftige Anwendung, Datenquelle oder
  Komponente gelten?“ Ein Constraint an einem einzelnen Element geht an `se:author-req`.
- Neue Zeile **Erweiterbarkeit** in der Tabelle. Frage: „Wie kommt ein neues Teil dazu, ohne dass sich der Rest
  ändert?“ Antwortform: „Kind-Module von X sprechen nur über Schemas S“ oder „je Akteur ein Adapter unter X“. Die
  Prüffunktionen sind die beiden aus Befund 4.
- Neuer Abschnitt **Vor dem ersten Schnitt**: Die Elemente, die der Schnitt anlegen muss, werden benannt. Der Test
  ist rot und nennt sie. `se:top-level` liest die Constraints aus `constraintCarriers` und schneidet so, dass sie
  grün werden.
- Hinweis auf R-19 bei den ersten `testRefs`. Ein Abnahmetest ohne Datei braucht eine Regel, wie er sich bindet;
  das ist Sache von contracts (Item an sigloch-modules, falls nötig).

## Änderungen

| Datei | Änderung |
|---|---|
| `.claude/commands/se/constraints.md` | Schritt 2 mit der Frage nach Plattform-Regeln und dem schärferen Kriterium; Zeile Erweiterbarkeit; Abschnitt „Vor dem ersten Schnitt“; Hinweis R-19 |
| `.claude/commands/se/top-level.md` | Constraints aus `constraintCarriers` als Vorgabe für den Schnitt; Ausnahme bei Prüffrage 2 und „Sub use cases“ für gleiche Ketten über eine Plugin-Grenze (Befund 7) |
| `src/kernel/measure/constraints.ts` | `grenzeNurMitSchema`, `einAdapterJeAkteur` mit Befund-Schema |
| `tests/constraints.test.ts` (oder bestehende Datei) | beide Funktionen, je Bruch eine Positivkontrolle |
| `tests/skill-constraints.test.ts` | Feld-Test: Erweiterbarkeit und „Vor dem ersten Schnitt“ stehen im Skill |

## Akzeptanzkriterien

- [ ] Probe: ein Agent mit `se:constraints` auf immo-infra (graphVersion 13) schlägt zuerst Plattform-Regeln vor,
      darunter Plugin-Grenze und Adapter je Ziel; Einzelfälle wie „Website ohne VPS“ verweist er an `se:author-req`
- [ ] `grenzeNurMitSchema` und `einAdapterJeAkteur` sind aus `@sigloch/graphcode/constraints` exportiert;
      immo-infra kann seine lokale Kopie danach löschen
- [ ] `se:top-level` nennt `constraintCarriers` als Eingang des Schnitts
- [ ] Release mit dem Skill, `aise rollout immo-infra` zieht ihn nach

## Umfang laut `graph_impact`

FUNC-se-constraints, FUNC-se-top-level, REQ-constraints-skill-vertrag, TEST-skill-constraints (Kanten am
CR-Knoten setzen, bevor die Lane startet).
