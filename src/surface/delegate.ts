/**
 * delegate.ts — `graph_delegate`: ein angedockter Client gibt Modellarbeit an den Executor im
 * Host-Prozess ab (CR-GC-714, Zielkette D2).
 *
 * WARUM im Host: der Executor schreibt über dieselbe Registry wie der Client — derselbe Prozess,
 * derselbe Store, derselbe Gate. `graphcode run` als zweiter Prozess scheitert am Store-Lock,
 * solange ein Client angedockt ist (gemessen 2026-09-28 in agentdiary-local).
 *
 * WARUM kein Umbau des Executors: der Rückkanal existiert seit CR-GC-667 als `ask` — eine Funktion,
 * die Fragen bekommt und eine Antwort verspricht. Hier ist dieses Versprechen der Haltepunkt
 * zwischen zwei Werkzeugaufrufen: die Frage beendet den ersten Aufruf, der zweite löst das
 * Versprechen mit der Antwort ein, der Lauf geht weiter. `graphcode run` und `graph_delegate`
 * rufen denselben `runExecutor`.
 *
 * WARUM ein Warte-Budget je Aufruf: ein lokaler Lauf dauert Minuten bis Stunden, ein
 * MCP-Werkzeugaufruf hat im Client eine Zeitgrenze. Der Aufruf kehrt deshalb spätestens nach
 * `wartenSek` mit `laeuft` zurück; der Lauf arbeitet im Host weiter, `graph_delegate({})` wartet
 * auf das nächste Ereignis.
 *
 * @author andreas@siglochconsulting
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { z } from 'zod/v4';
import type { MCPTool, MCPToolRegistry } from '../kernel/tool-contract.js';
import type { LoadedConfig } from '../kernel/config.js';
import { GRAPHCODE_DIR } from '../kernel/workspace.js';
import {
  ExecutorConfigSchema,
  runExecutor,
  type CallModel,
  type ExecutorConfig,
  type ExecutorStats,
} from '../loop/executor.js';
import type { ToolContext } from './tool-context.js';
import { ANALYSE_TASKS } from '../loop/task-artifact.js';

/**
 * Der Abschnitt `executor` in `graphcode.config.jsonc`. Die Datei ist eingecheckt — deshalb kein
 * `apiKey`, sondern `apiKeyFile` (Pfad, `~` erlaubt). `interactive` und `candidates` sind keine
 * Felder: eine Delegation fragt immer zurück, und Best-of-N hält nicht je Kandidat an.
 */
export const DelegateConfigSchema = ExecutorConfigSchema.omit({
  apiKey: true,
  interactive: true,
  candidates: true,
  judge: true,
})
  .extend({ apiKeyFile: z.string().min(1).optional() })
  .strict();
export type DelegateConfig = z.infer<typeof DelegateConfigSchema>;

