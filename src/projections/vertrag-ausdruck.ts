/**
 * vertrag-ausdruck.ts — liest die Bedingung eines `refine` am Objekt (CR-GC-1000).
 *
 * Drei Formen sind erlaubt, jede liefert eine reine Datenform; wer Faelle bildet, kennt keinen Quelltext:
 *   - `vergleich`: ein Zahlfeld steht in einer Ordnung zu einem anderen Zahlfeld desselben Objekts.
 *   - `mindestensEines`: von N optionalen Feldern ist mindestens eines gesetzt.
 *   - `textOhneMuster`: ein Text passt nicht auf ein Muster (Regex-Literal ohne Flags).
 * Alles andere (Hilfsaufruf, aeussere Konstante, `&&`, Methodenaufruf, verschachtelter Zugriff, ein
 * unbekanntes Feld) bricht mit dem gelesenen Ausdruck ab. Kein `eval`: der Quelltext der Funktion
 * (`String(fn)`) wird nur gelesen, nie ausgefuehrt.
 *
 * @author andreas@siglochconsulting
 */

export type Vergleichsoperator = '<=' | '<' | '>=' | '>';

export type Ausdruck =
  | { art: 'vergleich'; links: string; operator: Vergleichsoperator; rechts: string }
  | { art: 'mindestensEines'; felder: string[] }
  | { art: 'textOhneMuster'; muster: string };

/** Der Ausdruck hat keine der zwei Formen; `ausdruck` ist der gelesene Quelltext. */
export class AusdruckFehler extends Error {
  constructor(
    readonly grund: string,
    readonly ausdruck: string,
  ) {
    super(`${grund} (gelesen: ${ausdruck})`);
    this.name = 'AusdruckFehler';
  }
}

const NAME = '[A-Za-z_$][\\w$]*';

/** Parametername und Rumpf einer Pfeilfunktion oder einer `function`-Schreibweise mit einem Parameter, sonst undefined. */
function zerlege(quelltext: string): { parameter: string; rumpf: string } | undefined {
  const q = quelltext.trim();
  const pfeil = new RegExp(`^(?:\\(\\s*(${NAME})\\s*\\)|(${NAME}))\\s*=>\\s*([\\s\\S]+)$`).exec(q);
  const funktion = new RegExp(`^function\\s*(?:${NAME})?\\s*\\(\\s*(${NAME})\\s*\\)\\s*(\\{[\\s\\S]*\\})$`).exec(q);
  const parameter = pfeil ? (pfeil[1] ?? pfeil[2]) : funktion?.[1];
  let rumpf = pfeil ? pfeil[3] : funktion?.[2];
  if (parameter === undefined || rumpf === undefined) return undefined;
  const block = /^\{\s*return\s+([\s\S]+?);?\s*\}$/.exec(rumpf.trim());
  if (block) rumpf = block[1] as string;
  return { parameter, rumpf: klammernAb(rumpf.trim().replace(/;$/, '')) };
}

/** Entfernt Klammern, die den ganzen Ausdruck umschliessen. */
function klammernAb(text: string): string {
  let t = text.trim();
  while (t.startsWith('(') && t.endsWith(')')) {
    let tiefe = 0;
    let umschliesst = true;
    for (let i = 0; i < t.length - 1; i++) {
      if (t[i] === '(') tiefe++;
      if (t[i] === ')') tiefe--;
      if (tiefe === 0) {
        umschliesst = false;
        break;
      }
    }
    if (!umschliesst) break;
    t = t.slice(1, -1).trim();
  }
  return t;
}

/** `undefined` steht im uebersetzten Quelltext je nach Werkzeug als `undefined` oder `void 0`. */
const UNDEFINIERT = '(?:undefined|void 0)';

/** Liest `quelltext` (der Quelltext der Funktion von `refine`) gegen die Feldnamen des Objekts; ein Text-Schema hat keine Felder. */
export function liesAusdruck(quelltext: string, felder: readonly string[]): Ausdruck {
  const z = zerlege(quelltext);
  if (!z) throw new AusdruckFehler('keine Funktion mit einem Parameter und einem Ausdruck', quelltext);
  const p = z.parameter.replace(/\$/g, '\\$');
  const vergleich = new RegExp(`^${p}\\.(${NAME})\\s*(<=|>=|<|>)\\s*${p}\\.(${NAME})$`).exec(z.rumpf);
  if (vergleich) {
    const [, links, operator, rechts] = vergleich as unknown as [string, string, Vergleichsoperator, string];
    if (links === rechts) throw new AusdruckFehler(`Vergleich eines Feldes mit sich selbst: ${links}`, z.rumpf);
    for (const f of [links, rechts]) if (!felder.includes(f)) throw new AusdruckFehler(`unbekanntes Feld ${f}`, z.rumpf);
    return { art: 'vergleich', links, operator, rechts };
  }
  const muster = new RegExp(`^!\\s*\\/(.+)\\/\\.test\\(\\s*${p}\\s*\\)$`).exec(z.rumpf);
  if (muster) {
    try {
      new RegExp(muster[1] as string);
    } catch {
      throw new AusdruckFehler('das Muster ist kein gueltiger regulaerer Ausdruck', z.rumpf);
    }
    return { art: 'textOhneMuster', muster: muster[1] as string };
  }
  const glieder = z.rumpf.split('||').map((t) => new RegExp(`^${p}\\.(${NAME})\\s*!==\\s*${UNDEFINIERT}$`).exec(klammernAb(t)));
  if (glieder.length >= 2 && glieder.every((m) => m !== null)) {
    const namen = glieder.map((m) => (m as RegExpExecArray)[1] as string);
    for (const f of namen) if (!felder.includes(f)) throw new AusdruckFehler(`unbekanntes Feld ${f}`, z.rumpf);
    if (new Set(namen).size !== namen.length) throw new AusdruckFehler('ein Feld mehrfach genannt', z.rumpf);
    return { art: 'mindestensEines', felder: namen };
  }
  throw new AusdruckFehler('weder Vergleich zweier Felder noch mindestens eines von N Feldern noch Text ohne Muster', z.rumpf);
}
