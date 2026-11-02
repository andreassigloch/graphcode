/**
 * live-feed.ts — der Weg der Live-Events zu den Abonnenten am Host-Socket (CR-GC-809).
 *
 * Wer abonniert, bekommt zuerst den ganzen Stand samt Version, danach jedes Event in Schreibreihenfolge.
 * Der Viewer hängt damit am Host statt an der Datei; die Datei bleibt das Export-Artefakt für git, Diff
 * und seed-on-empty. Kein HTTP und kein Port: der Socket gehört schon dem Host (CR-GC-235).
 *
 * @author andreas@siglochconsulting
 */
import { graphToFormatE } from '@sigloch/graph-api-core';
import type { Graph } from '@sigloch/graph-api-core';
import type { HostSnapshot } from '@sigloch/graphcode-client';
import type { LiveUpdateEvent } from './emit.js';

export type FeedFrame = HostSnapshot | LiveUpdateEvent;

export class LiveFeed {
  private readonly subscribers = new Set<(frame: FeedFrame) => void>();

  constructor(private readonly state: { graph: () => Graph; version: () => number }) {}

  /** Liefert sofort den Stand und danach die Events. Gibt die Abmeldung zurück. */
  subscribe(onFrame: (frame: FeedFrame) => void): () => void {
    onFrame({ type: 'snapshot', version: this.state.version(), formatE: graphToFormatE(this.state.graph()) });
    this.subscribers.add(onFrame);
    return () => this.subscribers.delete(onFrame);
  }

  publish(event: LiveUpdateEvent): void {
    for (const onFrame of this.subscribers) onFrame(event);
  }
}
