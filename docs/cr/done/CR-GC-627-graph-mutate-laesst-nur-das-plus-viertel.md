# CR-GC-627: graph_mutate laesst nur das Plus-Viertel von Format-E durch — Loeschen und Aendern kosten den dreifach teureren commands-Modus

**Status:** ✅ Done  
**Abgeschlossen:** 2026-09-23
**Typ:** aus Item ITEM-2026-504 (bug)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-504.json (Lane: code)

---

## Befund

Format-E ist eine **Operationssprache**, nicht nur ein Graph-Format. Der Parser kennt vier
Präfixe (`format-e-codec.js:15-17`):

| | Parser-Op | Gate-Op (`MutateCommandSchema`) |
|---|---|---|
| `+` | `add_node` / `add_edge` | `add-node` / `add-edge` |
| `-` | `remove_node` / `remove_edge` | `delete-node` / `delete-edge` |
| `~` | `update_node` | `update-node` |
| `a + b` | `merge_nodes` | `merge-nodes` |

Bis auf `update-edge` ist die Abbildung **eins zu eins**. graphcode nimmt trotzdem nur `+` an.

**Wo es verloren geht:** `formatEToCommands` (`src/surface/write.ts:310`) schickt den Text durch
`gcCodec.decode()`, und das rekonstruiert einen **Graph** — eine Menge `{nodes, edges}`. Ein Graph
kann „diese Knoten existieren" ausdrücken, nicht „diesen löschen". `codec.ts:202-209` wirft
deshalb bei jedem Nicht-Add-Op:

```
GraphCodeCodec.decode: operation "update_node" is not supported for Graph reconstruction.
```

Immerhin ein Wurf, kein stiller Verlust. Aber die Beschränkung ist graphcodes eigene, keine
Eigenschaft der Sprache — und die Werkzeugbeschreibung dokumentiert sie seither als wäre sie eine:
*„Deletes/updates/merges brauchen weiterhin commands."*

**Was sie kostet**, gemessen an zwei Rig-Läufen, Zeichen je geschriebenem Element:

| Lauf | `commands` | `formatE` |
|---|---:|---:|
| opus5-0 (23.09.) | 279 | **84** |
| opus5-16 (22.09.) | 223 | **94** |

Faktor 2,4 bis 3,3. Dazu: im `commands`-Modus gibt es den Kanten-Fan-out aus CR-GC-625 nicht —
jede Kante ist dort ein eigenes Objekt. Wer löscht oder ändert, zahlt beides.

## Zielbild

`formatEToCommands` bildet die **Parser-Ops** direkt auf `MutateCommand`s ab (`codec.inner.parse()`),
statt den Umweg über die Graph-Rekonstruktion zu nehmen. `decode()` bleibt, was es ist: der Leseweg
für Encode-Ausgabe (Round-Trip, `graph_export`).

Ein Weg, nicht zwei: `commands` bleibt die programmatische Form, `formatE` wird die vollständige
Textform desselben Gates. Kein neuer Op, kein neues Verdict — dasselbe `harness.mutate()`.

**Vorsicht, und deshalb rote Tests je Op-Art zuerst:**

- `-` wird ein **destruktiver** Op am Gate (`OP_RISK.destructive`). Die Audit-Spur muss ihn als
  solchen führen, nicht als Add.
- `delete` und `add` derselben uid in EINEM Batch bleiben verboten — `persist` schreibt Deletes
  zuletzt, die Reihenfolge würde den Store auseinanderlaufen lassen (bekannt aus `import-code`).
- `update-edge` hat **kein** Format-E-Präfix. Das bleibt so: eine Kante umzuhängen ist kein
  Textzug. Wer das braucht, nimmt `commands` — und das steht dann als der EINE verbleibende Grund
  in der Beschreibung, statt als pauschale Aussperrung.

## Mitzuändern — sonst bleibt die alte Regel im Umlauf

- **Werkzeugbeschreibung** `graph_mutate.formatE` (`write.ts:79`): der Satz „Deletes/updates/merges
  brauchen weiterhin commands" wird falsch.
