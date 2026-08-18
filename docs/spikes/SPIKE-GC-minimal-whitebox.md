# SPIKE-GC: Minimal-Whitebox — ist der Blast-Radius zu groß für den nächsten Job?

**Status:** Proposed (2026-08-18)
**Voraussetzung:** keine Implementierung — Arm A0/A/B sind deterministisch aus dem
Selbstmodell rechenbar; nur Arm C braucht den Executor.
**Verwandt:** `SPIKE-GC-context-sufficiency` (Vorgänger, Implementier-Pfad) ·
`docs/LANDSCAPE.md` L1/L2 · `CR-DRAFT-GC-297` (geparkt, s. §7)

## 1. Frage

Der **Blast-Radius** beantwortet „wer bricht, wenn ich das ändere". Das ist **nicht**
dieselbe Frage wie „was muss ich aufmachen, um den nächsten Job zu tun". Der ganze
Zweck des Graphen ist die zweite: **Black-/White-Box-Schnitt mit definierten
Schnittstellen** — genau so viel Innensicht wie nötig, alles andere nur als Vertrag.

> **Zu beweisen:** Es gibt eine **minimale Whitebox** `W(job)` — die Knoten, deren
> Inneres offen sein muss — die eine **echte Teilmenge** des Blast-Radius `B(job)` ist,
> wobei `B \ W` **nur als Schnittstelle** (uid · type · name · SCHEMA/io-Vertrag) in den
> Kontext geht, **ohne** dass der Job schlechter wird.

Der Blast-Radius ist damit nicht falsch, sondern der **Sicherheits**-Begriff (wen muss
ich benachrichtigen). `W` ist der **Arbeits**-Begriff (worin arbeite ich). Heute liefert
graphcode nur den ersten und injiziert im Autorier-Loop nicht einmal den.

## 2. Was bereits gemessen ist (NICHT erneut spiken)

`SPIKE-GC-context-sufficiency` (2026-06-26), Implementier-Pfad, **eine** Zielnode:

| Befund | Zahl |
|---|---|
| `graph_context`-Bundle `FN-slice` | 11 Nodes / 10 Edges / **~667 tok** |
| gegen `graph_elements{300}` | **111× kleiner** |
| gegen das, was die Originalsession aus SPEC.md+Spikes las | ~34k tok |
| qwen3.6-27b implementiert allein aus dem Bundle | **5/5**, ausgeführt, recall 1.0 |

**Untergrenze steht also.** Offen ist alles, was darüber liegt: ein Job über **mehrere**
Knoten (CR-/MS-Größe), und der **Autorier**-Loop statt des Implementier-Loops.

## 3. Der heutige Ist-Zustand (Ausgangspunkt, verifiziert 2026-08-18)

| Pfad | Was tatsächlich in den Prompt/Kontext geht |
|---|---|
| MCP `graph_impact` | Kuzu-Cypher, **eingehende** Kanten (Dependents), Tiefe N — der Blast-Radius, korrekt |
| MCP `graph_context` | Upstream-Spec-Closure einer Node — de facto schon eine Whitebox-Näherung |
| **Executor-Runde** (`buildRoundInjection`) | **`graph_elements({})` = der GANZE Graph**, uid-sortiert, Kappe 8000 Zeichen (~2k tok), bei Überlauf alphabetisch von vorn geschnitten — **keine** Traversierung, **kein** Seed |
| **GVE ImpactMap** | client-seitiger **ungerichteter** Frontier-BFS über den vollen `graph.json`; ruft `graph_impact` **nie** auf |

Drei Begriffe von „relevant", keiner deckungsgleich. Der Autorier-Loop bekommt den
schlechtesten davon.

## 4. Hypothesen (falsifizierbar)

- **H1 — Whitebox ⊊ Blast.** Für einen CR-großen Job gilt `|W| ≤ 40 % · |B|`.
  *Falsifiziert*, wenn der Job das Innere von mehr als 40 % des Blast-Radius braucht —
  dann ist der Blast-Radius selbst schon die Whitebox und der Schnitt trägt nicht.
- **H2 — Blackbox-Suffizienz.** `B \ W` als reine Schnittstellenzeile (uid · type · name
  · SCHEMA/io) genügt: dieselben Akzeptanzkriterien werden erfüllt wie mit vollem `B`.
  *Falsifiziert*, sobald ein Kriterium nur mit Innensicht eines Blackbox-Knotens erfüllbar ist —
  dieser Knoten gehört dann per Definition nach `W`, und die Regel, die ihn dorthin
  bewegt, ist das eigentliche Ergebnis des Spikes.
- **H3 — 20-%-Deckel.** Pro Runde werden **≤ 20 %** der Graph-Knoten in den Kontext
  gezogen (User-Schätzung, hier als Schwelle zum Widerlegen gesetzt, nicht als Spec).
  Gemessen wird der Ist-Wert; 20 % ist der Prüfstein, nicht das Ziel.
