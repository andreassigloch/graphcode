# CR-GC-308 — `scripts/export-graph.mjs` ist tot: Canonicity-Guard kennt den graphVersion-Stamp nicht

**Status:** open · **Angelegt:** 2026-08-08 · **Max Files:** 3
**Gefunden:** 2026-08-07 beim Re-Export im Rahmen von CR-GC-304.

## Problem

`node scripts/export-graph.mjs` bricht auf diesem Repo **immer** ab:

```
⛔ export-graph: re-export of the SSOT is NOT byte-identical to
   docs/graph/graphcode.graph.json. The graph file is not in canonical
   form (or was hand-edited off-canon). Refusing to render views.
```

Der Guard importiert die committete SSOT, exportiert sie neu und vergleicht Byte für
Byte. Die einzige Differenz ist der **Trailer**:

```diff
    }
  ]
- ,
- "graphVersion": 52
  }
```

CR-GC-300 hat `graphVersion` als Stamp in den `graph_export`-Pfad aufgenommen. Das
Skript kennt das Feld nicht (`grep graphVersion scripts/export-graph.mjs` = 0 Treffer)
und ruft `exportGraphJson()` ohne Version auf. Damit kann der Vergleich auf **keiner**
SSOT mehr passen, die über den MCP-Export entstanden ist — also auf keiner aktuellen.

## Impact

- Das Skript ist unbenutzbar. Es ist trotzdem der Pfad, auf den der `GENERATED`-Header
  **jeder** der 15 Views zeigt: *„Re-render on model change: node
  scripts/export-graph.mjs"*. Wer der Anweisung folgt, bekommt einen Abbruch, der nach
  einem korrupten SSOT klingt — obwohl der SSOT in Ordnung ist. Falscher Alarm auf dem
  einen Pfad, den die Doku als kanonisch ausweist.
- Kein Datenverlust, keine falschen Views: der Guard verweigert, er beschädigt nichts.
- Workaround heute: die Views direkt über `exportMarkdown` rendern (so geschehen in
  CR-GC-304/306) oder `graph_export` über MCP nutzen. Beides umgeht den Guard, statt
  ihn zu erfüllen — der Zustand darf nicht bleiben.

## Zu klären, bevor implementiert wird

Welche der beiden Rollen der Guard haben soll — das ist eine Entscheidung, keine
Fleißarbeit:

- **A: Guard vergleicht stamp-blind.** Vor dem Vergleich `graphVersion` auf beiden
  Seiten abziehen. Der Guard prüft dann Kanonizität des *Inhalts*; die Version ist
  Metadatum und bewusst außerhalb. Klein, hält ohne weitere Bumps.
- **B: Skript stampt mit.** Das Skript liest die vorhandene `graphVersion` und reicht
  sie an `exportGraphJson` durch — Byte-Identität inklusive Stamp. Strenger, aber das
  Skript hat keinen Store, kann also nur den *committeten* Stand spiegeln und nie
  verifizieren, dass er zur Live-Version passt.

**Empfehlung: A.** Der Guard existiert gegen Hand-Edits am SSOT, nicht gegen einen
Versions-Trailer. B täuscht eine Prüfung vor, die das Skript ohne Store nicht leisten
kann.

## Akzeptanzkriterien

- [ ] `node scripts/export-graph.mjs` läuft auf diesem Repo durch und schreibt die
      15 Views
- [ ] Test: eine SSOT **mit** `graphVersion`-Stamp passiert den Guard
- [ ] Test: eine SSOT mit einem **echten** Hand-Edit (geänderte Beschreibung,
      umsortierte Elemente) wird weiterhin abgelehnt — der Guard darf nicht durch
      Aufweichen „repariert" werden. **Dieser Test ist der eigentliche Punkt des CRs**
- [ ] `docs/graph/graphcode.graph.json` bleibt unverändert (das Skript rendert Views,
      es schreibt den SSOT nicht um)
- [ ] `npm run build` + volle Suite grün

## Dateien (3)

1. `docs/cr/open/CR-GC-308-export-graph-guard-vs-graphversion-stamp.md` (dieses Dokument)
2. `scripts/export-graph.mjs`
3. eine Testdatei für den Guard (heute gibt es keine — er ist ungetestet, was erklärt,
   warum CR-GC-300 ihn brechen konnte, ohne dass etwas rot wurde)

## Nebenbefund (kein Teil dieses CRs)

Ein laufender MCP-Server bedient `graph_export` aus **seinem** `dist` zum
Startzeitpunkt. Nach einer Renderer-Änderung schreibt er die alte Fassung zurück —
beim Verifizieren von CR-GC-304 hat er `conops.md` zweimal auf den Vor-Stand
zurückgesetzt. Kein Bug, aber eine Falle: nach einem Exporter-Change gehört der Host
neu gestartet, sonst prüft man den alten Code.
