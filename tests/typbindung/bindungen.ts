// erzeugt aus dem Modell (graphcode typbindung) — je Blatt-FUNC die Signatur gegen Anfrage- und Antwort-SCHEMA.
// Nicht von Hand ändern, neu erzeugen. Der Typprüfer (npm run type-check) meldet jede Abweichung (CR-GC-1026).
import { z } from 'zod/v4';
import { loadGraphcodeConfig as fn_FUNC_load_config } from '../../src/kernel/config.js';
import { readinessOf as fn_FUNC_compute_readiness } from '../../src/kernel/evaluation.js';
import { clearExportPending as fn_FUNC_export_marker_clear, setExportPending as fn_FUNC_export_marker } from '../../src/kernel/export-marker.js';
import { ExportPending as ExportPending_SCHEMA_export_pending } from '../../src/kernel/export-pending-contract.js';
import { formatEToCommands as fn_FUNC_decode } from '../../src/kernel/format-e-commands.js';
import { HarnessHandle as HarnessHandle_SCHEMA_harness_handle } from '../../src/kernel/harness-handle-contract.js';
import { OntologyJsonSchema as OntologyJsonSchema_SCHEMA_ontology_json, RejectedTraceSchema as RejectedTraceSchema_SCHEMA_rejected_trace, applyReseed as fn_FUNC_apply_reseed, heldBackTraces as fn_FUNC_held_back_traces, seedFromJsonFile as fn_FUNC_seed_from_json } from '../../src/kernel/harness-import.js';
import { AdapterBefund as AdapterBefund_SCHEMA_adapter_befund, EingangsBefund as EingangsBefund_SCHEMA_eingangs_befund, GrenzBefund as GrenzBefund_SCHEMA_grenz_befund, einAdapterJeAkteur as fn_FUNC_ein_adapter_je_akteur, eingaengeNurAus as fn_FUNC_eingaenge_nur_aus, grenzeNurMitSchema as fn_FUNC_grenze_nur_mit_schema } from '../../src/kernel/measure/constraints.js';
import { FitAdvisory as FitAdvisory_SCHEMA_fit_advisory, computeFitAdvisory as fn_FUNC_fit_advisory } from '../../src/kernel/measure/fit-advisory.js';
import { SteeringDelta as SteeringDelta_SCHEMA_steering_delta, SteeringSnapshotSchema as SteeringSnapshotSchema_SCHEMA_steering_snapshot, computeSteeringDelta as fn_FUNC_compute_steering_delta, takeSteeringSnapshot as fn_FUNC_take_steering_snapshot } from '../../src/kernel/measure/steering-snapshot.js';
import { CodeLanePlanSchema as CodeLanePlanSchema_SCHEMA_code_lane_plan, TestImpactAnfrageSchema as TestImpactAnfrageSchema_SCHEMA_test_impact_anfrage, TestImpactResultSchema as TestImpactResultSchema_SCHEMA_impacted_tests, impactedTests as fn_FUNC_select_tests } from '../../src/kernel/measure/test-selection.js';
import { ZugBericht as ZugBericht_SCHEMA_zug_bericht, zugBericht as fn_FUNC_zug_bericht } from '../../src/kernel/measure/zug-bericht.js';
import { MergeReportSchema as MergeReportSchema_SCHEMA_branch_merge_report, replayBranchLog as fn_FUNC_merge_nodes } from '../../src/kernel/merge.js';
import { SchemaFingerprintSchema as SchemaFingerprintSchema_SCHEMA_schema_fingerprint } from '../../src/kernel/schema-fingerprint-contract.js';
import { schemaFingerprint as fn_FUNC_schema_guard } from '../../src/kernel/schema-guard.js';
import { MCPToolRegistrySchema as MCPToolRegistrySchema_SCHEMA_mcp_tool_registry } from '../../src/kernel/tool-contract.js';
import { GenerationRequestSchema as GenerationRequestSchema_SCHEMA_generation_request, GenerationStep as GenerationStep_SCHEMA_generation_step, generationStep as fn_FUNC_generation_step } from '../../src/loop/generate.js';
import { vorschlagNachAnwendung as fn_FUNC_vorschlag } from '../../src/loop/next-step.js';
import { CrGroupsAnfrageSchema as CrGroupsAnfrageSchema_SCHEMA_cr_groups_anfrage, CrGroupsSchema as CrGroupsSchema_SCHEMA_cr_groups, crGroups as fn_FUNC_cr_groups } from '../../src/loop/se-plan.js';
import { TargetProfileSchema as TargetProfileSchema_SCHEMA_target_profile } from '../../src/loop/target-profile-contract.js';
import { loadTargetProfile as fn_FUNC_target_profile_load } from '../../src/loop/target-profile.js';
import { MarkdownTextSchema as MarkdownTextSchema_SCHEMA_markdown_text, MarkdownViewSchema as MarkdownViewSchema_SCHEMA_markdown_view, exportMarkdown as fn_FUNC_export_markdown } from '../../src/projections/exporter.js';
import { CodeVerdictSchema as CodeVerdictSchema_SCHEMA_code_urteil, codeVerdict as fn_FUNC_code_urteil } from '../../src/projections/kongruenz.js';
import { LaufUrteilSchema as LaufUrteilSchema_SCHEMA_lauf_urteil, SchlupfZeileSchema as SchlupfZeileSchema_SCHEMA_schlupf_zeile, VitestLaufSchema as VitestLaufSchema_SCHEMA_vitest_lauf, laufUrteil as fn_FUNC_lauf_urteil, schlupfVon as fn_FUNC_measure_test_schlupf } from '../../src/projections/test-schlupf.js';
import { planCodeLane as fn_FUNC_plan_code_lane } from '../../src/projections/test-selection-audit.js';
import { materializeTrajectory as fn_FUNC_emit_trajectory } from '../../src/projections/trajectory.js';
import { TypbindungEingabeSchema as TypbindungEingabeSchema_SCHEMA_typbindung_eingabe, TypbindungErgebnisSchema as TypbindungErgebnisSchema_SCHEMA_typbindung_ergebnis, typbindungen as fn_FUNC_erzeuge_typbindung } from '../../src/projections/typbindung.js';
import { VerlaufAmRepoEingabeSchema as VerlaufAmRepoEingabeSchema_SCHEMA_verlauf_request } from '../../src/projections/verlauf-repo.js';
import { VerlaufSchema as VerlaufSchema_SCHEMA_verlauf, rechneVerlauf as fn_FUNC_stand_verlauf } from '../../src/projections/verlauf.js';
import { VertragstestBerichtSchema as VertragstestBerichtSchema_SCHEMA_vertragstest_bericht, VertragstestSatzSchema as VertragstestSatzSchema_SCHEMA_vertragstest_satz, erzeugeVertragstests as fn_FUNC_erzeuge_vertragstests } from '../../src/projections/vertragstest.js';
import { AuditTrailInputSchema as AuditTrailInputSchema_SCHEMA_audit_trail_input, projectAuditEntries as fn_FUNC_audit_trail } from '../../src/surface/audit.js';
import { CliVerbSchema as CliVerbSchema_SCHEMA_cli_command } from '../../src/surface/cli-args.js';
import { SessionEntrySchema as SessionEntrySchema_SCHEMA_session_registry } from '../../src/surface/gve-session-contract.js';
import { liveSessions as fn_FUNC_gve_sessions } from '../../src/surface/gve-sessions.js';
import { HealthPayloadSchema as HealthPayloadSchema_SCHEMA_health_report } from '../../src/surface/health.js';
import { serveHost as fn_FUNC_serve_sse } from '../../src/surface/host.js';
import { InitReportSchema as InitReportSchema_SCHEMA_init_report, executeInit as fn_FUNC_init_verb } from '../../src/surface/init-verb.js';
import { serveStdio as fn_FUNC_serve_stdio } from '../../src/surface/mcp-server.js';
import { bindToolsToHarness as fn_FUNC_bind_tools } from '../../src/surface/mcp-tools.js';
import { GraphMutateAnswerSchema as GraphMutateAnswerSchema_SCHEMA_mutate_answer } from '../../src/surface/mutate-answer.js';
import { RenderSummarySchema as RenderSummarySchema_SCHEMA_render_summary, executeRender as fn_FUNC_render_verb } from '../../src/surface/render-verb.js';
import { RewindSummarySchema as RewindSummarySchema_SCHEMA_rewind_summary, executeRewind as fn_FUNC_rewind } from '../../src/surface/rewind.js';
import { InstallResultSchema as InstallResultSchema_SCHEMA_install_result, scaffold as fn_FUNC_harness_cli } from '../../src/surface/scaffold.js';
import { SessionLifecycle as fn_FUNC_session_shutdown } from '../../src/surface/session-lifecycle.js';
import { RepoStatusSchema as RepoStatusSchema_SCHEMA_repo_status, collectStatus as fn_FUNC_collect_status } from '../../src/surface/status.js';
import { TypbindungOptionenSchema as TypbindungOptionenSchema_SCHEMA_typbindung_optionen, executeTypbindung as fn_FUNC_typbindung_verb } from '../../src/surface/typbindung-verb.js';
import { executeVertragstest as fn_FUNC_vertragstest_verb } from '../../src/surface/vertragstest-verb.js';
import { MutateCommandSchema as MutateCommandSchema_SCHEMA_mutate_command, RuleViolationSchema as RuleViolationSchema_SCHEMA_rule_violation } from '@sigloch/contracts/harness';
import { ChainMetrics as ChainMetrics_SCHEMA_chain_metrics, FunctionCriticality as FunctionCriticality_SCHEMA_function_criticality, MetricPolicySchema as MetricPolicySchema_SCHEMA_metric_policy, ModuleMetrics as ModuleMetrics_SCHEMA_module_metrics, OntologyGraph as OntologyGraph_SCHEMA_ontology_graph, chainMetrics as fn_FUNC_chain_metrics, functionCriticality as fn_FUNC_function_criticality, moduleMetrics as fn_FUNC_module_metrics } from '@sigloch/contracts/se';
import { AuditEntrySchema as AuditEntrySchema_SCHEMA_audit_record, FormatEInputSchema as FormatEInputSchema_SCHEMA_format_e } from '@sigloch/graph-api-core';
import { ReadinessMarkSchema as ReadinessMarkSchema_SCHEMA_completeness, ReadinessReportSchema as ReadinessReportSchema_SCHEMA_readiness_report, computeMarks as fn_FUNC_score_completeness } from '@sigloch/graphcode-client';
import { MetricVector as MetricVector_SCHEMA_metric_vector, metrics as fn_FUNC_arch_fitness } from '@sigloch/se-engine';