/** Roh-Abschnitt aus der Config → geprüfte Delegations-Config; fehlt er, gibt es kein Werkzeug. */
export function delegateConfigOf(raw: unknown, configPath: string): DelegateConfig | undefined {
  if (raw === undefined) return undefined;
  const result = DelegateConfigSchema.safeParse(raw);
  if (!result.success) {
    const fields = result.error.issues.map((i) => `executor.${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`${configPath}: Abschnitt executor ungültig — ${fields}`);
  }
  return result.data;
}

/** Die Bindung des Werkzeugs aus der geladenen Repo-Config — Host und Proxy lesen dieselbe. */
export function delegateBindingOf(loaded: LoadedConfig): DelegateBinding | undefined {
  const config = delegateConfigOf(loaded.config.executor, loaded.path);
  return config ? { config } : undefined;
}

function expandHome(path: string, repoRoot: string): string {
  if (path === '~' || path.startsWith('~/')) return join(homedir(), path.slice(1));
  return isAbsolute(path) ? path : join(repoRoot, path);
}

/** Die Lauf-Config: Schlüssel frisch von der Platte gelesen, interactive fest an. */
export function executorConfigFor(cfg: DelegateConfig, repoRoot: string, maxRounds?: number): ExecutorConfig {
  const { apiKeyFile, ...rest } = cfg;
  const apiKey = apiKeyFile ? readFileSync(expandHome(apiKeyFile, repoRoot), 'utf8').trim() : undefined;
  return ExecutorConfigSchema.parse({
    ...rest,
    ...(apiKey ? { apiKey } : {}),
    ...(maxRounds ? { maxRounds } : {}),
    interactive: true,
  });
}

// ---------------------------------------------------------------------------
// Die laufende Delegation — höchstens eine je Host.
// ---------------------------------------------------------------------------

export interface DelegationErgebnis {
  stopReason: ExecutorStats['stopReason'];
  runden: number;
  angewandt: number;
  abgelehnt: number;
  fragen: string[];
  tokensIn: number;
  tokensOut: number;
}

type Ereignis =
  | { status: 'frage'; fragen: string[] }
  | { status: 'fertig'; ergebnis: DelegationErgebnis }
  | { status: 'fehler'; fehler: string };

class Delegation {
  private ereignisse: Ereignis[] = [];
  private wartender: ((e: Ereignis) => void) | null = null;
  private antwort: ((a: string) => void) | null = null;
  letzteSpur = '';

  melde(e: Ereignis): void {
    if (this.wartender) {
      const w = this.wartender;
      this.wartender = null;
      w(e);
    } else {
      this.ereignisse.push(e);
    }
  }

  /** Der Rückkanal für runExecutor: meldet die Fragen und hält bis zur Antwort an. */
  frage = (fragen: readonly string[]): Promise<string> =>
    new Promise<string>((resolve) => {
      this.antwort = resolve;
      this.melde({ status: 'frage', fragen: [...fragen] });
    });

  get wartetAufAntwort(): boolean {
    return this.antwort !== null;
  }

  beantworte(text: string): void {
    const a = this.antwort;
    this.antwort = null;
    a?.(text);
  }

  /** Das nächste Ereignis oder null, wenn das Warte-Budget vorher abläuft. */
  naechstes(ms: number): Promise<Ereignis | null> {
    const vorhanden = this.ereignisse.shift();
    if (vorhanden) return Promise.resolve(vorhanden);
    return new Promise((resolve) => {
      const uhr = setTimeout(() => {
        this.wartender = null;
        resolve(null);
      }, ms);
      this.wartender = (e) => {
        clearTimeout(uhr);
        resolve(e);
      };
    });
  }
}

/**
 * Das Warte-Budget eines Aufrufs (CR-GC-726). MCP-Clients brechen einen Aufruf nach 60 s ab
 * (Vorgabe des MCP-SDK; OpenCode 1.18 übernimmt sie). Wartet der Host länger, sieht der Client
 * „Request timed out“ statt `laeuft`, und ein Ereignis, das dem abgebrochenen Aufruf zugestellt
 * wird, ist verloren. Gemessen im Lauf local-3 (2026-10-02): Vorgabe 120 s, Executor-Runde 85 s —
 * der Client hielt graphcode für defekt und begann zu coden, der Executor schrieb unbemerkt weiter.
 * Darum bleibt auch die Obergrenze unter 60 s.
 */
export const WARTEN_VORGABE_SEK = 45;
export const WARTEN_MAX_SEK = 55;

/** Die Spur der Delegationen eines Repos, eine Zeile je Schritt — lesbar, auch wenn kein Aufruf wartet. */
export const DELEGATION_LOG = 'delegation.log';

export const DelegateInputSchema = z
  .object({
    auftrag: z
      .string()
      .min(1)
      .optional()
      .describe('Startet eine Delegation: die Modellarbeit in Prosa, oder ein Verweis auf material/<datei>, das du angelegt hast.'),
    task: z
      .enum(ANALYSE_TASKS)
      .optional()
      .describe('Analyse statt Kernarbeit: conops, trade, irr (Annahmen), fmea, plan (Bauaufträge). auftrag ist dann optional.'),
    antwort: z
      .string()
      .optional()
      .describe('Antwort auf die offenen Fragen der laufenden Delegation. Leer = als Annahme mit offenem Wert anlegen.'),
    maxRounds: z.number().int().positive().optional().describe('Rundenbudget dieser Delegation (Vorgabe aus der Config).'),
    wartenSek: z
      .number()
      .int()
      .min(1)
      .max(WARTEN_MAX_SEK)
      .default(WARTEN_VORGABE_SEK)
      .describe('Längstens so lange wartet dieser Aufruf; danach status laeuft, und graph_delegate({}) wartet weiter.'),
  })
  .strict();

export interface DelegateBinding {
  config: DelegateConfig;
  /** Test-Injektion — Produktion lässt runExecutor den HTTP-Backend-Call bauen. */
  callModel?: CallModel;
}

const WEITER = 'graph_delegate({}) wartet weiter auf den Lauf.';
const ANTWORTEN =
  'Beantworte die Fragen selbst, per Recherche oder beim Nutzer und rufe graph_delegate({antwort}); ' +
  'eine leere Antwort legt sie als Annahme mit offenem Wert an.';

/**
 * Bindet `graph_delegate` an die fertige Registry. Der Executor bekommt die Registry OHNE sich
 * selbst — er soll nicht delegieren können (WITHHELD_TOOLS hält es zusätzlich aus seinem Angebot).
 */
export function bindDelegateTool(
  registry: MCPToolRegistry,
  ctx: ToolContext,
  binding: DelegateBinding,
): MCPTool<z.infer<typeof DelegateInputSchema>, unknown> {
  let laufend: Delegation | null = null;

  async function antwortAuf(d: Delegation, wartenSek: number): Promise<unknown> {
    const e = await d.naechstes(wartenSek * 1000);
    if (!e) return { status: 'laeuft', spur: d.letzteSpur, hinweis: WEITER };
    if (e.status === 'frage') return { status: 'frage', fragen: e.fragen, hinweis: ANTWORTEN };
    laufend = null;
    return e;
  }

  return {
    name: 'graph_delegate',
    description:
      'Gibt Modellarbeit an den Executor im graphcode-Host ab (lokales Modell aus graphcode.config.jsonc). ' +
      'Der Executor übersetzt die Gate-Rückmeldungen und schreibt durch dasselbe Gate. ' +
      'Antwort: status fertig (Ergebnis), frage (offene Fragen — mit {antwort} fortsetzen), ' +
      'laeuft (Warte-Budget abgelaufen — mit {} weiter warten) oder fehler. Höchstens eine Delegation zugleich.',
    inputSchema: DelegateInputSchema,
    async handler(input) {
      // CR-GC-724: auch ein Task allein startet eine Delegation — die Intention steht dann am SYS.
      if (input.auftrag !== undefined || input.task !== undefined) {
        if (laufend) {
          throw new Error(
            'graph_delegate: es läuft bereits eine Delegation — rufe graph_delegate({}) auf, um auf sie zu warten' +
              (laufend.wartetAufAntwort ? ', oder graph_delegate({antwort}), sie hat eine offene Frage.' : '.'),
          );
        }
        if (input.antwort !== undefined) throw new Error('graph_delegate: auftrag und antwort schließen sich aus.');
        const repoRoot = ctx.harness.getRepoRoot();
        const config = executorConfigFor(binding.config, repoRoot, input.maxRounds);
        const d = new Delegation();
        laufend = d;
        const spurDatei = join(repoRoot, GRAPHCODE_DIR, DELEGATION_LOG);
        const spur = (zeile: string): void => {
          d.letzteSpur = zeile;
          appendFileSync(spurDatei, `${new Date().toISOString()}\t${zeile.replace(/\n/g, ' ⏎ ')}\n`);
        };
        spur(`[delegation] start ${input.task ? `task=${input.task} ` : ''}modell=${config.model}`);
        const eigene = Object.fromEntries(Object.entries(registry).filter(([n]) => n !== 'graph_delegate'));
        // Herkunft im Audit: diese Züge schrieb das Executor-Modell im Auftrag des Clients.
        ctx.setOrigin({ model: config.model, intent: input.auftrag ?? `Task ${input.task}` });
        void runExecutor({
          registry: eigene,
          workspaceDir: repoRoot,
          intent: input.auftrag,
          task: input.task,
          config,
          callModel: binding.callModel,
          ask: (fragen) => {
            spur(`[delegation] frage ${fragen.join(' | ')}`);
            return d.frage(fragen);
          },
          trace: spur,
        })
          .then((s) => {
            spur(`[delegation] fertig stop=${s.stopReason} runden=${s.genRounds} angewandt=${s.mutatesApplied} abgelehnt=${s.mutatesRejected}`);
            d.melde({
              status: 'fertig',
              ergebnis: {
                stopReason: s.stopReason,
                runden: s.genRounds,
                angewandt: s.mutatesApplied,
                abgelehnt: s.mutatesRejected,
                fragen: s.questions,
                // CR-GC-724: die Analyse gilt nur als durchgeführt, wenn ihr Artefakt im Modell steht.
                ...(input.task ? { analyse: { task: input.task, durchgefuehrt: s.taskStempel !== undefined, artefakt: s.taskStempel?.einheiten ?? [] } } : {}),
                tokensIn: s.tokensIn,
                tokensOut: s.tokensOut,
              },
            });
          })
          .catch((err: unknown) => {
            const fehler = err instanceof Error ? err.message : String(err);
            spur(`[delegation] fehler ${fehler}`);
            d.melde({ status: 'fehler', fehler });
          })
          .finally(() => ctx.setOrigin({}));
        return antwortAuf(d, input.wartenSek);
      }
      if (!laufend) throw new Error('graph_delegate: keine Delegation läuft — starte mit {auftrag} oder {task}.');
      if (input.antwort !== undefined) {
        if (!laufend.wartetAufAntwort) throw new Error('graph_delegate: der Executor hat keine offene Frage.');
        appendFileSync(
          join(ctx.harness.getRepoRoot(), GRAPHCODE_DIR, DELEGATION_LOG),
          `${new Date().toISOString()}\t[delegation] antwort ${input.antwort.replace(/\n/g, ' ⏎ ')}\n`,
        );
        laufend.beantworte(input.antwort);
      }
      return antwortAuf(laufend, input.wartenSek);
    },
  };
}
