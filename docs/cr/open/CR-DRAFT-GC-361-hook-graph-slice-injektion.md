# CR-GC-361 — PreToolUse-Graph-Slice-Injektion (Discovery-Pfad)

**Status:** draft
**Datum:** 2026-08-18
**Kontext:** `docs/LANDSCAPE.md` L1 (GitNexus-Muster). Heute existieren zwei
benachbarte, aber andere Dinge: `deny-stale-prose-read.sh` (CR-GC-214) ist
PreToolUse auf `Read`, aber **deny + redirect** — es zeigt auf den Graph, ohne
die Scheibe zu liefern; CR-GC-285 injiziert Guide/Index in den **eigenen**
Executor-Prompt, nicht in einen fremden Harness pro Tool-Call. graphengine hat
es ebenfalls nicht (dort: `claude-flow hooks pre-edit --load-context`, Matcher
`Write|Edit|MultiEdit`, generischer Memory-Loader auf dem Write-Pfad).

## Ziel

Auf dem **Discovery**-Pfad (`Grep|Glob`, optional `Read`) vor dem Tool-Call die
passende Graph-Scheibe in den Kontext schieben — der Graph wird Default statt
Wahl des Agents. Damit schließt sich die Anti-grep-These (R6/R12) auf der
Verhaltensseite, nicht nur auf der Tool-Angebotsseite.

## Constraint-kritischer Entwurfspunkt (nicht verhandelbar)

Der Hook darf **kein zweites Kuzu-Handle** öffnen (ein Owner-Prozess pro Repo).
Er liest deshalb über die bestehende **read-only Host-Bridge** (`src/viewer/host.ts`,
Loopback-only, `GET /elements`, `GET /subgraph/:root`). Kein neuer CLI-Verb, der
den Store aufmacht. Fehlt die Bridge (Host läuft nicht) → Hook ist ein No-op mit
Exit 0, **nie** ein Block.

Offener Entwurfspunkt: `/subgraph/:root` braucht eine Node-uid, der Hook hat ein
Grep-Pattern/Pfad. Entweder Resolve über `GET /elements` clientseitig oder ein
neuer read-only `GET /resolve?q=` auf der Bridge — im CR entscheiden, nicht beides.

## Messvorbehalt (Blocker für „Default an")

CR-GC-293 hat gemessen: Injektion **nützt Frontier** und **kostet Local Ausbeute
+ Breite** (v15 22 vs. v9 38 Elemente; v20-noinject 40 El. inkl. MOD/FLOW vs.
v19 31). Siehe `CR-DRAFT-GC-297`. Dieser CR liefert den Schalter **default aus**
und die Messung; das Einschalten ist ein Folge-CR, kein Teil hiervon.

## Dateien (≤6)

- `.claude/hooks/inject-graph-context.sh` (neu)
- `.claude/settings.json`
- `src/viewer/host.ts` (nur falls `GET /resolve` gewählt wird)
- `tests/hooks.inject-graph-context.test.ts` (neu)

## Akzeptanzkriterien

- [ ] Hook ohne laufende Bridge → Exit 0, keine Ausgabe, Tool-Call läuft normal
- [ ] Hook mit laufender Bridge + treffendem Pattern → Format-E-Scheibe auf stdout,
      Exit 0 (nie Exit 2 — das ist der Deny-Hooks vorbehalten)
- [ ] Unit-Test belegt: **kein** zweites Kuzu-Handle (Store-Lock bleibt beim Host)
- [ ] Schalter `GRAPHCODE_HOOK_INJECT` **default aus**; Test beide Richtungen
- [ ] Messlauf gegen CR-293-Baseline dokumentiert (Frontier + Local), Zahlen im CR
- [ ] `npm run build` + Tests grün

---

## Blockiert (2026-08-18)

**Nicht implementieren, bis `SPIKE-GC-minimal-whitebox` abgeschlossen ist.** Der Spike
definiert, *was* die Scheibe ist (Rollen `seed | whitebox | blackbox`, §8) und *wie groß*
sie sein darf (H3). Vorher gebaut, würde dieser CR gegen eine Scheibe implementieren, die
der Spike gerade widerlegen soll. Auch **keine** weiteren CRs zu diesem Thema anlegen,
bis das Ergebnis vorliegt.
