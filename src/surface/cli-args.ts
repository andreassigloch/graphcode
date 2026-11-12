/**
 * cli-args.ts — welche Argumente ein Verb der `graphcode`-CLI kennt (CR-GC-886).
 *
 * `cli.ts` las je Verb nur die Flags, die es erwartete, und warf den Rest weg. Dadurch fuehrte
 * `--help` das Verb aus: `init` schrieb in fremde Repos, `upgrade` trug eine Abhaengigkeit ein und
 * beendete den Host. Die Pruefung laeuft deshalb vor jedem Verb, und ein Verb ohne Eintrag hier
 * kann keine Argumente annehmen.
 *
 * @author andreas@siglochconsulting
 */

interface VerbArgs {
  /** Flags ohne Wert. */
  flags?: readonly string[];
  /** Flags, denen ein Wert folgt. */
  valueFlags?: readonly string[];
  /** Wie viele Argumente ohne Flag das Verb hoechstens nimmt. */
  positionals?: number;
}

const VERBS: Readonly<Record<string, VerbArgs>> = {
  mcp: {},
  host: {},
  status: {},
  init: { flags: ['--json'] },
  remove: {},
  'import-code': { positionals: 1 },
  render: { valueFlags: ['--format', '--out'], positionals: 1 },
  rewind: { flags: ['--force'], valueFlags: ['--snapshot'], positionals: 1 },
  upgrade: { flags: ['--check', '--keep-host', '--global', '--refresh-only'], valueFlags: ['--to'] },
  skills: { positionals: 1 },
};

export type ArgsVerdict = { kind: 'run' } | { kind: 'help' } | { kind: 'error'; message: string };

/** Prueft die Argumente eines Verbs. Ein unbekanntes Verb entscheidet `cli.ts`. */
export function checkVerbArgs(verb: string, args: readonly string[]): ArgsVerdict {
  const spec = VERBS[verb];
  if (!spec) return { kind: 'run' };
  if (args.includes('--help') || args.includes('-h')) return { kind: 'help' };
  let positionals = 0;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    if (spec.flags?.includes(arg)) continue;
    if (spec.valueFlags?.includes(arg)) {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('-')) return { kind: 'error', message: `${arg} braucht einen Wert` };
      i += 1;
      continue;
    }
    if (arg.startsWith('-')) return { kind: 'error', message: `unbekanntes Flag ${arg}` };
    positionals += 1;
    if (positionals > (spec.positionals ?? 0)) return { kind: 'error', message: `unbekanntes Argument "${arg}"` };
  }
  return { kind: 'run' };
}