// FUNC-apply-reseed — src/kernel/harness-import.ts#applyReseed
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_apply_reseed: (p1: z.infer<typeof OntologyJsonSchema_SCHEMA_ontology_json>) => (void) | Promise<void> = fn_FUNC_apply_reseed;
// FUNC-arch-fitness — packages/se-engine/src/metrics.ts#metrics
export const _FUNC_arch_fitness: (p1: z.infer<typeof OntologyGraph_SCHEMA_ontology_graph>) => (z.infer<typeof MetricVector_SCHEMA_metric_vector>) | Promise<z.infer<typeof MetricVector_SCHEMA_metric_vector>> = fn_FUNC_arch_fitness;
// FUNC-audit-stats: nicht prüfbar — MCP-Werkzeug, MCPTool<…> bindet den Typ
// FUNC-audit-trail — src/surface/audit.ts#projectAuditEntries
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_audit_trail: (p1: z.infer<typeof AuditTrailInputSchema_SCHEMA_audit_trail_input>) => (z.infer<typeof AuditEntrySchema_SCHEMA_audit_record>) | Promise<z.infer<typeof AuditEntrySchema_SCHEMA_audit_record>> = fn_FUNC_audit_trail;
// FUNC-authoring-guide: nicht prüfbar — MCP-Werkzeug, MCPTool<…> bindet den Typ
// FUNC-auto-export: nicht prüfbar — mehrere Operationen: SCHEMA-harness-handle, SCHEMA-mutate-result
// FUNC-bind-tools — src/surface/mcp-tools.ts#bindToolsToHarness
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_bind_tools: (p1: z.infer<typeof HarnessHandle_SCHEMA_harness_handle>) => (z.infer<typeof MCPToolRegistrySchema_SCHEMA_mcp_tool_registry>) | Promise<z.infer<typeof MCPToolRegistrySchema_SCHEMA_mcp_tool_registry>> = fn_FUNC_bind_tools;
// FUNC-broadcast-diff: nicht prüfbar — nicht exportiert
// FUNC-chain-metrics — packages/contracts/src/se/chain-metrics.ts#chainMetrics
export const _FUNC_chain_metrics: (p1: z.infer<typeof OntologyGraph_SCHEMA_ontology_graph>) => (z.infer<typeof ChainMetrics_SCHEMA_chain_metrics>) | Promise<z.infer<typeof ChainMetrics_SCHEMA_chain_metrics>> = fn_FUNC_chain_metrics;
// FUNC-check-code-conformance: nicht prüfbar — Richtung offen: FLOW-conformance-findings
// FUNC-claim-store-lock: nicht prüfbar — mehrere Operationen: SCHEMA-harness-handle, SCHEMA-lock-owner
// FUNC-cli-dispatch: nicht prüfbar — nicht exportiert
// FUNC-code-urteil — src/projections/kongruenz.ts#codeVerdict
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_code_urteil: (p1: z.infer<typeof ReadinessReportSchema_SCHEMA_readiness_report>) => (z.infer<typeof CodeVerdictSchema_SCHEMA_code_urteil>) | Promise<z.infer<typeof CodeVerdictSchema_SCHEMA_code_urteil>> = fn_FUNC_code_urteil;
// FUNC-collect-status — src/surface/status.ts#collectStatus
export const _FUNC_collect_status: (p1: z.infer<typeof CliVerbSchema_SCHEMA_cli_command>) => (z.infer<typeof RepoStatusSchema_SCHEMA_repo_status>) | Promise<z.infer<typeof RepoStatusSchema_SCHEMA_repo_status>> = fn_FUNC_collect_status;
// FUNC-compute-readiness — src/kernel/evaluation.ts#readinessOf
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_compute_readiness: (p1: z.infer<typeof RuleViolationSchema_SCHEMA_rule_violation>) => (z.infer<typeof ReadinessReportSchema_SCHEMA_readiness_report>) | Promise<z.infer<typeof ReadinessReportSchema_SCHEMA_readiness_report>> = fn_FUNC_compute_readiness;
// FUNC-compute-steering-delta — src/kernel/measure/steering-snapshot.ts#computeSteeringDelta
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_compute_steering_delta: (p1: z.infer<typeof SteeringSnapshotSchema_SCHEMA_steering_snapshot>) => (z.infer<typeof SteeringDelta_SCHEMA_steering_delta>) | Promise<z.infer<typeof SteeringDelta_SCHEMA_steering_delta>> = fn_FUNC_compute_steering_delta;
// FUNC-cr-groups — src/loop/se-plan.ts#crGroups
export const _FUNC_cr_groups: (p1: z.infer<typeof CrGroupsAnfrageSchema_SCHEMA_cr_groups_anfrage>) => (z.infer<typeof CrGroupsSchema_SCHEMA_cr_groups>) | Promise<z.infer<typeof CrGroupsSchema_SCHEMA_cr_groups>> = fn_FUNC_cr_groups;
// FUNC-create-harness: nicht prüfbar — Richtung offen: FLOW-harness-handle, FLOW-harness-request-own-kuzu
// FUNC-decode — src/kernel/format-e-commands.ts#formatEToCommands
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_decode: (p1: z.infer<typeof FormatEInputSchema_SCHEMA_format_e>) => (z.infer<typeof MutateCommandSchema_SCHEMA_mutate_command>) | Promise<z.infer<typeof MutateCommandSchema_SCHEMA_mutate_command>> = fn_FUNC_decode;
// FUNC-deduce-tests: nicht prüfbar — MCP-Werkzeug, MCPTool<…> bindet den Typ
// FUNC-ein-adapter-je-akteur — src/kernel/measure/constraints.ts#einAdapterJeAkteur
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_ein_adapter_je_akteur: () => (z.infer<typeof AdapterBefund_SCHEMA_adapter_befund>) | Promise<z.infer<typeof AdapterBefund_SCHEMA_adapter_befund>> = fn_FUNC_ein_adapter_je_akteur;
// FUNC-eingaenge-nur-aus — src/kernel/measure/constraints.ts#eingaengeNurAus
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_eingaenge_nur_aus: () => (z.infer<typeof EingangsBefund_SCHEMA_eingangs_befund>) | Promise<z.infer<typeof EingangsBefund_SCHEMA_eingangs_befund>> = fn_FUNC_eingaenge_nur_aus;
// FUNC-emit-trajectory — src/projections/trajectory.ts#materializeTrajectory
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_emit_trajectory: (p1: z.infer<typeof AuditEntrySchema_SCHEMA_audit_record>) => (void) | Promise<void> = fn_FUNC_emit_trajectory;
// FUNC-emit-update-event: nicht prüfbar — mehrere Operationen: SCHEMA-mutate-result, SCHEMA-update-event
// FUNC-erzeuge-typbindung — src/projections/typbindung.ts#typbindungen
export const _FUNC_erzeuge_typbindung: (p1: z.infer<typeof TypbindungEingabeSchema_SCHEMA_typbindung_eingabe>) => (z.infer<typeof TypbindungErgebnisSchema_SCHEMA_typbindung_ergebnis>) | Promise<z.infer<typeof TypbindungErgebnisSchema_SCHEMA_typbindung_ergebnis>> = fn_FUNC_erzeuge_typbindung;
// FUNC-erzeuge-vertragstests — src/projections/vertragstest.ts#erzeugeVertragstests
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_erzeuge_vertragstests: (p1: z.infer<typeof VertragstestSatzSchema_SCHEMA_vertragstest_satz>) => (z.infer<typeof VertragstestBerichtSchema_SCHEMA_vertragstest_bericht>) | Promise<z.infer<typeof VertragstestBerichtSchema_SCHEMA_vertragstest_bericht>> = fn_FUNC_erzeuge_vertragstests;
// FUNC-evaluate-rules: nicht prüfbar — nicht exportiert
// FUNC-export-markdown — src/projections/exporter.ts#exportMarkdown
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_export_markdown: (p1: z.infer<typeof MarkdownViewSchema_SCHEMA_markdown_view>) => (z.infer<typeof MarkdownTextSchema_SCHEMA_markdown_text>) | Promise<z.infer<typeof MarkdownTextSchema_SCHEMA_markdown_text>> = fn_FUNC_export_markdown;
// FUNC-export-marker — src/kernel/export-marker.ts#setExportPending
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_export_marker: (p1: z.infer<typeof ExportPending_SCHEMA_export_pending>) => (void) | Promise<void> = fn_FUNC_export_marker;
// FUNC-export-marker-clear — src/kernel/export-marker.ts#clearExportPending
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_export_marker_clear: (p1: z.infer<typeof ExportPending_SCHEMA_export_pending>) => (void) | Promise<void> = fn_FUNC_export_marker_clear;
// FUNC-fit-advisory — src/kernel/measure/fit-advisory.ts#computeFitAdvisory
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_fit_advisory: (p1: z.infer<typeof OntologyGraph_SCHEMA_ontology_graph>) => (z.infer<typeof FitAdvisory_SCHEMA_fit_advisory>) | Promise<z.infer<typeof FitAdvisory_SCHEMA_fit_advisory>> = fn_FUNC_fit_advisory;
// FUNC-function-criticality — packages/contracts/src/se/function-criticality.ts#functionCriticality
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_function_criticality: (p1: z.infer<typeof OntologyGraph_SCHEMA_ontology_graph>) => (z.infer<typeof FunctionCriticality_SCHEMA_function_criticality>) | Promise<z.infer<typeof FunctionCriticality_SCHEMA_function_criticality>> = fn_FUNC_function_criticality;
// FUNC-generation-step — src/loop/generate.ts#generationStep
export const _FUNC_generation_step: (p1: z.infer<typeof GenerationRequestSchema_SCHEMA_generation_request>) => (z.infer<typeof GenerationStep_SCHEMA_generation_step>) | Promise<z.infer<typeof GenerationStep_SCHEMA_generation_step>> = fn_FUNC_generation_step;
// FUNC-graph-expand: nicht prüfbar — nicht exportiert
// FUNC-graph-export-snapshot: nicht prüfbar — MCP-Werkzeug, MCPTool<…> bindet den Typ
// FUNC-graph-generate-tool: nicht prüfbar — MCP-Werkzeug, MCPTool<…> bindet den Typ
// FUNC-graph-help: nicht prüfbar — MCP-Werkzeug, MCPTool<…> bindet den Typ
// FUNC-graph-impact: nicht prüfbar — nicht exportiert
// FUNC-graph-merge-tool: nicht prüfbar — MCP-Werkzeug, MCPTool<…> bindet den Typ
// FUNC-graph-metrics: nicht prüfbar — MCP-Werkzeug, MCPTool<…> bindet den Typ
// FUNC-graph-mutate-tool: nicht prüfbar — MCP-Werkzeug, MCPTool<…> bindet den Typ
// FUNC-graph-readiness: nicht prüfbar — MCP-Werkzeug, MCPTool<…> bindet den Typ
// FUNC-graph-reseed-tool: nicht prüfbar — MCP-Werkzeug, MCPTool<…> bindet den Typ
// FUNC-graph-store: nicht prüfbar — Richtung offen: FLOW-graph-state, FLOW-graph-state-eval, FLOW-imported-graph, FLOW-store-query
// FUNC-graph-suggest: nicht prüfbar — MCP-Werkzeug, MCPTool<…> bindet den Typ
// FUNC-grenze-nur-mit-schema — src/kernel/measure/constraints.ts#grenzeNurMitSchema
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_grenze_nur_mit_schema: () => (z.infer<typeof GrenzBefund_SCHEMA_grenz_befund>) | Promise<z.infer<typeof GrenzBefund_SCHEMA_grenz_befund>> = fn_FUNC_grenze_nur_mit_schema;
// FUNC-gve-sessions — src/surface/gve-sessions.ts#liveSessions
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_gve_sessions: () => (z.infer<typeof SessionEntrySchema_SCHEMA_session_registry>) | Promise<z.infer<typeof SessionEntrySchema_SCHEMA_session_registry>> = fn_FUNC_gve_sessions;
// FUNC-gve-supervise: nicht prüfbar — mehrere Operationen: SCHEMA-aufruf-ohne-daten, SCHEMA-repo-pfad
// FUNC-harness-cli — src/surface/scaffold.ts#scaffold
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_harness_cli: (p1: z.infer<typeof CliVerbSchema_SCHEMA_cli_command>) => (z.infer<typeof InstallResultSchema_SCHEMA_install_result>) | Promise<z.infer<typeof InstallResultSchema_SCHEMA_install_result>> = fn_FUNC_harness_cli;
// FUNC-health-endpoint: nicht prüfbar — nicht exportiert
// FUNC-held-back-traces — src/kernel/harness-import.ts#heldBackTraces
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_held_back_traces: (p1: z.infer<typeof OntologyGraph_SCHEMA_ontology_graph>) => (z.infer<typeof RejectedTraceSchema_SCHEMA_rejected_trace>) | Promise<z.infer<typeof RejectedTraceSchema_SCHEMA_rejected_trace>> = fn_FUNC_held_back_traces;
// FUNC-host-proxy: nicht prüfbar — mehrere Operationen: SCHEMA-format-e, SCHEMA-mcp-tool-registry
// FUNC-host-socket: nicht prüfbar — mehrere Operationen: SCHEMA-mcp-tool-registry, SCHEMA-shim-request
// FUNC-import: nicht prüfbar — Richtung offen: FLOW-imported-graph
// FUNC-import-code-verb: nicht prüfbar — Richtung offen: FLOW-export-request-import-code, FLOW-mutate-answer-import-code-verb, FLOW-mutate-cmd-import-code-verb
// FUNC-init-verb — src/surface/init-verb.ts#executeInit
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_init_verb: (p1: z.infer<typeof CliVerbSchema_SCHEMA_cli_command>) => (z.infer<typeof InitReportSchema_SCHEMA_init_report>) | Promise<z.infer<typeof InitReportSchema_SCHEMA_init_report>> = fn_FUNC_init_verb;
// FUNC-lauf-urteil — src/projections/test-schlupf.ts#laufUrteil
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_lauf_urteil: (p1: z.infer<typeof VitestLaufSchema_SCHEMA_vitest_lauf>) => (z.infer<typeof LaufUrteilSchema_SCHEMA_lauf_urteil>) | Promise<z.infer<typeof LaufUrteilSchema_SCHEMA_lauf_urteil>> = fn_FUNC_lauf_urteil;
// FUNC-list-elements: nicht prüfbar — Richtung offen: FLOW-store-query
// FUNC-load-config — src/kernel/config.ts#loadGraphcodeConfig
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_load_config: (p1: z.infer<typeof MetricPolicySchema_SCHEMA_metric_policy>) => (void) | Promise<void> = fn_FUNC_load_config;
// FUNC-measure-test-schlupf — src/projections/test-schlupf.ts#schlupfVon
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_measure_test_schlupf: (p1: z.infer<typeof SchlupfZeileSchema_SCHEMA_schlupf_zeile>) => (z.infer<typeof SchlupfZeileSchema_SCHEMA_schlupf_zeile>) | Promise<z.infer<typeof SchlupfZeileSchema_SCHEMA_schlupf_zeile>> = fn_FUNC_measure_test_schlupf;
// FUNC-merge-nodes — src/kernel/merge.ts#replayBranchLog
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_merge_nodes: (p1: z.infer<typeof AuditEntrySchema_SCHEMA_audit_record>) => (z.infer<typeof MergeReportSchema_SCHEMA_branch_merge_report>) | Promise<z.infer<typeof MergeReportSchema_SCHEMA_branch_merge_report>> = fn_FUNC_merge_nodes;
// FUNC-module-metrics — packages/contracts/src/se/metric-rules.ts#moduleMetrics
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_module_metrics: (p1: z.infer<typeof OntologyGraph_SCHEMA_ontology_graph>) => (z.infer<typeof ModuleMetrics_SCHEMA_module_metrics>) | Promise<z.infer<typeof ModuleMetrics_SCHEMA_module_metrics>> = fn_FUNC_module_metrics;
// FUNC-mutate: nicht prüfbar — nicht exportiert
// FUNC-open-store: nicht prüfbar — nicht exportiert
// FUNC-own-kuzu-host: nicht prüfbar — Richtung offen: FLOW-harness-handle, FLOW-harness-request-own-kuzu
// FUNC-plan-code-lane — src/projections/test-selection-audit.ts#planCodeLane
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_plan_code_lane: (p1: z.infer<typeof CodeLanePlanSchema_SCHEMA_code_lane_plan>) => (z.infer<typeof CodeLanePlanSchema_SCHEMA_code_lane_plan>) | Promise<z.infer<typeof CodeLanePlanSchema_SCHEMA_code_lane_plan>> = fn_FUNC_plan_code_lane;
// FUNC-read-tools: nicht prüfbar — mehrere Operationen: SCHEMA-context-input, SCHEMA-elements-input, SCHEMA-expand-input, SCHEMA-get-edges-input, SCHEMA-get-node-input, SCHEMA-impact-input, SCHEMA-tool-context
// FUNC-render-verb — src/surface/render-verb.ts#executeRender
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_render_verb: (p1: z.infer<typeof CliVerbSchema_SCHEMA_cli_command>) => (z.infer<typeof RenderSummarySchema_SCHEMA_render_summary>) | Promise<z.infer<typeof RenderSummarySchema_SCHEMA_render_summary>> = fn_FUNC_render_verb;
// FUNC-reseed: nicht prüfbar — nicht exportiert
// FUNC-resolve-tests-from-code: nicht prüfbar — nicht exportiert
// FUNC-rewind — src/surface/rewind.ts#executeRewind
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_rewind: (p1: z.infer<typeof CliVerbSchema_SCHEMA_cli_command>) => (z.infer<typeof RewindSummarySchema_SCHEMA_rewind_summary>) | Promise<z.infer<typeof RewindSummarySchema_SCHEMA_rewind_summary>> = fn_FUNC_rewind;
// FUNC-rules-tool: nicht prüfbar — MCP-Werkzeug, MCPTool<…> bindet den Typ
// FUNC-schema-guard — src/kernel/schema-guard.ts#schemaFingerprint
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_schema_guard: (p1: z.infer<typeof SchemaFingerprintSchema_SCHEMA_schema_fingerprint>) => (z.infer<typeof SchemaFingerprintSchema_SCHEMA_schema_fingerprint>) | Promise<z.infer<typeof SchemaFingerprintSchema_SCHEMA_schema_fingerprint>> = fn_FUNC_schema_guard;
// FUNC-score-completeness — packages/graphcode-client/src/readiness.ts#computeMarks
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_score_completeness: (p1: z.infer<typeof RuleViolationSchema_SCHEMA_rule_violation>) => (z.infer<typeof ReadinessMarkSchema_SCHEMA_completeness>) | Promise<z.infer<typeof ReadinessMarkSchema_SCHEMA_completeness>> = fn_FUNC_score_completeness;
// FUNC-seed-from-json — src/kernel/harness-import.ts#seedFromJsonFile
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_seed_from_json: (p1: z.infer<typeof OntologyJsonSchema_SCHEMA_ontology_json>) => (void) | Promise<void> = fn_FUNC_seed_from_json;
// FUNC-select-tests — src/kernel/measure/test-selection.ts#impactedTests
export const _FUNC_select_tests: (p1: z.infer<typeof TestImpactAnfrageSchema_SCHEMA_test_impact_anfrage>) => (z.infer<typeof TestImpactResultSchema_SCHEMA_impacted_tests>) | Promise<z.infer<typeof TestImpactResultSchema_SCHEMA_impacted_tests>> = fn_FUNC_select_tests;
// FUNC-serve-sse — src/surface/host.ts#serveHost
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_serve_sse: (p1: z.infer<typeof CliVerbSchema_SCHEMA_cli_command>) => (z.infer<typeof HealthPayloadSchema_SCHEMA_health_report>) | Promise<z.infer<typeof HealthPayloadSchema_SCHEMA_health_report>> = fn_FUNC_serve_sse;
// FUNC-serve-stdio — src/surface/mcp-server.ts#serveStdio
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_serve_stdio: (p1: z.infer<typeof CliVerbSchema_SCHEMA_cli_command>) => (z.infer<typeof MCPToolRegistrySchema_SCHEMA_mcp_tool_registry>) | Promise<z.infer<typeof MCPToolRegistrySchema_SCHEMA_mcp_tool_registry>> = fn_FUNC_serve_stdio;
// FUNC-session-shutdown — src/surface/session-lifecycle.ts#SessionLifecycle
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_session_shutdown: (p1: z.infer<typeof HarnessHandle_SCHEMA_harness_handle>) => (void) | Promise<void> = fn_FUNC_session_shutdown;
// FUNC-stand-verlauf — src/projections/verlauf.ts#rechneVerlauf
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_stand_verlauf: (p1: z.infer<typeof VerlaufAmRepoEingabeSchema_SCHEMA_verlauf_request>) => (z.infer<typeof VerlaufSchema_SCHEMA_verlauf>) | Promise<z.infer<typeof VerlaufSchema_SCHEMA_verlauf>> = fn_FUNC_stand_verlauf;
// FUNC-sync-skills: nicht prüfbar — Richtung offen: FLOW-skill-sync-result-upgrade
// FUNC-take-steering-snapshot — src/kernel/measure/steering-snapshot.ts#takeSteeringSnapshot
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_take_steering_snapshot: (p1: z.infer<typeof OntologyGraph_SCHEMA_ontology_graph>) => (z.infer<typeof SteeringSnapshotSchema_SCHEMA_steering_snapshot>) | Promise<z.infer<typeof SteeringSnapshotSchema_SCHEMA_steering_snapshot>> = fn_FUNC_take_steering_snapshot;
// FUNC-target-profile-load — src/loop/target-profile.ts#loadTargetProfile
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_target_profile_load: () => (z.infer<typeof TargetProfileSchema_SCHEMA_target_profile>) | Promise<z.infer<typeof TargetProfileSchema_SCHEMA_target_profile>> = fn_FUNC_target_profile_load;
// FUNC-test-ingest: nicht prüfbar — MCP-Werkzeug, MCPTool<…> bindet den Typ
// FUNC-tool-context: nicht prüfbar — mehrere Operationen: SCHEMA-audit-record, SCHEMA-export-answer, SCHEMA-harness-handle, SCHEMA-mutate-command
// FUNC-typbindung-verb — src/surface/typbindung-verb.ts#executeTypbindung
export const _FUNC_typbindung_verb: (p1: z.infer<typeof TypbindungOptionenSchema_SCHEMA_typbindung_optionen>) => (z.infer<typeof TypbindungErgebnisSchema_SCHEMA_typbindung_ergebnis>) | Promise<z.infer<typeof TypbindungErgebnisSchema_SCHEMA_typbindung_ergebnis>> = fn_FUNC_typbindung_verb;
// FUNC-upgrade: nicht prüfbar — Richtung offen: FLOW-skill-sync-result-upgrade
// FUNC-vertragstest-verb — src/surface/vertragstest-verb.ts#executeVertragstest
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_vertragstest_verb: (p1: z.infer<typeof CliVerbSchema_SCHEMA_cli_command>) => (void) | Promise<void> = fn_FUNC_vertragstest_verb;
// FUNC-vorschlag — src/loop/next-step.ts#vorschlagNachAnwendung
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_vorschlag: () => (z.infer<typeof GraphMutateAnswerSchema_SCHEMA_mutate_answer>) | Promise<z.infer<typeof GraphMutateAnswerSchema_SCHEMA_mutate_answer>> = fn_FUNC_vorschlag;
// FUNC-zug-bericht — src/kernel/measure/zug-bericht.ts#zugBericht
// @ts-expect-error Altlast: Signatur weicht vom Vertrag ab (tests/typbindung/altlast.json)
export const _FUNC_zug_bericht: (p1: z.infer<typeof OntologyGraph_SCHEMA_ontology_graph>) => (z.infer<typeof ZugBericht_SCHEMA_zug_bericht>) | Promise<z.infer<typeof ZugBericht_SCHEMA_zug_bericht>> = fn_FUNC_zug_bericht;
