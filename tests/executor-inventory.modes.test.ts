/**
 * CR-GC-682 — der Inventar-Kanal als Mess-Schalter: fund | index | faltung.
 * Reale Persistenz (Disk-Kuzu im temp repoRoot); simuliert ist nur der Modell-Endpunkt.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import { buildRoundInjection } from '../src/loop/executor-prompt.js';
import { runExecutor, ExecutorConfigSchema, type CallModel } from '../src/loop/executor.js';

const SEED = [
  '## Nodes',
  '### SYS',
  '+ SYS-shop|Ein kleiner Webshop. [__name:Shop]',
  '### UC',
  '+ UC-login|Kunde meldet sich an. [__name:Anmelden]',
  '+ UC-bestellen|Kunde bestellt Ware. [__name:Bestellen]',
  '### REQ',
  '+ REQ-login-zeit|Das System muss die Anmeldung in unter 2 s bestaetigen. [__name:Anmeldezeit]',
  '@kinds ["non-functional"]',
  '+ REQ-bestellen-mail|Das System muss jede Bestellung per Mail bestaetigen. [__name:Bestellmail]',
  '@kinds ["functional"]',
  '### TEST',
  '+ TEST-login-zeit|Misst die Anmeldezeit gegen 2 s. [__name:Anmeldezeit messen]',
  '+ TEST-bestellen-mail|Prueft die Bestellmail. [__name:Bestellmail pruefen]',
  '',
  '## Edges',
  '+ SYS-shop -compose-> UC-login, UC-bestellen',
  '+ UC-login -compose-> REQ-login-zeit',
  '+ UC-bestellen -compose-> REQ-bestellen-mail',
  '+ TEST-login-zeit -verify-> REQ-login-zeit',
  '+ TEST-bestellen-mail -verify-> REQ-bestellen-mail',
  '',
].join('\n');

const SCHRITT = { focusTypes: ['REQ'], skill: null, focusElements: ['REQ-login-zeit'] };

describe('Inventar-Kanal als Mess-Schalter (CR-GC-682)', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let registry: ReturnType<typeof bindToolsToHarness>;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-inventar-'));
    harness = await createHarness({
      repoRoot,
      scope: { workspaceId: 'inventar-test', systemId: 'inventar-test' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    });
    await harness.initialize();
    registry = bindToolsToHarness(harness);
    const res = (await registry['graph_mutate'].handler({ formatE: SEED, consumerId: 'test' })) as { success: boolean };
    expect(res.success).toBe(true);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('fund (Default) bleibt der Befund-Kontext aus CR-GC-652', async () => {
    const out = await buildRoundInjection(registry, SCHRITT);
    expect(out).toContain('Element-Liste aus dem Kontext des Funds');
    expect(out).not.toContain('Element-Index des ganzen Graphen');
  });

  it('index: jeder Knoten als Identitaetszeile, auch der aus dem fremden Ast', async () => {
    const out = await buildRoundInjection(registry, SCHRITT, 'index');
    expect(out).toContain('Element-Index des ganzen Graphen');
    expect(out).toContain('REQ-bestellen-mail · REQ · Bestellmail');
    expect(out).not.toContain('per Mail bestaetigen');
  });

  it('faltung: Ast des Funds offen mit Wortlaut, Nachbar-Ast als Box, sein Inneres als uid im Index', async () => {
    const out = await buildRoundInjection(registry, SCHRITT, 'faltung');
    const offen = out.slice(out.indexOf('## Offen'), out.indexOf('## Box'));
    const box = out.slice(out.indexOf('## Box'), out.indexOf('## Kanten'));
    const index = out.slice(out.indexOf('## Index'));
    expect(offen).toContain('REQ-login-zeit · REQ · Anmeldezeit · non-functional — Das System muss die Anmeldung in unter 2 s bestaetigen.');
    expect(offen).toContain('UC-login');
    expect(offen).toContain('SYS-shop');
    expect(box).toContain('UC-bestellen · UC · Bestellen');
    expect(index).toContain('REQ-bestellen-mail');
    expect(out).not.toContain('per Mail bestaetigen');
  });

  it('CR-GC-672: jede REQ-Zeile traegt ihre kinds — in allen drei Zuschnitten', async () => {
    // gcrun-180: 54 der 107 kinds-Blocks betrafen REQs, die schon im Graphen standen — das Inventar
    // zeigte `uid · TYPE · name`, das Modell sah nicht, welcher Erfueller legal ist.
    const fund = await buildRoundInjection(registry, SCHRITT);
    expect(fund).toContain('REQ-login-zeit · REQ · Anmeldezeit · non-functional');
    const index = await buildRoundInjection(registry, SCHRITT, 'index');
    expect(index).toContain('REQ-bestellen-mail · REQ · Bestellmail · functional');
    expect(index, 'nur REQ traegt kinds').toMatch(/^UC-login · UC · Anmelden$/m);
    const seed = await buildRoundInjection(registry, { focusTypes: ['REQ'], skill: null });
    expect(seed).toContain('REQ-bestellen-mail · REQ · Bestellmail · functional');
    const ohne = (await registry['graph_mutate'].handler({
      formatE: '## Nodes\n### REQ\n+ REQ-offen|Das System muss X liefern. [__name:Offen]\n### TEST\n+ TEST-offen|Prueft X. [__name:T]\n\n' +
        '## Edges\n+ UC-login -compose-> REQ-offen\n+ TEST-offen -verify-> REQ-offen\n',
      consumerId: 'test',
    })) as { success: boolean };
    expect(ohne.success).toBe(true);
    expect(await buildRoundInjection(registry, SCHRITT, 'index'), 'fehlende kinds sind sichtbar').toContain('REQ-offen · REQ · Offen · kinds fehlen');
  });

  it('faltung ohne Fund: kein Ast zum Oeffnen — der volle Index', async () => {
    const out = await buildRoundInjection(registry, { focusTypes: ['REQ'], skill: null }, 'faltung');
    expect(out).toContain('Element-Index des ganzen Graphen');
  });

  it('der Schalter wirkt ueber die Konfiguration bis in den Rundenprompt', async () => {
    const prompts: string[] = [];
    const callModel: CallModel = (_system, messages) => {
      prompts.push(JSON.stringify(messages));
      return Promise.reject(new Error('nur der Prompt interessiert'));
    };
    const config = ExecutorConfigSchema.parse({
      baseUrl: 'http://scripted.invalid',
      model: 'scripted',
      maxRounds: 1,
      maxStepTurns: 1,
      inventory: 'index',
    });
    await runExecutor({ registry, workspaceDir: repoRoot, intent: 'Shop.', config, callModel });
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts[0]).toContain('Element-Index des ganzen Graphen');
  });
});
