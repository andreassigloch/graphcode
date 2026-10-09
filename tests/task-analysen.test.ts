/**
 * CR-GC-724 — Analyse-Tasks: am Eintritt eines Tasks verweist der Schritt auf den Skill; der
 * Stempel am SYS (`analysisFreshness`) ist Sache der Skills, der Bauplan hat keinen (CR-GC-752).
 * Der eingebettete Executor, der den Task fuhr und den Stempel setzte, ist mit CR-GC-775 ausgelagert,
 * seine Vorbilder (`TASK_CLAUSE`) und sein Abschlusskriterium mit CR-GC-777 geloescht.
 *
 * Reale Persistenz (Disk-Kuzu im temp repoRoot), echtes Gate.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import { generationStep } from '../src/loop/generate.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';

/** Ein kleiner, gate-gültiger Kern: ein UC, eine Kette mit zwei Gliedern, eine REQ mit TEST, ein Modul. */
const KERN = [
  '## Nodes',
  '### SYS',
  '+ SYS-app|Ein System zum Prüfen der Analyse-Tasks. [__name:Test App]',
  '@analysisFreshness {"trade":{"graphVersion":1}}',
  '### UC',
  '+ UC-ablauf|Der Nutzer löst den Ablauf aus und erhält das Ergebnis. [__name:Ablauf]',
  '### FCHAIN',
  '+ FCHAIN-ablauf|Vom Auslöser zum Ergebnis. [__name:Kette Ablauf]',
  '### FUNC',
  '+ FUNC-lesen|Liest die Eingabe. [__name:Lesen]',
  '+ FUNC-liefern|Liefert das Ergebnis. [__name:Liefern]',
  '### MOD',
  '+ MOD-kern|Der Kern. [__name:Kern]',
  '### REQ',
  '+ REQ-liefern|Das System muss das Ergebnis liefern. [__name:Liefern]',
  '@kinds ["functional"]',
  '### TEST',
  '+ TEST-liefern|Ablauf auslösen und das Ergebnis prüfen. [__name:Test Liefern]',
  '',
  '## Edges',
  '+ SYS-app -compose-> UC-ablauf, MOD-kern',
  '+ UC-ablauf -compose-> FCHAIN-ablauf, REQ-liefern',
  '+ FCHAIN-ablauf -compose-> FUNC-lesen, FUNC-liefern',
  '+ FUNC-liefern -satisfy-> REQ-liefern',
  '+ FUNC-lesen -allocate-> MOD-kern',
  '+ FUNC-liefern -allocate-> MOD-kern',
  '+ TEST-liefern -verify-> REQ-liefern',
  '',
].join('\n');

