/**
 * render-verb.ts — `graphcode render <view> --format md|docx|pdf [--out <datei>]` (CR-GC-909).
 *
 * Gibt eine Sicht als Datei aus: Markdown fuer das Repo, Word fuer das Review mit Kommentaren im
 * Fachbereich, PDF fuer die Lieferung an Stakeholder. Markdown bleibt die Quelle: dieselbe
 * `exportMarkdown`-Projektion wie `graph_export`, docx und pdf macht `pandoc` daraus, PDF ueber
 * HTML mit `weasyprint` (Entscheidung des Auftraggebers 2026-11-12). Beide Programme erwartet das
 * Verb auf dem PATH wie `pdftotext`; fehlt eines, nennt es den Installationsbefehl, schreibt keine
 * Datei und endet mit Exit-Code 2 (`RenderToolMissingError`).
 *
 * Die Vorlage fuer PDF ist `docs/vorlagen/srs.css` im Repo, in dem das Verb laeuft — die Firmen-CI
 * eines Repos liegt dort, nicht im Paket. Fehlt die Datei, rendert pandoc mit seinem eigenen Stil,
 * und die Zusammenfassung sagt `vorlage: null`.
 *
 * Harness-Lifecycle (createHarness, seedFromJson-Paritaet, close im finally) wie
 * `executeImportCode` — kein Parallelweg. Das Verb liest nur; es schreibt nichts in den Graphen.
 *
 * @author andreas@siglochconsulting
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createHarness } from './create-harness.js';
import { deriveMemberName } from './mcp-server.js';
import { exportMarkdown, MarkdownViewSchema, VIEW_FILENAMES, type MarkdownView } from '../projections/exporter.js';

export const RENDER_FORMATS = ['md', 'docx', 'pdf'] as const;
export type RenderFormat = (typeof RENDER_FORMATS)[number];

/** Die Vorlage fuer PDF, relativ zum Repo. */
export const STYLESHEET_REL = 'docs/vorlagen/srs.css';

/** Ein Programm, das das Verb braucht, fehlt auf dem PATH. Die CLI endet dann mit Exit-Code 2. */
export class RenderToolMissingError extends Error {
  constructor(
    readonly tool: string,
    readonly install: string,
  ) {
    super(`${tool} fehlt auf dem PATH. Installieren: ${install}`);
    this.name = 'RenderToolMissingError';
  }
}

export interface RenderSummary {
  view: MarkdownView;
  format: RenderFormat;
  out: string;
  bytes: number;
  vorlage: string | null;
}

const INSTALL: Record<string, string> = {
  pandoc: 'brew install pandoc  (Linux: apt install pandoc)',
  weasyprint: 'brew install weasyprint  (Linux: pip install weasyprint)',
};

function requireTool(tool: string): void {
  const probe = spawnSync(tool, ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) throw new RenderToolMissingError(tool, INSTALL[tool] ?? tool);
}

/** Die Programme, die ein Format braucht — geprueft, bevor der Store geoeffnet wird. */
export function requiredTools(format: RenderFormat): string[] {
  if (format === 'md') return [];
  return format === 'pdf' ? ['pandoc', 'weasyprint'] : ['pandoc'];
}

export async function executeRender(opts: {
  repoRoot: string;
  view: string;
  format: string;
  out?: string;
}): Promise<RenderSummary> {
  const view = MarkdownViewSchema.parse(opts.view);
  if (!(RENDER_FORMATS as readonly string[]).includes(opts.format)) {
    throw new Error(`graphcode render: unbekanntes Format "${opts.format}" — erlaubt: ${RENDER_FORMATS.join(', ')}`);
  }
  const format = opts.format as RenderFormat;
  for (const tool of requiredTools(format)) requireTool(tool);

  const base = VIEW_FILENAMES[view].replace(/\.md$/, '');
  const out = resolve(opts.repoRoot, opts.out ?? `${base}.${format}`);
  const stylesheet = join(opts.repoRoot, STYLESHEET_REL);
  const vorlage = format === 'pdf' && existsSync(stylesheet) ? STYLESHEET_REL : null;

  const member = deriveMemberName(opts.repoRoot);
  const harness = await createHarness({ repoRoot: opts.repoRoot, scope: { workspaceId: member, systemId: member } });
  await harness.initialize();
  let markdown: string;
  try {
    if (harness.getGraph().nodes.length === 0) {
      try {
        await harness.seedFromJson(); // Paritaet zu `graphcode mcp`: seed-on-empty
      } catch {
        // frisches Repo ohne committeten Graphen — die Sicht zeigt den leeren Stand
      }
    }
    markdown = exportMarkdown(harness.getGraph(), view, member);
  } finally {
    await harness.close();
  }

  mkdirSync(dirname(out), { recursive: true });
  if (format === 'md') {
    writeFileSync(out, markdown);
  } else {
    const args = ['--from', 'gfm', '--output', out];
    if (format === 'docx') args.push('--to', 'docx');
    else {
      args.push('--to', 'html5', '--standalone', '--pdf-engine', 'weasyprint', '--metadata', `title=${base} · ${member}`);
      if (vorlage) args.push('--css', stylesheet);
    }
    const run = spawnSync('pandoc', args, { input: markdown, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (run.status !== 0) {
      rmSync(out, { force: true }); // keine halbe Datei liegen lassen
      throw new Error(`graphcode render: pandoc endete mit ${run.status ?? run.signal}: ${(run.stderr ?? '').trim()}`);
    }
  }
  return { view, format, out, bytes: statSync(out).size, vorlage };
}
