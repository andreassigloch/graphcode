/**
 * authoring-example.ts — der Format-E-Musterblock je ElementType (CR-GC-321).
 *
 * Warum eigenes Modul: `tools/report.ts` steht am 500-Zeilen-Limit (CR-GC-256 §6 —
 * „der nächste Reporting-Tool splittet die Datei, sie wächst nicht"), und der
 * Musterblock ist Format-E-Wissen, kein Reporting-Wissen.
 *
 * Der Block ist GEPRÜFT, nicht behauptet: `tests/mutate.formate-name.test.ts`
 * jagt ihn durch `GraphCodeCodec.decode()` und verlangt einen Knoten des
 * angefragten Typs mit `name !== uid` (REQ-N03). Ein Beispiel, das der Codec
 * nicht frisst, ist schlimmer als keins.
 *
 * @author andreas@siglochconsulting
 */

/**
 * Ein einzeiliger, decodierbarer Format-E-v2-Block für `type`.
 *
 * Die Zeile zeigt genau die Stelle, an der Autoren den Namen verlieren:
 * `+ uid|text` hat ZWEI positionale Felder (uid, Beschreibung) — der Name reist
 * als `__name`-Attribut. Ohne ihn wird die uid zum Namen (stiller Fallback,
 * `src/codec.ts` decode).
 */
export function formatEExampleFor(type: string): string {
  const uid = `${type}-example`;
  return [
    '## Nodes',
    `### ${type}`,
    `+ ${uid}|One sentence stating what this ${type} is; this field is the DESCRIPTION [__name:Readable ${type} name]`,
    '',
    `# Name mit Komma oder eckiger Klammer -> Folgezeile statt inline:`,
    `# + ${uid}|One sentence stating what this ${type} is`,
    `# @__name Readable ${type} name, with a comma`,
  ].join('\n');
}
