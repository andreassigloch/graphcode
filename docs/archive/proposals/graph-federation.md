# Graph-Föderation über Repos — Föderation statt Fusion

**Status:** Proposal, angelegt 2026-08-16 · **NICHT GESTARTET**
**Herkunft:** Review 2026-08-16 (`docs/review.md`), Maßnahme 7 („die Familie ist in keinem
Graphen") + Frage: graphcode importiert sigloch-modules und GVE als Subsystem — wie werden die
Graphen für übergreifende Wirkketten und Changes verbunden, ohne ein Riesenmodell zu erzeugen?

---

## Leitidee

**Die Graph-Topologie spiegelt die Paket-Topologie.** Die Familie hat die Frage „ein Riesending
oder versionierte Grenzen?" für den Code beantwortet: Registry-Deps mit gepinnten Ranges statt
Monorepo (CR-GC-262). Die Graphen folgen derselben Entscheidung — gleiche Grenzen, gleiche
Versionierungssemantik, **ein** Mechanismus zum Lernen statt zwei.

Basis-Asset: jedes Repo hat bereits einen **deterministischen, committeten Export**
(`docs/graph/<repo>.graph.json`) — versioniert, adressierbar, lesbar ohne den fremden Store
anzufassen. Single-Writer-Kuzu bleibt unverletzt.

---

## Baustein 1 · Boundary-Import: ICD-Proxies statt Vollimport

- Das Sibling-Repo deklariert eine **Export-Surface**: die Teilmenge seiner
  FUNC/FLOW/SCHEMA/MOD, die nach außen sichtbar ist — das Graph-Pendant zu den Subpath-Exports
  aus CR-SM-230. Dessen Satz gilt wörtlich: *muss ein Consumer deinen ganzen Graphen
  importieren, ist deine Surface kaputt.*
- Der Konsument importiert davon **Proxy-Knoten** durchs eigene Gate: echte lokale Elemente mit
  `origin: {repo, version|sha, importedAt}`, angehängt als `SYS-graphcode compose SYS-gve`
  (`SYS compose SYS` ist legales TRACE_PATTERN).
- Cross-Repo-Kanten (FLOW, satisfy, allocate) enden **lokal am Proxy** — nie im fremden Store.

Übergreifende Wirkketten sind damit lokal modellierbar: die FCHAIN referenziert Proxies, das
Ebenen-Rollup aus `SPIKE-GC-abstraction-levels` funktioniert unverändert; Drill-Down über den
Proxy hinaus = dem `origin`-Zeiger in den fremden Export folgen.

## Baustein 2 · Übergreifende Darstellung: Union zur Renderzeit, nie persistiert

Ein Viewer/Exporter lädt N committete Exports + den lokalen Store, vereinigt sie **im Speicher**
(Schlüssel `repo:uid`) und rendert die Kette über die Grenze. Deterministisch, weil die Exports
es sind; flüchtig, weil Projektion. GVE bekäme einen **Workspace-Modus** (mehrere
graph.json-Quellen) — Nesting/Collapse dort ist dann genau der Repo-Drill-Down.

## Baustein 3 · Changemanagement: der Familiengraph als dünner Koordinationsgraph

- Ein **kleiner** Graph (Heimat: bok oder Mini-Repo, ~20 Knoten) mit Repos/Paketen als Knoten,
  Versions- und Consumer-Kanten — deterministisch generiert aus package.json + Registry
  (graphify-Prinzip, angewandt auf die Familientopologie). Kein Riesenmodell.
- **Proxy-Version = Change-Event.** Publiziert das Sibling einen neuen Export, ist der
  Consumer-Ablauf ein „graph install": Boundary neu einlesen, Diff gegen die Proxies,
  Gate-Merge. Der Diff **ist** das ICD-Delta — additiv vs. breaking wird sichtbar, bevor der
  Host nicht mehr startet.
- Regel „Proxy älter als Sibling-Export" (warning): Konsumenten-Lag wird Graph-Aussage statt
  CR-Fußnote. GVE-zwei-Majors-zurück (CR-GVE-230) wäre feuernd sichtbar gewesen.
- Sibling-CRs (Muster CR-GC-351↔CR-SM-240) bekommen im Familiengraph ihre Kante statt
  Prosa-Relativpfade.

---

## Zugriffskontrolle (perspektivisch, fällt aus dem Schnitt ab)

- **Write:** nur durchs lokale Gate; das Gate weist Mutationen an Elementen mit
  `origin ≠ local` ab — erzwungen als Guard in `mutate()`, nicht dokumentiert.
- **Read:** Zugriff auf den committeten Export = Repo-/Package-Sichtbarkeit. Keine neue
  Auth-Schicht — git/npm-Permissions wiederverwendet; der public/internal-Split von graphcode
  demonstriert das Prinzip.
- **Feiner später:** die Export-Surface ist der natürliche Filter — was nicht deklariert ist,
  verlässt das Repo nicht.

---

## Warum nicht das Riesenmodell

Es wäre der einfachste Weg für die Darstellung — und verliert alles andere:

1. Single-Writer-Kuzu macht den gemeinsamen Store zum Schreib-Flaschenhals (verriegelter
   Constraint).
2. Jede Repo-Grenze als Zugriffsgrenze müsste im Modell neu erfunden werden statt git/npm zu
   erben.
3. Die Hub-Wellen-Dynamik der Reparaturwoche (08/2026) wiederholte sich auf Graph-Ebene: jeder
   Ontologie-Bump migriert dann **ein** Riesenmodell statt n kleiner Graphen an ihren eigenen
   Grenzen.

Die Union zur Renderzeit (Baustein 2) liefert die Riesenmodell-*Sicht*, ohne seine Kosten zu
speichern.

---

## Offene Entscheidungen

1. **uid-Namespacing** — qualifizierte IDs (`sm:FUNC-evaluate`) vs. `origin`-Attribut bei
   lokaler uid-Konvention.
2. **Surface-Deklaration** — Attribut am Element (`exported: true`) vs. eigene Manifest-Datei.
   Empfehlung: Attribut + `graph_export --surface`-Filter (eine Quelle, kein Parallelpfad).
3. **Heimat des Familiengraphen** — bok vs. Mini-Repo.
4. **Proxy-Granularität** — nur Knoten oder auch Surface-interne FLOWs (für Wirkketten
   vermutlich nötig).

## Abhängigkeiten / Reihenfolge

`SPIKE-GC-abstraction-levels` zuerst: die Ebenen-/Rollup-Mechanik ist die Darstellungsgrundlage,
auf der Proxies und Union erst Wert liefern. Danach Baustein 3 (billigster, schließt
Review-Maßnahme 7), dann 1, dann 2.

@author andreas@siglochconsulting
