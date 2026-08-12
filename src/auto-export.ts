/**
 * auto-export.ts — der Export folgt der Mutation (CR-GC-323, MOD-mcp-tools).
 *
 * `graph_mutate` schreibt nur den Store; `docs/graph/*.graph.json` + `docs/views/*.md`
 * ändern sich erst bei `graph_export`. Jeder Konsument, der die committete SSOT liest —
 * GVE lauscht auf genau diese Dateien und hat keinen anderen Trigger — sah deshalb nach
 * einer Agent-Mutation weiter den alten Stand, bis jemand von Hand exportiert hat.
 *
 * Hier hängt der Export als post-apply-Hook an die Mutation. Zwei Eigenschaften, ohne
 * die das nicht tragbar wäre:
 *   - COALESCING (trailing debounce): ein Agent-Batch aus N `graph_mutate`-Calls schreibt
 *     EINEN Export, nicht N. Der Export kostet ~10 ms für ~450 Elemente, aber er schreibt
 *     jedes Mal den ganzen Graphen + alle 16 Views — N-mal in Folge ist reine Schreiblast
 *     und N SSE-Invalidates bei jedem Leser.
 *   - SINGLE-FLIGHT: nie zwei Exporte gleichzeitig. Läuft einer, wird ein weiterer Anlass
 *     gemerkt und danach EINMAL nachgezogen (letzter Stand gewinnt).
 *
 * Der Hook blockiert die Mutation nicht: er stellt nur den Timer und kehrt zurück
 * (`runPostApplyHooks` wird von `mutate()` awaited). Ein Export-Fehler kippt nie eine
 * erfolgreiche Mutation — die Daten liegen bereits im Store; der Fehler geht nach stderr
 * (stdout gehört dem MCP-Transport) und der `export-pending`-Marker bleibt gesetzt, sodass
 * der pre-commit-Freshness-Guard den fehlenden Export weiterhin sieht.
 *
 * @author andreas@siglochconsulting
 */
import type { GraphCodeHarness } from './harness.js';
import type { MCPTool } from './mcp-tools.js';

/** Ruhezeit nach der letzten Mutation, bevor exportiert wird. */
export const AUTO_EXPORT_DEBOUNCE_MS = 250;

export interface AutoExportHandle {
  /** Hook-Id im HookSystem — für Tests/Diagnose. */
  hookId: string;
  /** Sofort exportieren statt auf den Timer zu warten; resolved nach dem Schreiben. */
  flush(): Promise<void>;
  /** Anstehenden Timer verwerfen (Shutdown, Tests). */
  cancel(): void;
}

/**
 * Registriert den Auto-Export am Harness. Aufrufer ist der ELECTED HOST (`bootHost`) —
 * nicht `bindToolsToHarness`: nur der Host besitzt den Store und schreibt, ein Proxy oder
 * eine Test-Registry darf nicht ungefragt ins Repo schreiben.
 *
 * `graphExport` ist das gebundene `graph_export`-Tool derselben Registry — derselbe
 * Refuse-to-Clobber-Guard, derselbe Pfad, kein zweiter Schreibweg.
 */
export function registerAutoExport(
  harness: GraphCodeHarness,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graphExport: MCPTool<any, any>,
  opts: {
    debounceMs?: number;
    onError?: (err: unknown) => void;
  } = {},
): AutoExportHandle {
  const debounceMs = opts.debounceMs ?? AUTO_EXPORT_DEBOUNCE_MS;
  const onError =
    opts.onError ??
    ((err: unknown) => {
      process.stderr.write(
        `[graphcode] auto-export after mutate failed: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    });

  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  let pending = false; // während eines laufenden Exports kam eine weitere Mutation

  async function runExport(): Promise<void> {
    try {
      // force:false — Löschungen aus EIGENEN, auditierten Batches lässt der Guard über die
      // Provenienz durch (CR-GC-296); eine fremde/stale Löschung soll auch hier abbrechen.
      await graphExport.handler({ force: false });
    } catch (err) {
      onError(err);
    }
  }

  function fire(): void {
    timer = null;
    if (running) {
      pending = true;
      return;
    }
    running = runExport().then(() => {
      running = null;
      if (pending) {
        pending = false;
        schedule();
      }
    });
  }

  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fire, debounceMs);
    // Der Timer darf den Host-Prozess nicht am Leben halten.
    timer.unref?.();
  }

  const hookId = harness.getHooks().registerHook(
    'post-apply',
    (data) => {
      if (data.phase !== 'post-apply') return;
      const { success, mutations } = data.result;
      // Nur echte Änderungen: ein geblockter oder no-op-Batch hat nichts zu exportieren.
      if (!success || mutations === 0) return;
      schedule();
    },
    { id: 'auto-export' },
  );

  return {
    hookId,
    async flush(): Promise<void> {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      while (running) await running;
      await runExport();
    },
    cancel(): void {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = false;
    },
  };
}
