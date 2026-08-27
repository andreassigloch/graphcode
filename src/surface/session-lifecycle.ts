/**
 * session-lifecycle.ts — ein Host lebt so lange wie seine Session (CR-GC-370).
 *
 * Der Befund, aus dem dieses Modul entstand: elf `graphcode mcp`-Hosts auf einer
 * Maschine, fünf davon drei Tage alt, jeder mit dem Store-Lock seines Repos in der
 * Hand. `serveStdio` hatte keinen Shutdown-Pfad — der Host starb nur, wenn das OS ihn
 * tötete. Ein Zombie-Host ist teurer als ein fehlender: er hält den Lock, also läuft
 * jede neue Session als Proxy eines Editors, den es nicht mehr gibt, und niemand
 * startet mehr ein Dashboard.
 *
 * Deshalb: EIN Abräumpfad, den alle Auslöser teilen (Signale, stdin-EOF), nicht je
 * Ressource ein eigener Handler. Abgeräumt wird in umgekehrter Registrierungsreihenfolge
 * — der Store-Lock zuletzt, weil alles andere ihn voraussetzt.
 *
 * Best-effort mit hartem Deckel: ein hängender Kuzu-Shutdown darf den Lock nicht behalten,
 * sonst ist der nächste Start wieder ein Proxy. Nach `GRACE_MS` wird beendet, was noch
 * läuft oder nicht.
 *
 * @author andreas@siglochconsulting
 */

/** Wie lange der geordnete Abbau bekommt, bevor hart beendet wird. */
const GRACE_MS = 3000;

/** Eine Ressource, die beim Sessionende freigegeben werden muss. */
export interface Closeable {
  /** Für die stderr-Zeile, wenn das Freigeben fehlschlägt. */
  name: string;
  close: () => void | Promise<void>;
}

interface TriggerDeps {
  /** Prozess-Signale; injizierbar, damit Tests keine echten Handler anhängen. */
  onSignal?: (sig: NodeJS.Signals, handler: () => void) => void;
  /** Ende des stdio-Clients: das Signal, das ein geschlossenes Editor-Fenster liefert. */
  onStdinEnd?: (handler: () => void) => void;
  exit?: (code: number) => void;
  write?: (msg: string) => void;
  setTimeoutImpl?: typeof setTimeout;
}

/**
 * Sammelt die Ressourcen einer Host-Session und gibt sie genau einmal frei.
 *
 * Reihenfolge ist Absicht: registriert wird in Aufbaureihenfolge (Harness zuerst),
 * abgebaut wird rückwärts — der Viewer zuerst, der Lock zuletzt.
 */
export class SessionLifecycle {
  private readonly closeables: Closeable[] = [];
  private closing = false;

  constructor(private readonly deps: TriggerDeps = {}) {}

  add(c: Closeable): void {
    this.closeables.push(c);
  }

  /** Läuft der Abbau bereits? (Verhindert doppelte Auslösung, z. B. SIGTERM nach stdin-EOF.) */
  get isClosing(): boolean {
    return this.closing;
  }

  /**
   * Gibt alles frei. Ein Fehlschlag stoppt die Kette nicht — die Ressource dahinter
   * (im Zweifel der Store-Lock) ist wichtiger als die davor.
   */
  async shutdown(reason: string): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    const write = this.deps.write ?? ((m: string) => void process.stderr.write(m));
    write(`[graphcode] host: shutting down (${reason})\n`);
    for (const c of [...this.closeables].reverse()) {
      try {
        await c.close();
      } catch (err) {
        write(`[graphcode] WARN: ${c.name} not released cleanly (${err instanceof Error ? err.message : String(err)})\n`);
      }
    }
  }

  /**
   * Bindet die Auslöser: jedes Abbruchsignal UND das Ende des stdio-Clients. stdin-EOF
   * ist der wichtigere der beiden — ein geschlossenes Editor-Fenster schickt nicht
   * zwingend ein Signal, aber es schließt immer die Pipe.
   */
  installTriggers(): void {
    const onSignal = this.deps.onSignal ?? ((sig, h) => void process.on(sig, h));
    const onStdinEnd =
      this.deps.onStdinEnd ??
      ((h) => {
        process.stdin.on('end', h);
        process.stdin.on('close', h);
      });
    const exit = this.deps.exit ?? ((code: number) => process.exit(code));
    const setTimeoutFn = this.deps.setTimeoutImpl ?? setTimeout;

    const teardown = (reason: string): void => {
      if (this.closing) return;
      // Der Deckel läuft PARALLEL zum Abbau: hängt eine Freigabe, wird trotzdem beendet,
      // statt den Lock zu behalten. unref, damit der Timer den Prozess nicht am Leben hält.
      const cap = setTimeoutFn(() => exit(0), GRACE_MS);
      (cap as { unref?: () => void }).unref?.();
      void this.shutdown(reason).then(() => exit(0));
    };

    for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
      onSignal(sig, () => teardown(sig));
    }
    onStdinEnd(() => teardown('client disconnected'));
  }
}
