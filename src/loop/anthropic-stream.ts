/**
 * anthropic-stream.ts — die Antwort von /v1/messages lesen, gestreamt oder am Stueck (CR-GC-662).
 *
 * Dieselbe Grenze wie im openai-Zweig (CR-GC-656): Nodes eingebautes fetch bricht nach 300 s ohne
 * Antwortkopf ab (UND_ERR_HEADERS_TIMEOUT, nachgewiesen). Der Frontier-Arm laeuft mit bis zu 32.000
 * Ausgabe-Token und denkendem Opus — eine Antwort ueber 5 Minuten ist erreichbar. Gestreamt kommt der
 * Kopf sofort.
 *
 * Die SSE-Ereignisse werden zur Nicht-Streaming-Form `{content, stop_reason, usage}` zusammengesetzt;
 * die Vertragspruefung (`AnthropicWireAnswer`) laeuft danach unveraendert an ihrer einen Stelle.
 * Denk-Bloecke behalten ihre Signatur vollstaendig — die Schleife schickt sie unveraendert zurueck
 * (CR-GC-572); ein beschnittener Block wird von der API abgewiesen.
 *
 * Zwei Antwortformen, beide vom Protokoll zugelassen, kein Rueckfall: der Server streamt
 * (`text/event-stream`) oder antwortet mit JSON (Fehlerantworten, Testattrappen).
 *
 * @author andreas@siglochconsulting
 */

type Block = Record<string, unknown> & { type: string };

export async function leseAnthropicAntwort(r: Response): Promise<unknown> {
  const typ = r.headers?.get?.('content-type') ?? '';
  if (!typ.includes('text/event-stream') || !r.body) return r.json();

  let nachricht: Record<string, unknown> = {};
  const bloecke: Block[] = [];
  const teilJson = new Map<number, string>();
  let stopReason: unknown = null;
  let usage: Record<string, unknown> = {};

  const verarbeite = (zeile: string): void => {
    if (!zeile.startsWith('data:')) return;
    const nutz = zeile.slice(5).trim();
    if (!nutz) return;
    const e = JSON.parse(nutz) as {
      type: string;
      index?: number;
      message?: Record<string, unknown> & { usage?: Record<string, unknown> };
      content_block?: Block;
      delta?: Record<string, unknown> & { type?: string };
      usage?: Record<string, unknown>;
      error?: unknown;
    };
    switch (e.type) {
      case 'error':
        throw new Error('backend: ' + JSON.stringify(e).slice(0, 300));
      case 'message_start':
        nachricht = { ...(e.message ?? {}) };
        usage = { ...(e.message?.usage ?? {}) };
        break;
      case 'content_block_start':
        bloecke[e.index ?? bloecke.length] = { ...(e.content_block as Block) };
        break;
      case 'content_block_delta': {
        const b = bloecke[e.index ?? 0];
        const d = e.delta ?? {};
        if (!b) break;
        if (d.type === 'text_delta') b.text = String(b.text ?? '') + String(d.text ?? '');
        else if (d.type === 'input_json_delta')
          teilJson.set(e.index ?? 0, (teilJson.get(e.index ?? 0) ?? '') + String(d.partial_json ?? ''));
        else if (d.type === 'thinking_delta') b.thinking = String(b.thinking ?? '') + String(d.thinking ?? '');
        else if (d.type === 'signature_delta') b.signature = String(b.signature ?? '') + String(d.signature ?? '');
        break;
      }
      case 'content_block_stop': {
        const i = e.index ?? 0;
        const roh = teilJson.get(i);
        if (bloecke[i]?.type === 'tool_use' && roh !== undefined) {
          // Am Token-Budget abgeschnittenes JSON: dieselbe Form wie die ungestreamte Antwort — `input: {}`,
          // der Grund steht in `stop_reason: max_tokens` und in der Spur (CR-GC-572). Kein Wurf, der ihn
          // zu einem namenlosen „call failed" machen wuerde.
          try {
            bloecke[i].input = roh.trim() ? JSON.parse(roh) : {};
          } catch {
            bloecke[i].input = {};
          }
        }
        break;
      }
      case 'message_delta':
        if (e.delta && 'stop_reason' in e.delta) stopReason = e.delta.stop_reason;
        // output_tokens im message_delta ist kumulativ — ersetzt, addiert nicht.
        usage = { ...usage, ...(e.usage ?? {}) };
        break;
      default:
        break; // ping, message_stop
    }
  };

  const dekoder = new TextDecoder();
  let puffer = '';
  for await (const teil of r.body as unknown as AsyncIterable<Uint8Array>) {
    puffer += dekoder.decode(teil, { stream: true });
    let nl: number;
    while ((nl = puffer.indexOf('\n')) >= 0) {
      verarbeite(puffer.slice(0, nl).trim());
      puffer = puffer.slice(nl + 1);
    }
  }
  verarbeite((puffer + dekoder.decode()).trim());

  return { ...nachricht, content: bloecke.filter(Boolean), stop_reason: stopReason, usage };
}
