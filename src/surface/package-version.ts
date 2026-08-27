/**
 * package-version.ts — die eine Stelle, die sagt, welcher Build gerade läuft (CR-GC-376).
 *
 * Zuvor lasen zwei Module dieselbe Zahl getrennt (`mcp-server.readPackageVersion`
 * für den MCP-Handshake, `scaffold-templates.packageVersion` für den Dep-Range).
 * Mit CR-GC-376 kommen zwei weitere Leser dazu (Lock-Stempel, Status-Zeile) — vier
 * Kopien derselben Frage sind der Anfang von genau dem Defekt, den dieser CR
 * beseitigt: eine angezeigte Version, die nicht die laufende ist.
 *
 * `readFileSync` statt `import pkg from '../../package.json'` mit Absicht: der
 * JSON-Import liegt außerhalb von `rootDir` und bricht `tsc` (CR-GC-270).
 *
 * Seit CR-GC-429 §4 liegt der Code in Modulverzeichnissen — die Paketwurzel wird
 * deshalb per Aufwärtssuche nach der nächsten `package.json` gefunden statt über
 * eine fest verdrahtete Ebenenzahl, die beim nächsten Verzeichnis-Umbau wieder
 * stumm bräche (genau so ist der §4-Umzug hier aufgefallen).
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Die Paketwurzel des LAUFENDEN Codes: das nächste Verzeichnis oberhalb dieser
 * Datei, das eine `package.json` trägt — hält im Dev-Baum (`src/surface/…`) wie im
 * veröffentlichten Paket (`dist/surface/…`), unabhängig von der Verzeichnistiefe.
 */
export function packageRootDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('graphcode: no package.json above ' + fileURLToPath(import.meta.url));
    dir = parent;
  }
  return dir;
}

/**
 * Die eigene `version` aus der package.json neben dem laufenden Code.
 *
 * Bewusst OHNE Fallback: ist die package.json unlesbar, ist laut zu scheitern
 * richtiger, als eine geratene Version zu behaupten — eine Version, der man nicht
 * trauen kann, ist der Defekt, den diese Datei ausräumt.
 */
export function readPackageVersion(): string {
  const pkgPath = join(packageRootDir(), 'package.json');
  const raw = readFileSync(pkgPath, 'utf8');
  const version = (JSON.parse(raw) as { version?: unknown }).version;
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`graphcode: package.json at ${pkgPath} has no usable "version"`);
  }
  return version;
}
