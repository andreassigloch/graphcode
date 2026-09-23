/**
 * CR-GC-623 — eine Werkzeugbeschreibung darf keinen Parameter erfinden.
 *
 * BEFUND (2026-09-22, Lauf `gefuehrt-0`): vier Beschreibungen sagten `graph_help({id:"…"})`; der
 * Parameter heisst `token`. Ein Zod-Objekt ist nicht `strict`, also fiel `id` still weg, `token`
 * war `undefined` — und das ist der Zweig "ohne Token": der Agent fragte *was bedeutet
 * graph_metrics* und bekam die Massnahmenliste des ganzen Projekts. Sieben `graph_help`
 * hintereinander, 11.002 Zeichen.
 *
 * POSITIVKONTROLLE: nimmt man den Fix zurueck (`{token:"` → `{id:"` in `report.ts`,
 * `metrics.ts`, `suggest.ts`), meldet der erste Fall hier genau diese vier Stellen — geprueft am
 * 2026-09-23, bevor dieser Test gruen wurde.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { strengesSchema } from '../src/surface/mcp-server.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import type { ZodObject, ZodRawShape } from 'zod/v4';
import type { MCPTool } from '../src/kernel/tool-contract.js';

let repoRoot: string;
let harness: GraphCodeHarness;
let registry: Record<string, MCPTool>;

beforeAll(async () => {
  repoRoot = mkdtempSync(join(tmpdir(), 'gc-623-'));
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const cfg: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'gc-623', systemId: 'guide-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  harness = new GraphCodeHarness(cfg, new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') }));
  await harness.initialize();
  registry = bindToolsToHarness(harness) as unknown as Record<string, MCPTool>;
});

afterAll(async () => {
  await harness.close();
  rmSync(repoRoot, { recursive: true, force: true });
});

const shapeOf = (tool: MCPTool): string[] =>
  Object.keys((tool.inputSchema as unknown as ZodObject<ZodRawShape>).shape ?? {});

/** Jeder `werkzeug({…})`-Schnipsel einer Beschreibung, mit den darin genannten Schluesseln. */
function aufrufSchnipsel(text: string): Array<{ werkzeug: string; schluessel: string[] }> {
  const treffer: Array<{ werkzeug: string; schluessel: string[] }> = [];
  for (const m of text.matchAll(/([a-z_]+)\(\{([^}]*)\}\)/g)) {
    const schluessel = m[2]
      .split(',')
      .map((teil) => teil.split(':')[0].trim().replace(/["']/g, ''))
      .filter((k) => /^[a-zA-Z_][\w]*$/.test(k));
    if (schluessel.length > 0) treffer.push({ werkzeug: m[1], schluessel });
  }
  return treffer;
}

describe('CR-GC-623: Beschreibungen nennen nur Parameter, die es gibt', () => {
  it('jeder Aufruf-Schnipsel in jeder Beschreibung trifft die Shape seines Werkzeugs', () => {
    const fehler: string[] = [];
    let geprueft = 0;
    for (const tool of Object.values(registry)) {
      for (const { werkzeug, schluessel } of aufrufSchnipsel(tool.description)) {
        const ziel = registry[werkzeug];
        if (!ziel) continue; // kein Werkzeug dieser Registry — Prosa, nicht Aufruf
        const erlaubt = new Set(shapeOf(ziel));
        geprueft += 1;
        for (const k of schluessel) {
          if (!erlaubt.has(k)) {
            fehler.push(`${tool.name}: ${werkzeug}({${k}: …}) — ${werkzeug} kennt nur ${[...erlaubt].join(', ')}`);
          }
        }
      }
    }
    // Sonst prueft der Test nichts: es MUSS Schnipsel geben, sonst ist die Regex tot.
    expect(geprueft, 'kein einziger Aufruf-Schnipsel gefunden — die Regex ist blind').toBeGreaterThan(3);
    expect(fehler).toEqual([]);
  });

  it('graph_help nennt `token`, und `token` beantwortet die enge Frage', async () => {
    expect(shapeOf(registry.graph_help)).toContain('token');
    const eintrag = (await registry.graph_help.handler({ token: 'graph_metrics' })) as { kind?: string; id?: string };
    expect(eintrag.kind).toBe('tool');
    expect(eintrag.id).toBe('graph_metrics');
  });

  it('ohne Argument bleibt die WEITE Frage — genau die, die ein Tippfehler bisher still ausloeste', async () => {
    const kontext = (await registry.graph_help.handler({})) as { measures?: unknown[] };
    expect(Array.isArray(kontext.measures)).toBe(true);
  });

  it('das Schema an der Grenze ist streng — und nennt den falsch getippten Namen', () => {
    const streng = strengesSchema(registry.graph_help);
    const falsch = streng.safeParse({ id: 'graph_metrics' });
    expect(falsch.success, 'ohne Strenge wird daraus {} und die WEITE Frage').toBe(false);
    expect(JSON.stringify(falsch.error!.issues)).toContain('id');
    // Richtig und leer bleiben gueltig — die Strenge trifft nur den Fehlgriff.
    expect(streng.safeParse({ token: 'R-04' }).success).toBe(true);
    expect(streng.safeParse({}).success).toBe(true);
  });

  it('jedes Werkzeug der Registry bekommt ein strenges Schema, nicht nur graph_help', () => {
    const durchlaessig = Object.values(registry)
      .filter((t) => strengesSchema(t).safeParse({ dieserSchluesselExistiertNirgends: 1 }).success)
      .map((t) => t.name);
    expect(durchlaessig, 'ein durchlaessiges Werkzeug verschluckt den Fehlgriff weiter').toEqual([]);
  });
});
