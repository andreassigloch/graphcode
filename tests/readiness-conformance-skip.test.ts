/**
 * CR-GC-489 — „nicht geprueft" ist nicht EIN Wort, sondern sechs Regeln.
 *
 * `evaluateAll` meldete fehlende Konformanz als `skipped.push('conformance')`: ein Token fuer
 * die sechs RC-Regeln. Seit CR-SM-305 stehen sie im Katalog, und RC-01/02/03 sind `severity:
 * error` — wer `blocking.errors: 0` neben `skipped: ['conformance']` las, erfuhr nicht, dass
 * darin drei error-Regeln stecken. Fuer Katalogregeln gibt es die feine Form seit CR-GC-428
 * (`rule:BQ-01`); die Konformanz bekommt sie hier.
 *
 * Die Liste ist ABGELEITET (`getRuleDefsForProfile('conformance')`), nicht gepflegt — kommt in
 * contracts eine siebte RC-Regel dazu, erscheint sie ohne Codeaenderung.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { getRuleDefsForProfile } from '@sigloch/contracts/se';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { openMeasured, type Measured } from '../src/surface/measured.js';
import { evaluateAll, SKIPPED_RULE_PREFIX } from '../src/kernel/evaluation.js';

const RC_IDS = getRuleDefsForProfile('conformance').map((r) => r.id);

describe('CR-GC-489: das Ausfall-Signal der Konformanz ist regelfein', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'skip-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    // repoRoot zeigt bewusst ins Leere: das ist die Lage „keine CodeFacts" — der Fall, in dem
    // ein Bericht NIE „gruen" sagen darf (Fail-open-Lehre CR-SM-286).
    harness = new GraphCodeHarness(
      { repoRoot: join(tmp, 'gibt-es-nicht'), scope: { workspaceId: 'w', systemId: 's' }, consumerType: 'system', preCommitTimeout: 5000 },
      storage,
      undefined,
      { lockDir: tmp },
    );
    await harness.initialize();
  });

  afterAll(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('ohne Repo-Wurzel steht JEDE RC-Regel einzeln in skipped', () => {
    const skipped = evaluateAll(harness).skipped;
    for (const id of RC_IDS) expect(skipped).toContain(`${SKIPPED_RULE_PREFIX}${id}`);
  });

  it('das alte Sammel-Token ist weg — die sechs Regeln stehen schon einzeln da', () => {
    // `unevaluatedRuleIds` liefert sie seit CR-SM-305 von selbst (ALL_RULE_DEFS minus
    // Gate-Katalog). Das zusaetzliche Quellen-Token sagt dieselbe Sache ein zweites Mal.
    expect(evaluateAll(harness).skipped).not.toContain('conformance');
  });

  it('die drei error-Regeln sind namentlich sichtbar, nicht hinter einer Quelle', () => {
    const skipped = evaluateAll(harness).skipped;
    const errors = getRuleDefsForProfile('conformance').filter((r) => r.severity === 'error').map((r) => r.id);
    expect(errors).toEqual(['RC-01', 'RC-02', 'RC-03']);
    for (const id of errors) expect(skipped).toContain(`${SKIPPED_RULE_PREFIX}${id}`);
  });

  it('die Liste ist ABGELEITET: sie deckt genau das conformance-Profil, keine gepinnte Menge', () => {
    const skipped = evaluateAll(harness).skipped;
    const rcInSkipped = skipped.filter((s) => s.startsWith(`${SKIPPED_RULE_PREFIX}RC-`)).sort();
    expect(rcInSkipped).toEqual(RC_IDS.map((id) => `${SKIPPED_RULE_PREFIX}${id}`).sort());
  });

  it('ohne Wurzel gibt es keine Reichweite — importCoverage ist null, nie 0', () => {
    expect(evaluateAll(harness).importCoverage).toBeNull();
  });
});

/**
 * Der Kern (gemessen 2026-09-09): mit echter Repo-Wurzel wertet `evaluateAll` die RC-Regeln aus
 * — RC-04 lieferte am graphcode-Selbstmodell 3 Befunde — UND `skipped` behauptet gleichzeitig
 * `rule:RC-04`, also „nicht ausgewertet". Dieselbe Antwort sagt beides.
 *
 * Ursache: `unevaluatedRuleIds` ist `ALL_RULE_DEFS` minus GATE-Katalog. Das Gate laedt RC nie
 * (Profil `conformance`), also stehen sie immer drin — auch wenn `conformanceEvaluation` sie
 * gerade gefahren hat. Fuer ND gibt es dafuer laengst `LOCALLY_EVALUATED_RULE_IDS`; RC braucht
 * dasselbe, nur BEDINGT: nur wenn die Konformanz wirklich lief.
 *
 * Damit werden die zwei Lagen erst unterscheidbar — heute sehen „ausgewertet, 0 Verstoesse" und
 * „nie ausgefuehrt" an der Oberflaeche identisch aus.
 */
describe('CR-GC-489: ausgewertet heisst nicht ausgelassen', () => {
  let measured: Measured;
  let harness: GraphCodeHarness;

  beforeAll(async () => {
    // CR-GC-497: die Wurzel ist das ECHTE Repo (CodeFacts, `graphcode.config.jsonc`), der
    // Store ein Wegwerf-Verzeichnis. Der Handaufbau hier bekam still `DEFAULT_CONFIG` —
    // heute zeichengleich, ab CR-SM-303 nicht mehr. Der Block oben bleibt Handaufbau:
    // dort IST die fehlende Wurzel der Gegenstand.
    measured = await openMeasured({
      repoRoot: join(__dirname, '..'),
      graph: join(__dirname, '..', 'docs/graph/graphcode.graph.json'),
      systemId: 'graphcode',
      workspaceId: 'w',
    });
    harness = measured.harness as GraphCodeHarness;
  }, 120_000);

  afterAll(async () => {
    await measured.close();
  });

  it('CR-GC-497: geurteilt wird mit der Config des Repos, nicht mit Startwerten', () => {
    // Ohne diesen Nachweis prueft der Block gegen Startwerte statt gegen die Schwellen,
    // mit denen die Produktion urteilt — gruen, und ueber etwas anderes.
    expect(measured.provenance.policy.source).toBe('file');
  });

  it('mit Repo-Wurzel wird die Konformanz erhoben', () => {
    const ev = evaluateAll(harness);
    expect(ev.findings.some((f) => f.source === 'conformance')).toBe(true);
    expect(ev.importCoverage).not.toBeNull();
  });

  it('und dann steht KEINE RC-Regel mehr in skipped', () => {
    const skipped = evaluateAll(harness).skipped;
    expect(skipped.filter((s) => s.startsWith(`${SKIPPED_RULE_PREFIX}RC-`))).toEqual([]);
  });

  it('eine RC-Regel ist entweder ausgewertet ODER ausgelassen — nie beides', () => {
    const ev = evaluateAll(harness);
    const evaluated = new Set(ev.findings.filter((f) => f.source === 'conformance').map((f) => f.ruleId));
    const skipped = new Set(ev.skipped);
    for (const id of evaluated) expect(skipped.has(`${SKIPPED_RULE_PREFIX}${id}`)).toBe(false);
  });
});
