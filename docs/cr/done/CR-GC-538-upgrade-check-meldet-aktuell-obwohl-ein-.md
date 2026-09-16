# CR-GC-538: upgrade --check meldet aktuell, obwohl ein Skill fehlt — es vergleicht Versionen statt Bestand

**Status:** ✅ Done (2026-09-16)
**Typ:** aus Item ITEM-2026-005 (finding)
**Erstellt:** 2026-09-16
**Item:** bok/items/ITEM-2026-005.json (Lane: code)

---

`graphcode upgrade --check` meldete in bok "aktuell" (exit 0), waehrend se/optimize.md von 31 ausgelieferten Skills fehlte. Es vergleicht drei Versionsnummern — CLI, Repo-Install, Host, alle 0.19.1 — nicht den Artefakt-Bestand.

`graphcode skills sync` fand den Fehlbestand sofort: 1 added, 0 updated, 30 unchanged. Die Gegenzahl EXISTIERT also bereits als SkillSyncResult.added.length; sie wird nur nie gegen die Versionsgleichheit gehalten. Genau die Klasse aus CR-DRAFT-GC-448 §5.4: "jede Kennzahl braucht eine unabhaengig erhobene Gegenzahl, sonst misst sie ihre eigene Existenz."

Der Blindfleck ist strukturell, nicht zufaellig: bok laeuft ueber node_modules/@sigloch/graphcode als SYMLINK auf den graphcode-Arbeitsbaum. Ein dort hinzugefuegter Skill bekommt keinen Versions-Bump, also kann eine reine Versionspruefung ihn PRINZIPIELL nie sehen. se:optimize fehlte seit CR-GC-433 und ist deshalb nie angekommen — das ist zugleich die Ursache fuer CR-DRAFT-GC-448 §4 Punkt 1: nicht "die Werkzeuge schlugen den Modulschnitt nicht vor", sondern das Werkzeug lag nicht im Repo.

Fix: upgrade --check ruft syncSkills im Trockenlauf und meldet added.length > 0 als Drift. Zwei vorhandene Zahlen gegeneinander gehalten, keine neue Rechnung.

Nebenbefund, eventuell eigenes Item: der pre-commit-Hook in graphcode stagt docs/graph selbst dazu und zog eine fremde Zeile aus graphcode.graph.json in Commit f5e4c61 — CR-DRAFT-GC-448 E3, dort bereits benannt.

Herkunft: Lift von se:top-level nach graphcode, bok 2026-08-28.

=== KONSOLIDIERUNG 2026-09-14 ===
Wurzel von ITEM-2026-107: upgrade.ts:158-166 bildet drift nur aus drei graphcode-Versionen (CLI, Repo-Install, Host). aise rollout zieht deklarierte Familienpakete innerhalb des Range nach (aise.mjs stale/blocked) — die Luecke liegt im graphcode-Verb. Buendel E: EIN graphcode-CR (upgrade --check: syncSkills-Trockenlauf + Familienpakete-Bestand), dazu ITEM-2026-094 in graph-view-edit.

=== CR-SCHNITT 2026-09-16 ===
FIX, praezise: upgrade --check ruft syncSkills (src/surface/scaffold.ts:275) im TROCKENLAUF und meldet added.length > 0 als Drift. Beide Zahlen existieren bereits - die Versionsgleichheit und der Fehlbestand -, sie werden nur nie gegeneinander gehalten. Das Urteil sitzt in src/surface/upgrade.ts:244 (drift ? "veraltet" : "aktuell") und bekommt damit eine zweite, unabhaengig erhobene Quelle.

MIT AUFGENOMMEN (graphcode-Haelfte von ITEM-2026-107): dasselbe Urteil darf nicht nur die graphcode-Version messen. Ein Zug, der nur ein anderes Familienpaket bewegt, muss hier ebenfalls als Drift erscheinen - sonst meldet jedes Repo "aktuell", waehrend der Viewer alt bleibt. Beide Aenderungen liegen in derselben Datei, deshalb ein CR statt zwei. Die bok-Seite (aise rollout) bleibt in ITEM-2026-107.

DATEIEN (Modell-Reichweite FUNC-upgrade = 3, plus die Bestandsquelle):
1. src/surface/upgrade.ts - Bestandspruefung ins Urteil
2. src/surface/scaffold.ts - syncSkills mit Trockenlauf-Option, falls noch nicht vorhanden
3. tests/upgrade.test.ts
4. tests/cli.scaffold.test.ts

AKZEPTANZKRITERIEN:
1. Rot zuerst: ein Repo mit gleicher Version, aber fehlendem Skill meldet vor dem Fix "aktuell" und danach "veraltet" mit Nennung des fehlenden Artefakts.
2. Der Trockenlauf schreibt nichts - nach --check ist kein Skill kopiert worden.
3. Ein Zug, der nur ein anderes @sigloch-Paket bewegt, erzeugt Drift im Bericht.
4. Kein Fehlalarm im Normalfall: ein vollstaendiges Repo meldet weiterhin "aktuell".

---

## UMSETZUNG (2026-09-16)