- **H4 — Autorieren ≠ Implementieren.** Der Autorier-Loop braucht ein anderes `W` als der
  Implementier-Loop (dort: Upstream-Spec-Closure; hier: existierende uids + Kanten-
  Grammatik der Fokus-Typen, damit keine Duplikate entstehen). *Falsifiziert*, wenn
  `graph_context` unverändert auch den Autorier-Loop trägt — dann ist die
  Executor-Injektion schlicht durch den bestehenden Aufruf zu ersetzen, ohne neues Konzept.

## 5. Arme

Alle Arme laufen gegen **dasselbe Job-Set** (§6) und liefern denselben Artefakt-Typ (§8).

- **A0 — Blast-Radius pur (Kontrolle).** `graph_impact(seed, depth)` wie heute. Misst,
  wie groß `B` überhaupt ist. Kein LLM nötig für die Größenmessung.
- **A — Whitebox + Blackbox-Ring.** `W` in voller Format-E-Tiefe, `B \ W` als
  Schnittstellenzeilen. Der Kandidat.
- **B — Whitebox pur (Falsifikations-Arm).** Blackbox-Ring **weggelassen**. Bricht der
  Job nicht, ist `W` noch kleiner als behauptet und der Ring ist Ballast — das wäre das
  wertvollste Ergebnis des Spikes.
- **C — Executor-Runde mit `W` statt `graph_elements({})`.** Direkte Neumessung gegen die
  CR-GC-293-Baseline (v9/v15/v19/v20), **gleiches** Modell, **gleicher** Prompt. Beantwortet,
  ob der Local-Nachteil aus der *Menge* kam und nicht aus dem *Prinzip* Injektion.

## 6. Job-Set (Fixture)

Reale, abgeschlossene Jobs aus diesem Repo — Ground Truth = die tatsächlich geänderten
Knoten des zugehörigen Commits, nicht eine Schätzung:

1. **1 Knoten, Implementieren** — `FN-slice` aus `SPIKE-GC-context-sufficiency` (bekannte
   Untergrenze, dient als Kalibrierung: der Harness muss hier ~667 tok reproduzieren).
2. **CR-großer Job, Implementieren** — ein abgeschlossener CR mit ≥ 3 berührten FUNC.
3. **Autorier-Job** — ein `graph_generate`-Schritt aus dem Greenfield-Rig
   (`rig/greenfield-systemtest/`), wo die Baseline-Zahlen aus CR-GC-293 herkommen.

## 7. Metriken & Schwellen

| Metrik | Ist (heute) | Schwelle |
|---|---|---|
| `\|B\|` (Blast-Knoten) | zu messen | — (Kontrollgröße) |
| `\|W\| / \|B\|` | n/a | **≤ 0,40** (H1) |
| `\|W\| / \|G\|` Knoten pro Runde | Autorier-Loop: **100 %** (auf 8000 Zeichen gekappt) | **≤ 0,20** (H3) |
| Kontext-Token pro Runde | ~2k Index + Guide | **< 2k, bei besserer Trefferquote** |
| Akzeptanzkriterien erfüllt | Referenz | **= oder besser** (H2) |
| Elemente/Runde, lokales Modell | v15 22 · v9 38 (CR-GC-293) | **≥ 38** (Arm C: Injektion darf nicht mehr kosten) |

## 8. Artefakt (koppelt an die GVE-Anforderung)

Jeder Arm gibt **ein** serialisierbares Slice-Objekt aus — Format-E plus eine Rollenspalte
je Knoten: `seed | whitebox | blackbox`. Dieses Objekt ist zugleich das, was GVE rendert
(→ `CR-DRAFT-GC-365`). **GVE bleibt Viewer**: es rechnet den Schnitt nicht nach, es zeigt
den, den der Agent bekommen hat. Rechnet GVE weiter selbst, driftet die Anzeige per
Konstruktion — genau der am 2026-08-18 gefundene Ist-Zustand.

## 9. Abhängigkeit: `CR-DRAFT-GC-297` ist geparkt

CR-GC-297 wollte den Injektions-Default backend-abhängig machen, weil Injektion Local
Ausbeute kostete. Wenn Arm C zeigt, dass die Kosten aus dem alphabetischen Voll-Index
kamen, ist 297 eine Symptombehandlung an einem Schalter, dessen Ursache verschwindet.
**297 wird nicht implementiert, bis Arm C gelaufen ist.**

## 10. Nicht-Ziele

- Kein Leiden-Clustering, keine Community-Detection (LANDSCAPE „nicht adoptieren").
- Kein neuer ElementType, keine neue TraceType — der Box-Schnitt ist eine **Query**, kein
  Ontologie-Eintrag (sonst Drift-Lock L1/L2).
- Keine Post-hoc-Kompression — das Budget steuert die Traversierung (R12).
