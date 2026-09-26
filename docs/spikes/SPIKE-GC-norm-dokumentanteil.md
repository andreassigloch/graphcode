# SPIKE-GC: Norm-Dokumentanteil — welchen Teil von 15288, 29148 und A-SPICE kann erzeugte Doku überhaupt erfüllen?

**Status:** Abgeschlossen (2026-09-26) — Ergebnis siehe unten
**Voraussetzung:** keine Implementierung — Recherche der Normtexte und Abgleich mit den heute
erzeugten Sichten (`docs/views/*.md`, CR-GC-220-Exporter).
**Verwandt:** A-SPICE-Coverage-Evaluation 2026-08-05 (CR-GC-301, CR-GC-317) · ConOps nach 29148
(CR-GC-304) · graphcode-Leitlinie §2 (Verstehen), §6 (Beweis im Code), T-E5 (Faustregel Effizienz)

## 1. Frage

graphcode erzeugt aus dem Modell deterministisch eine Dokumentfamilie: SRS, ConOps, Architektur,
ICD, RTM, VCRM, Test- und Integrationsplan, Implementierungsplan, NFR-Register, FMEA,
Trade Studies, Change Log. Der Claim lautet: **diese Dokumentation ist kompatibel zu den
Anforderungen der gängigen Systems-Engineering-Normen** (ISO/IEC/IEEE 15288, ISO/IEC/IEEE 29148,
Automotive SPICE).

Die Normen sind überwiegend **Prozessnormen**. Ein Dokument kann keine Aktivität, Rolle,
Planung, Freigabe oder Prozessfähigkeit nachweisen. Der Claim ist deshalb nur für den Teil
prüfbar, der **Inhalt eines Informationsobjekts** ist.

> **Zu klären:** Welche Anforderungen der drei Normen betreffen den Inhalt von Dokumenten
> bzw. Informationsobjekten — und welche davon deckt eine heute erzeugte Sicht ab
> (ja / teilweise / nein)? Was ist reine Prozessanforderung und damit außerhalb jedes
> Dokument-Claims?

## 2. Methode

1. **Normen zerlegen** (Primärquellen bevorzugt: iso.org, ieee.org, vda-qmc.de):
   - 29148: Informationsobjekte (BRS, StRS, SyRS, SRS, ConOps, OpsCon) mit Gliederung;
     Eigenschaften einzelner Anforderungen und von Anforderungsmengen; Attribute; Traceability.
   - 15288: Prozessnorm — Outcomes je technischem und technischem Management-Prozess, die sich
     in einem Informationsobjekt niederschlagen; Inhaltsdefinition über ISO/IEC/IEEE 15289.
   - A-SPICE 4.0 (PAM): Base Practices zu Inhalt, Konsistenz und bidirektionaler
     Traceability in SYS.1–5, SWE.1–6, SUP.1/8/9/10, MAN.3/5; Output-Informationsobjekte
     (Annex B). Capability Level 2+ ist Prozessmanagement, kein Dokumentinhalt.
2. **Klassifizieren:** je Anforderung *Dokumentinhalt* · *prüfbare Eigenschaft eines Dokuments*
   (z. B. Konsistenz, Vollständigkeit der Traceability) · *Prozess*.
3. **Abgleichen:** je Dokument-Anforderung die erzeugte Sicht und die Regel, die sie
   deterministisch prüft (R-18 Legalität, R-19/R-20 Bindung, RC-* Kongruenz, Readiness).
4. **Gegenprobe frei laufendes Frontier-Modell:** Kann ein Lauf ohne Modell die belegbaren
   Anforderungen erfüllen? Kriterium: bidirektionale Traceability und Konsistenz sind aus seinen
   Artefakten **deterministisch** nachweisbar, nicht nur behauptet.

## 3. Abbruch- und Ergebniskriterium

- **Ergebnis:** eine Tabelle Norm-Anforderung → Art → erzeugte Sicht → prüfende Regel → Urteil,
  dazu der Anteil der Dokument-Anforderungen, den graphcode heute belegt.
- **Nicht Ergebnis:** eine Konformitätsaussage zur Norm als Ganzes — die ist ohne
  Prozessnachweis und Assessment nicht zu haben und wird nicht behauptet.
- Nicht verifizierbare Normstellen werden als solche markiert, nicht geschätzt.

Ergebnis: [`SPIKE-GC-norm-dokumentanteil-RESULTS.md`](SPIKE-GC-norm-dokumentanteil-RESULTS.md).