Das Urteil in `upgrade.ts` kam aus EINER Quelle — drei graphcode-Versionsnummern. Jetzt
kommt es aus drei unabhaengig erhobenen:

    drift = versionDrift || missingSkills.length > 0 || staleDeps.length > 0

### Die zweite Quelle: der Artefakt-Bestand

`syncSkills` hat einen Trockenlauf bekommen (`{ dry: true }`) — dieselbe Einteilung, nur
ohne Wirkung. Kein zweiter Pfad: EINE Funktion, ein Schalter. Liefe der Trockenlauf gegen
eine andere Einteilung als der Ernstfall, waere der Bericht wertlos. `removeLegacySkills`
und jedes `mkdir`/`write` sind im Trockenlauf ausgesetzt — `--check` fasst keine Datei an,
auch keine alte.

GEGENPROBE, exakt der Originalbefund nachgestellt (Kopie von boks `.claude/`, daraus
`se/optimize.md` entfernt, neuer Build):

    graphcode upgrade --check - Ziel 0.21.0
      Artefakte    1 fehlen: .claude/commands/se/optimize.md
      Familie      im Range aktuell
      -> veraltet: `graphcode upgrade`
    exit 1

Vorher meldete genau diese Lage `-> aktuell`, exit 0. Und nach dem Lauf lag die Datei
weiterhin NICHT da — der Trockenlauf hat nichts geschrieben.

### Die dritte Quelle: der Stand der Familienpakete

Aus `npm outdated --json`, gefiltert auf `@sigloch/*`: `current` gegen `wanted`, also
gegen das, was der deklarierte Range schon hergaebe. Npms eigene Antwort, keine zweite
Rechnung, kein selbst aufgeloester Range. Damit erscheint ein Zug, der nur contracts oder
den Viewer bewegt hat, hier als Drift, statt dass jedes Repo "aktuell" meldet, waehrend
der Viewer alt bleibt. (Die bok-Seite bleibt ITEM-2026-107.)

### Die Blindheit steht im Bericht, nicht unter einem gruenen Haken

`npm outdated` endet mit Status 1, SOBALD etwas veraltet ist — das ist sein Ergebnis, kein
Fehler. Unterschieden wird an der AUSGABE: parsebares JSON heisst geprueft, alles andere
heisst nicht prueffbar. Und dann steht `Familie NICHT GEPRUEFT` im Bericht statt einer
stillen Null. Ein Urteil ohne Reichweite ist schlimmer als keins.

Die beiden neuen Zeilen stehen IMMER da, auch wenn sie leer sind:

      Artefakte    vollstaendig
      Familie      im Range aktuell

sonst saehe "nicht geprueft" aus wie "nichts gefunden" — dieselbe Lehre wie bei
`importCoverage` (CR-GC-489).

### Rot zuerst

Mit `drift: versionDrift` (dem alten Urteil) fallen genau die beiden neuen Faelle:

    x gleiche Version, aber ein Skill fehlt -> veraltet, und der Bericht NENNT ihn
    x ein Zug, der nur ein anderes @sigloch-Paket bewegt, ist ebenfalls Drift

mit dem neuen sind alle 18 gruen.

### Was an den bestehenden Faellen zu aendern war, und warum

Die 13 bestehenden Faelle liefen in leeren Temp-Repos — die haben naturgemaess keinen
einzigen Skill und meldeten ab sofort alle Drift. Sie bekommen ein `syncSkillsImpl`, das
ein VOLLSTAENDIGES Repo stellt, damit jeder Fall weiter das misst, wofuer er da ist: die
Versionsdrift. Der Fehlbestand hat eigene Faelle. Ausserdem steht `npm outdated` jetzt in
den `calls`-Erwartungen — inklusive im Downgrade-Fall, wo die Liste festhaelt, dass trotz
der Erhebung NICHTS installiert wurde (sie ist read-only).

### Akzeptanzkriterien

1. Rot zuerst und Gegenprobe am echten Bestand: s. o. — "aktuell" vorher, "veraltet" mit
   Nennung des Artefakts nachher.
2. Der Trockenlauf schreibt nichts — als Fall festgenagelt (`--check` gegen die ECHTE
   Bestandsquelle, danach existiert `.claude` nicht).
3. Ein Zug, der nur ein anderes `@sigloch`-Paket bewegt, erzeugt Drift — Fall mit
   `@sigloch/contracts 10.5.0->10.6.0`; ein fremdes Paket daneben wird NICHT mitgezaehlt.
4. Kein Fehlalarm: vollstaendiges Repo mit Familie im Range meldet weiter "aktuell",
   exit 0 — an bok und an graphcode selbst gegengeprueft.

Suite 141 Dateien / 1146 Tests gruen, Build gruen. Der CLI-Exit-Code brauchte keine
Aenderung: `check && report.drift ? 1 : 0` stand schon da — er hatte nur nie etwas
Vollstaendiges zu melden.

### Nebenbefund aus dem CR-Text, nicht hier erledigt

Der pre-commit-Hook, der `docs/graph` selbst dazustagt (CR-DRAFT-GC-448 E3), bleibt offen —
eigener Befund, eigene Datei, gehoert nicht in diesen Schnitt.
