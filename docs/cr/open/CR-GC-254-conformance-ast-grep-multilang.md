# CR-GC-254: Konformanz-Parser auf ast-grep umstellen (Multi-Language) — BACKLOG

**Status:** postponed / backlog (Update 2026-07-26) · **Max Files:** 4
**Trigger:** erst ziehen, wenn das erste Nicht-JS/TS-Repo governed wird. Bis dahin deckt der
TypeScript-Parser (CR-GC-206/253) alle realen Repos ab; Umbau vorher = Rewrite ohne Nutzen.

## Problem (Why)

Der CodeFacts-Extraktor in `src/conformance.ts` (CR-GC-253) nutzt `ts.createSourceFile` — parst
nur JS/TS(X). Ein governetes Python-/Go-/Rust-Repo bekäme für jeden codeRef eine falsche
RC-01-Violation (Symbol nie auffindbar) oder müsste den Check abschalten. Die RC-Regeln selbst
(contracts, pure über CodeFacts) sind sprachneutral — nur der Extraktor ist es nicht.

## Decision

1. Nur den Facts-Extraktor tauschen (Regeln in contracts bleiben unberührt): Symbol-Sammlung via `@ast-grep/napi`
   (tree-sitter): JS/TS/JSX built-in, weitere Sprachen als `@ast-grep/lang-*` +
   `registerDynamicLanguage`.
2. Pro Sprache eine kleine Query-Tabelle „Definition namens X" (function/class/const/method);
   `codeRef.lang` wählt die Query. Unbekanntes `lang` ⇒ file-exists-only + Hinweis (kein
   stiller Pass, keine falsche Violation).
3. Determinismus-Anspruch bleibt: rein syntaktisch, kein LSP-Server, kein Index-Artefakt.
   (SCIP/LSP als spätere Präzisions-Ausbaustufe, siehe Session-Notiz in CR-GC-256.)

## Akzeptanz

- [ ] Bestehende Konformanz-Tests (TS/JS/MJS/JSX) grün ohne Änderung der Erwartungen.
- [ ] Ein Python-Fixture: codeRef auf `def foo` löst auf, auf gelöschtes Symbol ⇒ RC-01.
- [ ] `typescript`-Import aus conformance.ts entfernt (kein Parallelpfad TS-Parser + ast-grep).

## Strukturupdate 2026-07-26 (nach CR-228 C + CR-GC-262)

Der CR bleibt gültig und bleibt gegated, aber zwei Dinge unter ihm haben sich geändert:

- **`codeRef` heißt jetzt `realRef`** (CR-228 C: `codeRef` + `schemaRef` + MOD-`cadRef` vereinigt,
  Element-Typ disambiguiert). Der Extraktor-Tausch betrifft damit *alle* realRef-Träger, nicht nur
  FUNC — die Sprachtabelle muss auch das Symbol einer SCHEMA-Definition auflösen können.
- **`typescript` ist Runtime-Dependency eines publizierten Pakets.** Seit CR-GC-262 kommen
  graphcodes Deps aus der Registry, d.h. der Parser wird bei jedem Consumer-Install
  mitgeladen (~20 MB). Das ist das stärkste Argument für diesen CR und gehört in seine Motivation:
  `@ast-grep/napi` ersetzt nicht nur einen JS/TS-Parser, es nimmt jedem Consumer den
  TypeScript-Compiler aus dem Installationspfad. Die Akzeptanz „`typescript`-Import aus
  conformance.ts entfernt" bleibt damit wortgleich, wiegt aber schwerer.

**Trigger unverändert:** erst ziehen, wenn das erste Nicht-JS/TS-Repo governed wird.
