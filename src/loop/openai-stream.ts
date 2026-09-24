/**
 * openai-stream.ts — die Antwort von /v1/chat/completions lesen, gestreamt oder am Stueck
 * (CR-GC-656).
 *
 * Warum gestreamt: Nodes eingebautes fetch (undici) wartet hoechstens 300 s auf den Antwortkopf —
 * nachgewiesen: `fetch failed`, cause UND_ERR_HEADERS_TIMEOUT nach 301,4 s, obwohl
 * `AbortSignal.timeout(600 s)` gesetzt war. Ohne Streaming schickt der Server den Kopf erst mit der
 * fertigen Antwort; ein Thinking-Modell (qwen3.8-27b: 5–8k Denk-Token bei ~23 tok/s) braucht
 * laenger und scheiterte deshalb unabhaengig von `callTimeoutMs`. Gestreamt kommt der Kopf sofort,
 * danach fliessen die Token laufend.
 *
 * Zwei Antwortformen, beide vom Protokoll zugelassen — kein Rueckfall: der Server streamt
 * (`text/event-stream`), oder er ignoriert `stream` und antwortet mit JSON. Beide werden zur
 * GLEICHEN Drahtform zusammengesetzt; die Vertragspruefung (`OpenAiWireAnswer`) laeuft danach
 * unveraendert an genau einer Stelle.
 *
 * @author andreas@siglochconsulting
 */

interface Ruf {
  id: string;
  name: string;
  arguments: string;
}

/** Die Antwort als Drahtform `{choices:[{finish_reason, message}], usage}` — gestreamt oder nicht. */
export async function leseOpenAiAntwort(r: Response): Promise<unknown> {
  const typ = r.headers?.get?.('content-type') ?? '';
  if (!typ.includes('text/event-stream') || !r.body) return r.json();

  let inhalt = '';
  let denken = '';
  let ende: string | null = null;
  let nutzung: unknown;
  const rufe: Ruf[] = [];

  const verarbeite = (zeile: string): void => {
    if (!zeile.startsWith('data:')) return;
    const nutz = zeile.slice(5).trim();
    if (!nutz || nutz === '[DONE]') return;
    const stueck = JSON.parse(nutz) as {
      error?: unknown;
      usage?: unknown;
      choices?: {
        finish_reason?: string | null;
        delta?: {
          content?: string | null;
          reasoning?: string | null;
          reasoning_content?: string | null;
          tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
        };
      }[];
    };
    if (stueck.error) throw new Error('backend: ' + JSON.stringify(stueck).slice(0, 300));
    if (stueck.usage) nutzung = stueck.usage;
    const wahl = stueck.choices?.[0];
    if (!wahl) return;
    if (wahl.finish_reason) ende = wahl.finish_reason;
    const d = wahl.delta ?? {};
    if (typeof d.content === 'string') inhalt += d.content;
    // Ollama nennt das Feld `reasoning`, LM Studio `reasoning_content`.
    const dk = d.reasoning ?? d.reasoning_content;
    if (typeof dk === 'string') denken += dk;
    for (const t of d.tool_calls ?? []) {
      const i = t.index ?? rufe.length;
      const ruf = (rufe[i] ??= { id: '', name: '', arguments: '' });
      if (t.id) ruf.id = t.id;
      if (t.function?.name) ruf.name += t.function.name;
      if (t.function?.arguments) ruf.arguments += t.function.arguments;
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

  const gesetzt = rufe.filter(Boolean);
  return {
    choices: [
      {
        finish_reason: ende,
        message: {
          role: 'assistant',
          content: inhalt,
          ...(denken ? { reasoning: denken } : {}),
          ...(gesetzt.length
            ? {
                tool_calls: gesetzt.map((c) => ({
                  id: c.id,
                  type: 'function',
                  function: { name: c.name, arguments: c.arguments },
                })),
              }
            : {}),
        },
      },
    ],
    ...(nutzung ? { usage: nutzung } : {}),
  };
}
