# CR-GC-301 — A-SPICE-Nachschärfungen: R-21-Level-Check, Auditor-Sicht, SUP.9/SUP.10

**Status:** draft — nicht beauftragt (Familie-Review ausstehend)
**Datum:** 2026-08-05
**Kontext:** A-SPICE-Coverage-Evaluation vom 2026-08-05
(`docs/articles/img/aspice-coverage.svg`). Ergebnis: Engineering-Prozesse
(SYS.2–SYS.5, SWE.1–SWE.6) + SUP.1/SUP.8 + MAN.3 sind durch Ontologie, Regeln
und Views abgedeckt — die Evidenz liegt teils transitiv im Graph (Level =
Compose-Anker, Unit = TEST→REQ→FUNC-Walk, Integrationsabdeckung =
TEST→REQ→FCHAIN→FUNC-Paar). Vier Nachschärfungen bleiben.

## Befund

1. **R-21 prüft das Test-Level nicht.** `fchainMustHaveIntegrationTest`
   (contracts `rules.ts`) akzeptiert JEDEN verify-TEST auf dem
   FCHAIN-satisfy-REQ — ein Unit-Test erfüllt die Integrations-Regel.
   `testRef.level` existiert (CR-GC-134), wird aber nicht konsultiert.
2. **Keine Auditor-Sicht auf die transitive Evidenz.** Ein Assessor sieht die
   Levels (SYS-Anker vs. UC-Anker vs. REQ→REQ-Ableitung) und die
   Integrationsabdeckung nur per Graph-Walk. GVE rendert versteckte
   Kettenglieder bereits als „rolled-up"-Link — die deterministischen Views
   (CR-GC-220-Exporter) tun das nicht.
3. **SUP.9 ohne Heimat:** `testResult: failed` löst keine Obligation aus.
   VR-01 flaggt nur FEHLENDE Ergebnisse.
4. **SUP.10 dünn:** CR-Status nur `open/done` — keine
   Analyze/Approve/Confirm-Evidenz; Audit-Trail loggt Autor, nicht Freigabe.

## Ziel (3 Pakete — vor Implementierung splitten, Max-6-Dateien-Regel)

### Paket A — contracts (→ CR-SM-xxx, RULES_VERSION-Bump + Familie-Review)

- **R-21-Schärfung:** der verifizierende TEST der FCHAIN-Kette muss
  `testRef.level ∈ {integration, validation}` tragen; sonst neue Violation
  „connection covered only by non-integration test" (warning, Dimension `ver`,
  Phase TRR).
- **Neue Regel PR-01 (SUP.9):** TEST mit `testResult: failed` muss von einem
  offenen CR getrackt sein (`CR --relation--> TEST` fehlt im TRACE_PATTERNS —
  Alternativen prüfen: bestehendes `CR→REQ`-Tracking auf das verifizierte REQ
  genügt evtl. ohne Pattern-Bump). Severity warning, Dimension `cr`, Phase TRR.
- Kein neuer ElementType, kein Problem-Lifecycle — bewusst minimal.

### Paket B — graphcode: Auditor-Sicht (`se-view:aspice` oder RTM/VCRM-Ausbau)

- **RTM-Gruppierung nach Level:** System-REQs (SYS-compose), funktionale REQs
  (UC-compose), abgeleitete REQs (REQ→REQ-compose) als Ebenen ausweisen —
  SYS.2-vs-SWE.1-Trennung ohne Graph-Walk sichtbar.
- **Rolled-up-Integrationsmatrix:** pro FUNC→FLOW→FUNC-Verbindung die
  abdeckenden TESTs über die Kette TEST→REQ→FCHAIN→FUNC-Paar als direkten
  „covers"-Link rendern (GVE-Rolled-up-Semantik), inkl. `testRef.level` und
  `testResult`.
- Dünner Trigger des CR-GC-220-Exporters, deterministisch — kein neues
  Rendering-Framework.

### Paket C — SUP.10-Evidenz (Entscheidung nötig, ggf. verwerfen)

- Optionen: (a) CR-Status-Enum erweitern (`open → approved → done`),
  (b) Freigabe nur als Attribut (`approvedBy`/`approvedAt`) + Audit-Trail,
  (c) organisatorisch belassen (CR-Markdown-Review), Graph unverändert.
- Meta-Modell-Änderung (a) = contracts-Bump + Gate-Migration — nur mit
  explizitem Familie-Review. Empfehlung: (b) oder (c).

## Akzeptanzkriterien (bei Beauftragung je Paket konkretisieren)

- [ ] R-21 unterscheidet Test-Level; bestehende Graphen mit korrekt gelevelten
      Integration-TESTs bleiben violation-frei (Regressionstest rasentraktor)
- [ ] Failed-TEST ohne CR-Tracking erzeugt sichtbare Violation in
      `rules_evaluate`/`readiness`
- [ ] Auditor-View zeigt REQ-Levels und Integrationsmatrix ohne manuelle
      Graph-Walks; Render deterministisch (Snapshot-Test)
- [ ] SUP.10-Entscheidung dokumentiert (auch wenn Ergebnis „belassen")
- [ ] SVG `docs/articles/img/aspice-coverage.svg` nach Umsetzung
      aktualisieren (SUP.9/SUP.10-Färbung)

## Abhängigkeiten

- Paket A vor Paket B sinnvoll (View rendert die neuen Violations mit), aber
  nicht zwingend — B funktioniert auch auf Bestandsregeln.
- Drift-Lock L1/L2: alle contracts-Änderungen publizieren (Registry-Range),
  nicht linken.
