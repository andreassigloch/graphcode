/**
 * Die Testmenge einer MODELLÄNDERUNG (CR-GC-399) — SSOT für `npm run verify:model`, für die
 * Spurwahl im pre-commit und für den Vollständigkeits-Test.
 *
 * Anlass: eine Sitzung mit sechs vollen Suite-Läufen (~41 Minuten) für Änderungen, die keine
 * einzige Quelldatei angefasst haben. `graph_tests` löst das nicht — es leitet aus einem
 * CODE-Changeset ab (code → REQ → TEST); eine reine Graph-Mutation hat keinen Code-Changeset.
 *
 * Seit CR-GC-1034 GEMESSEN statt von Hand gepflegt. Ein Test gehört in die Spur, wenn er beim Lauf
 * eine Datei liest, deren Änderung die Spur auslöst (`isModelLanePath`). Das misst
 * `model-test-set.measure.mjs` mit einem Lese-Protokoll je Testdatei und schreibt es nach
 * `model-test-set.json`. Vorher entschieden Textmuster (`docs/graph`, `RULES_VERSION`) und eine
 * Liste von 31 Ausschlüssen; die Messung fand 22 Tests in der Spur, die nichts davon lesen, und
 * 10 Leser der SSOT, die fehlten.
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Welche Pfade die Spur MODELL auslösen — die eine Definition für Hook und Messung.
 * Modell, Sichten, CRs und Markdown. NICHT `.claude/`: dort liegen die Skill-Texte, und rund 40
 * Tests prüfen sie (Regel-IDs, Wortlaut, Werkzeugnamen). Ein Skill-Commit geht in die Spur CODE.
 */
export function isModelLanePath(rel) {
  if (rel.startsWith('.claude/')) return false;
  return /^docs\/(graph|views|cr)\//.test(rel) || rel.endsWith('.md');
}

/** Fingerabdruck einer Testdatei — ändert sie sich, ist ihre Messung veraltet. */
export function hashOf(source) {
  return createHash('sha256').update(source).digest('hex').slice(0, 16);
}

export const MEASUREMENT_FILE = fileURLToPath(new URL('./model-test-set.json', import.meta.url));

/** Die Messung: je Testdatei Fingerabdruck und die gelesenen Pfade der Spur. */
export const MEASUREMENT = JSON.parse(readFileSync(MEASUREMENT_FILE, 'utf8'));

/**
 * Leser, die die Spur trotzdem NICHT fährt — jeder Eintrag mit Grund. Nur für Tests, die eine
 * Spur-Datei lesen, aber durch eine Änderung an ihr nicht rot werden können.
 */
export const AUSNAHMEN = {
  'tests/distribution.test.ts':
    'CR-GC-1034: liest README.md nur als Inhalt des Pakets (`npm pack`); welcher Text darin steht, macht ihn nicht rot. ' +
    'Er baut dist/ neu (`npm run build`) und nimmt es parallel laufenden Tests unter den Fuessen weg ' +
    '(gemessen: whitebox-messung „Failed to load url dist/index.js"). Publish-Pruefung, faehrt die volle Suite.',
  'tests/perf.advisory-roundtrip.spike.test.ts':
    'Perf-Spike. Liest die SSOT nur noch für einen Datenpunkt, der seit CR-GC-400 NICHT mehr assertiert; die ' +
    'Assertion hängt an einem modellunabhängigen Eingang fester Größe. Kostet allein 45 s, mehr als die übrige Spur.',
  'tests/steering.convergence-witness.spike.test.ts':
    'Konvergenz-Zeugen-Spike (CR-GC-407). Liest die SSOT nur als realistisch grosses Fixture (degradierte Kopie in ' +
    'einem Temp-Store); assertiert werden Zeugen-/Archiv-Eigenschaften der Sequenzen, keine uid-Pins.',
};

/** Die Menge, die `verify:model` fährt: gemessene Leser ohne Ausnahmen. */
export const INCLUDED = Object.entries(MEASUREMENT.dateien)
  .filter(([file, m]) => m.liest.length > 0 && !(file in AUSNAHMEN))
  .map(([file]) => file)
  .sort();

/**
 * Parallelität: `vitest.config.ts` fährt die Suite seriell (Kuzu = ein Schreiber pro Store). Für
 * DIESE Menge ist parallel sicher, solange jeder Test, der das echte Repo als repoRoot benutzt, ein
 * eigenes `lockDir` übergibt. Der Vollständigkeits-Test prüft es je Datei.
 */
export const FILE_PARALLELISM = true;

// Spurwahl des pre-commit: gestagte Pfade auf stdin, Ausgabe der erste Pfad AUSSERHALB der Spur.
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === '--ausserhalb-der-spur') {
  const first = readFileSync(0, 'utf8')
    .split('\n')
    .filter(Boolean)
    .find((p) => !isModelLanePath(p));
  if (first) process.stdout.write(first + '\n');
}
