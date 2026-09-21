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
import { ELEMENT_ATTRIBUTES, ReqKind } from '@sigloch/contracts/se';

/** Ein Attribut, wie ein Autor es schreiben muss — Schluessel, erlaubte Werte, Schreibform. */
export interface AttributeHint {
  key: string;
  type: string;
  enumValues?: readonly string[];
  description: string;
  syntax: string;
}

/**
 * Die Attribute eines Typs, samt erlaubter Werte (CR-GC-581).
 *
 * `kinds` am REQ steht NICHT in `ELEMENT_ATTRIBUTES` (dort nur FMEA-Felder), obwohl UC-05/06,
 * die where-Praedikate der satisfy-Kanten und BQ-Regeln es lesen. Der Guide nannte deshalb
 * "behavioural kinds only" ohne einen einzigen Wert — Opus durchsuchte in Runde 7 bis zu 31-mal
 * den Quellcode nach der Schreibweise. Die Werte kommen aus `ReqKind`, der SSOT; lokal ist
 * nur die Tatsache, dass sie als `@kinds [...]` reisen.
 */
export function attributesFor(type: string): AttributeHint[] {
  const own: AttributeHint[] = (ELEMENT_ATTRIBUTES[type as keyof typeof ELEMENT_ATTRIBUTES] ?? []).map((a) => ({
    key: a.key,
    type: a.type,
    ...(a.enumValues ? { enumValues: a.enumValues } : {}),
    description: a.description,
    syntax: `@${a.key} <wert>`,
  }));
  if (type !== 'REQ') return own;
  return [
    {
      key: 'kinds',
      type: 'array',
      enumValues: ReqKind.options,
      description:
        'Art der Anforderung, eine oder mehrere. functional/postcondition/precondition sind ' +
        'behavioural (FUNC/FCHAIN satisfy), non-functional structural (MOD/SYS satisfy); ' +
        'UC-05 verlangt einen postcondition-REQ, UC-06 einen precondition-REQ am UC.',
      syntax: '@kinds ["postcondition"]',
    },
    ...own,
  ];
}

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
    // Attribute reisen als Folgezeile; am REQ die, ohne die UC-05/06 nie erfuellbar sind.
    ...(type === 'REQ' ? ['@kinds ["functional"]'] : []),
    '',
    `# Name mit Komma oder eckiger Klammer -> Folgezeile statt inline:`,
    `# + ${uid}|One sentence stating what this ${type} is`,
    `# @__name Readable ${type} name, with a comma`,
  ].join('\n');
}