- **Skill** `.claude/commands/se/generate.md:16`: *„JSON nur für deletes/updates/merges."*
- **`graph_authoring_guide`**: der Musterblock zeigt heute nur `+`. Mindestens `-` und `~` gehören
  als kommentierte Zeile dazu (dieselbe Stelle, die CR-GC-625 um den Fan-out erweitert hat).
- **Regelmatrix** `docs/research/regel-matrix.*`: nicht betroffen — sie führt Regeln, keine
  Werkzeugmodi. Geprüft, nicht angenommen.

## Akzeptanzkriterien

- [x] Ein Format-E-Block mit `-`, `~` und einer Merge-Zeile läuft durch `graph_mutate` und erzeugt
      `delete-node`/`delete-edge`, `update-node` und `merge-nodes` am Gate
- [x] Je Op-Art ein Test, der VOR dem Fix rot ist (heute: Wurf aus der Graph-Rekonstruktion)
- [x] Die Audit-Spur führt `-` als destruktiv — mit Test gegen `OP_RISK`, nicht gegen die Absicht
- [x] `delete` + `add` derselben uid in einem Batch wird weiterhin abgelehnt
- [x] `decode()` bleibt unverändert und wirft weiter bei Nicht-Add-Ops (es ist der Leseweg)
- [x] Beschreibung, Skill und Authoring-Guide sagen dasselbe wie der Code — geprüft durch den
      Registry-Test aus CR-GC-623, erweitert um die Op-Präfixe
- [x] Testsuite grün

## Umfang

`src/surface/write.ts`, `src/projections/authoring-example.ts`, `.claude/commands/se/generate.md`,
`tests/mutate.formate-ops.test.ts` (neu), `tests/mutate.formate-name.test.ts` — 5 Dateien.

---

## Umsetzung (2026-09-23)

`formatEToCommands` bildet die Parser-Ops jetzt direkt ab (`codec.inner.parse()`); der Umweg über
die Graph-Rekonstruktion ist weg. `decode()` blieb unangetastet — es ist der Leseweg, und
Encode-Ausgabe kennt nur `+`.

**Was beim Bauen anders kam als im Entwurf:**

- **`remove_node` trägt kein `elementType`.** Der Parser reicht die `### <TYPE>`-Sektion bei einer
  Löschzeile nicht durch (`parseNodeLine` pusht `{type:'remove_node', semanticId}`). Der geplante
  Typ-Abgleich lief dort also ins Leere. Statt des Typs wird die EXISTENZ geprüft: `applyCommands`
  löscht einen unbekannten Knoten still, und ein stiller Löschzug auf einen Tippfehler ist genau
  die Klasse, die hier nicht durchgehen darf.
- **Die Kommandos kommen in vier Phasen** (Knoten schreiben → Kanten → Merges → Knoten löschen),
  nicht in Zeilenreihenfolge. `GraphStore.commit` schreibt Upserts vor Deletes; ein Löschzug am
  Ende ist damit derselbe Zug im Kandidaten wie auf der Platte.
- **Der Batch-Widerspruch gilt auch für KANTEN.** Dieselbe Kante zu löschen und anzulegen hat
  dieselbe Persistenz-Falle wie bei Knoten (Upserts vor Deletes) — beide werden abgelehnt.

**Abweichung vom Umfang:** der Gleichklang von Beschreibung, Guide und Code wird in
`tests/mutate.formate-ops.test.ts` geprüft, nicht durch Erweiterung von
`tests/tool-description-params.test.ts` (CR-GC-623). Grund: das Op-Wissen liegt in der neuen Datei,
und so bleibt der Umfang bei 5 Dateien statt 6. Geprüft wird dasselbe — jedes in der Beschreibung
genannte Präfix läuft im selben Test durchs lebende Gate.

**Positivkontrolle:** mit dem `decode()`-Umweg sind 11 der 15 Fälle rot, mit genau jener
Codec-Meldung (`operation "update_node" is not supported for Graph reconstruction`).