describe('CR-GC-724: Analyse-Tasks', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let registry: MCPToolRegistry;

  const mutate = async (formatE: string): Promise<{ success: boolean; violations?: unknown }> =>
    (await registry['graph_mutate'].handler(registry['graph_mutate'].inputSchema.parse({ formatE, consumerId: 'test' }))) as {
      success: boolean;
      violations?: unknown;
    };
  const stempel = (): Record<string, { graphVersion: number }> =>
    (harness.getGraph().nodes.find((n) => n.type === 'SYS')!.attributes?.analysisFreshness ?? {}) as Record<
      string,
      { graphVersion: number }
    >;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'gc-task-'));
    harness = await createHarness({
      repoRoot,
      scope: { workspaceId: 'task', systemId: 'task' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    });
    await harness.initialize();
    registry = bindToolsToHarness(harness);
    const kern = await mutate(KERN);
    expect(kern.success, JSON.stringify(kern.violations)).toBe(true);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('Rundenprompt: am Task-Eintritt verweist der Schritt auf den Skill des Tasks', () => {
    const schritt = generationStep(harness.getGraph(), DEFAULT_METRIC_POLICY, undefined, 0.8, [], null, 'fmea');
    expect(schritt.focusKey).toMatch(/:AF-04:/);
    expect(schritt.prompt).toContain('Lade den Skill se-fmea');
    expect(schritt.skill).toBe('se-fmea');
  });

  // CR-GC-752 (contracts 11, CR-SM-395): der Bauplan ist die Menge der offenen Auftraege, kein Stempel.
  describe('CR-GC-752: der Bauplan setzt keinen Stempel — sein Ergebnis sind offene Auftraege', () => {
    const planFokus = () => generationStep(harness.getGraph(), DEFAULT_METRIC_POLICY, undefined, 0.8, [], null, 'plan');

    it('ein Bauplan-Stempel von Hand schliesst den Eintritt NICHT — er wird nicht mehr gelesen', async () => {
      const res = await mutate(`## Nodes\n### SYS\n~ SYS-app\n@analysisFreshness ${JSON.stringify({ ...stempel(), implplan: { graphVersion: 2 } })}\n`);
      expect(res.success, JSON.stringify(res.violations)).toBe(true); // ein Alt-Graph mit Stempel laedt und schreibt weiter
      expect(planFokus().focusKey).toMatch(/:AF-05:/);
    });

    it('der Skill se-plan stempelt nicht mehr und nennt den offenen Auftrag als Ergebnis', () => {
      const text = readFileSync(fileURLToPath(new URL('../.claude/commands/se-plan.md', import.meta.url)), 'utf8');
      expect(text).not.toMatch(/"implplan"\s*:/);
      expect(text).not.toContain('keep every entry already in `analysisFreshness`');
      expect(text).toContain('`status: "open"`');
      expect(text).toMatch(/sets \*\*no\*\* stamp/);
    });
  });

  it('CR-GC-735: ein Patch ersetzt analysisFreshness ganz — lesen, übernehmen, ganz schreiben hält alle', async () => {
    expect(Object.keys(stempel())).toEqual(['trade']);
    // Der Teil-Stempel, wie die Skills ihn bis CR-GC-735 nahelegten: trade geht verloren (todo-local, 2026-10-04).
    await mutate('## Nodes\n### SYS\n~ SYS-app\n@analysisFreshness {"conops":{"graphVersion":2}}\n');
    expect(Object.keys(stempel())).toEqual(['conops']);
    // Lesen, übernehmen, ganz schreiben — der Weg der Skills.
    await mutate(`## Nodes\n### SYS\n~ SYS-app\n@analysisFreshness ${JSON.stringify({ ...stempel(), fmea: { graphVersion: 3 } })}\n`);
    expect(Object.keys(stempel()).sort()).toEqual(['conops', 'fmea']);
  });

  it('CR-GC-735: jeder Analyse-Skill mit Stempel schließt mit lesen, übernehmen, ganz schreiben', () => {
    // CR-GC-752: ohne se-plan — der Bauplan stempelt nicht (eigener Fall oben).
    for (const skill of ['se-conops', 'se-trade', 'se-irr', 'se-fmea']) {
      const text = readFileSync(fileURLToPath(new URL(`../.claude/commands/${skill}.md`, import.meta.url)), 'utf8');
      expect(text, skill).toContain('read SYS first (`graph_get_node`), keep every entry already in `analysisFreshness`');
      expect(text, skill).not.toMatch(/attributes\.analysisFreshness[.[]/);
    }
  });

  it('eine Entscheidung ist ein erledigter Auftrag: Analysen und Optimierung halten sich als CR in done/ fest', () => {
    // Ein Ort fuer den Text (docs/cr/done), ein schlanker Knoten, relation-Kanten auf das Geaenderte —
    // kein zweites Dokument unter docs/records, keine Etiketten an Kanten, keine Optionsknoten.
    for (const skill of ['se-conops', 'se-trade', 'se-irr', 'se-fmea', 'se/optimize']) {
      const text = readFileSync(fileURLToPath(new URL(`../.claude/commands/${skill}.md`, import.meta.url)), 'utf8');
      expect(text, skill).toContain('docs/cr/done/');
      expect(text, skill).toContain('status: "done"');
      expect(text, skill).toMatch(/`relation`/);
      expect(text, skill).not.toMatch(/Write `docs\/records\//);
      expect(text, skill).not.toMatch(/superseded-by|label: ?decides|architectureOnly|commitRef/);
    }
  });
});
