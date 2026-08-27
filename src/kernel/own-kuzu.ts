/**
 * own-kuzu.ts — WER den einen Kuzu-Store eines Repos besitzt (FUNC-own-kuzu-host).
 *
 * Herausgelöst aus `surface/host.ts` mit CR-GC-447: die Entscheidung „öffne genau
 * EINEN Store — oder übernimm den bereits gewählten" ist die kernel-Invariante
 * (REQ-single-kuzu-owner), nicht die HTTP-Oberfläche, die zufällig ihr erster
 * Aufrufer war. CR-GC-446 hat `FUNC-own-kuzu-host` deshalb nach `MOD-kernel`
 * alloziert; diese Datei ist der Code-Nachzug dazu.
 *
 * Zwei Modi, EIN Besitzer (CR-GC-237):
 *   - OWN    — kein fremder Harness gereicht: `createHarness` öffnet den Store
 *              unter `<repoRoot>/.graphcode/kuzu`, der Aufrufer schließt ihn.
 *   - ATTACH — ein bereits gewählter Host (z. B. der MCP-stdio-Gewinner) reicht
 *              SEINEN Harness herein: kein zweites DB-Handle, keine Sperre
 *              angefasst, `owns: false` — wer nicht öffnet, schließt auch nicht.
 *
 * Bewusst OHNE Transport-Wissen: `scope` kommt fertig herein (die Ableitung des
 * Member-Namens ist eine Sache der Oberfläche), `onUpdateEvent` ist eine Senke,
 * die der Aufrufer stellt. Kein `node:http`, kein SSE — sonst wäre der Split nur
 * eine Umbenennung.
 *
 * @author andreas@siglochconsulting
 */
import type { HarnessConfig } from '@sigloch/contracts/harness';
import type { LiveUpdateEvent } from '@sigloch/contracts/harness';
import { createHarness, type GraphCodeHarness } from '../index.js';

export interface OwnKuzuOptions {
  /** Repo, dessen `.graphcode/kuzu` geöffnet wird (nur im OWN-Modus benutzt). */
  repoRoot: string;
  /** Scope des zu öffnenden Harness (nur im OWN-Modus benutzt). */
  scope: HarnessConfig['scope'];
  /** ATTACH: der bereits gewählte Besitzer. Gesetzt ⇒ es wird nichts geöffnet. */
  harness?: GraphCodeHarness;
  /** Senke für Live-Update-Events des geöffneten Harness (nur OWN). */
  onUpdateEvent?: (event: LiveUpdateEvent) => void;
}

export interface OwnedKuzu {
  harness: GraphCodeHarness;
  /** True genau dann, wenn HIER geöffnet wurde — nur dann darf hier geschlossen werden. */
  owns: boolean;
}

/**
 * Liefert den einen Harness über dem einen Store: den hereingereichten (ATTACH)
 * oder einen frisch geöffneten und initialisierten (OWN). `owns` sagt dem
 * Aufrufer, ob er ihn schließen muss — die einzige Stelle, an der diese Frage
 * beantwortet wird.
 */
export async function ownKuzu(opts: OwnKuzuOptions): Promise<OwnedKuzu> {
  if (opts.harness) {
    // ATTACH: der gewählte Host besitzt den Store bereits. Wir fassen weder
    // Sperre noch Event-Senke an — die stand zu SEINER createHarness-Zeit fest.
    return { harness: opts.harness, owns: false };
  }
  const harness = await createHarness(
    { repoRoot: opts.repoRoot, scope: opts.scope },
    opts.onUpdateEvent ? { onUpdateEvent: opts.onUpdateEvent } : {},
  );
  await harness.initialize();
  return { harness, owns: true };
}
