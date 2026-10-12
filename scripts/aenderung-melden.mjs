/**
 * Die Spur meldet zurück (CR-GC-800): Änderung und Lauf gehen an `graph_test_ingest`.
 *
 * Ein MCP-stdio-Client wie jeder Agent — der eine Transport, kein zweiter Schreibweg. Läuft
 * schon ein Host für das Repo, reicht der gestartete Prozess als Proxy an ihn weiter; läuft
 * keiner, gewinnt er die Wahl, schreibt, exportiert beim Abräumen und endet.
 *
 * @author andreas@siglochconsulting
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * @param {{ repoRoot: string, changeSet: string[], berichtPfad: string, cli?: string }} opts
 * @returns {Promise<null | { success: boolean, applied: number, assignments: Array<{testUid: string, file: string, result: string}>, withdrawn: Array<{testUid: string, file: string}>, unresolved: Array<{file: string, reason: string}> }>}
 *          `null`, wenn es weder eine Änderung noch einen Bericht gibt.
 */
export async function meldeZurueck({ repoRoot, changeSet, berichtPfad, cli = join(repoRoot, 'dist', 'cli.js') }) {
  const report = existsSync(berichtPfad) ? readFileSync(berichtPfad, 'utf8') : undefined;
  if (report === undefined && changeSet.length === 0) return null;

  const transport = new StdioClientTransport({ command: process.execPath, args: [cli, 'mcp'], cwd: repoRoot, stderr: 'ignore' });
  const client = new Client({ name: 'verify-lane', version: '1' });
  await client.connect(transport);
  try {
    const res = await client.callTool({
      name: 'graph_test_ingest',
      arguments: {
        ...(report !== undefined ? { report } : {}),
        ...(changeSet.length > 0 ? { changeSet } : {}),
        consumerId: 'verify-lane',
      },
    });
    const text = res.content?.[0]?.text ?? '';
    if (res.isError) throw new Error(`graph_test_ingest: ${text}`);
    return JSON.parse(text);
  } finally {
    await client.close();
  }
}

/** Eine Zeile für den Bericht der Spur. */
export function meldungsZeile(spur, res) {
  if (res === null) return `[${spur}] Rueckmeldung: nichts zu melden.`;
  return `[${spur}] Rueckmeldung: ${res.assignments.length} Ergebnis(se) geschrieben, ${res.withdrawn.length} zurueckgenommen, ${res.unresolved.length} Datei(en) ohne TEST-Knoten.`;
}
