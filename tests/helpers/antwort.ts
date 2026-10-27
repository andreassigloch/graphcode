/**
 * Grenzt eine Werkzeug-Antwort auf die Form mit `feld` ein (CR-GC-869).
 *
 * Werkzeuge mit `format` liefern JSON ODER Format-E; der Typ des Ergebnisses kennt die Wahl
 * nicht, der Test schon. Fehlt das Feld, ist das ein Befund — kein stilles `undefined`, an dem
 * die Assertion danach vorbeiläuft.
 *
 * @author andreas@siglochconsulting
 */
export function mitFeld<T extends object, K extends PropertyKey>(antwort: T, feld: K): Extract<T, Record<K, unknown>> {
  if (!(feld in antwort)) {
    throw new Error(`Antwort ohne Feld '${String(feld)}' (Felder: ${Object.keys(antwort).join(', ')})`);
  }
  return antwort as Extract<T, Record<K, unknown>>;
}

/**
 * Die Befundliste einer Regel-Antwort als Einzelbefunde (CR-GC-869).
 *
 * `rules_evaluate` und `rules_get_violations` liefern je nach `detail` Befunde ODER Gruppen
 * (eine Gruppe trägt `count`). Der Test weiß, was er bestellt hat; steht trotzdem eine Gruppe in
 * der Liste, ist das ein Befund.
 */
export function nurBefunde<L extends readonly object[]>(liste: L): Exclude<L[number], { count: number }>[] {
  const gruppe = liste.find((x) => 'count' in x);
  if (gruppe) throw new Error(`Einzelbefunde erwartet, Gruppe gefunden: ${JSON.stringify(gruppe).slice(0, 200)}`);
  return [...liste] as Exclude<L[number], { count: number }>[];
}

/** Gegenstück zu `nurBefunde`: die Liste einer Antwort mit `detail: 'grouped'`. */
export function nurGruppen<L extends readonly object[]>(liste: L): Extract<L[number], { count: number }>[] {
  const befund = liste.find((x) => !('count' in x));
  if (befund) throw new Error(`Gruppen erwartet, Einzelbefund gefunden: ${JSON.stringify(befund).slice(0, 200)}`);
  return [...liste] as Extract<L[number], { count: number }>[];
}
