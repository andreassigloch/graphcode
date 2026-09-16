# CR-GC-538: upgrade --check meldet aktuell, obwohl ein Skill fehlt — es vergleicht Versionen statt Bestand

**Status:** 🟠 Open
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
