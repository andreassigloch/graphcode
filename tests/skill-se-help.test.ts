/**
 * TEST-skill-se-help — verifies REQ-se-help-erklaert-aus-graph-help: der Skill se:help
 * gibt eine Anleitung zurueck, die ein Dashboard-Element mit graph_help und token erklaert
 * und die Frage nach dem naechsten Schritt mit rules_get_violations und detail grouped beantwortet.
 *
 * FUNC-se-help ist prompt-realisiert (realRef = die Skill-Datei): der Text IST die
 * Realisierung. Geprueft wird der ausgelieferte Text, mit Positivkontrolle.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TOKEN_AUFRUF = /call `graph_help` `\{ "token": "<token>" \}`/;
const NAECHSTER_SCHRITT = /call `rules_get_violations` `\{ "detail": "grouped" \}`/;

function helpText(): string {
  return readFileSync(join(__dirname, '..', '.claude', 'commands', 'se', 'help.md'), 'utf8');
}

describe('TEST-skill-se-help: se:help erklaert aus graph_help und liest den naechsten Schritt aus rules_get_violations', () => {
  it('ein Dashboard-Element erklaert der Skill mit graph_help und token', () => {
    expect(helpText()).toMatch(TOKEN_AUFRUF);
  });

  it('die Frage nach dem naechsten Schritt beantwortet rules_get_violations mit detail grouped', () => {
    expect(helpText()).toMatch(NAECHSTER_SCHRITT);
  });

  it('Positivkontrolle — ein Text ohne beide Aufrufe faellt durch', () => {
    const ohne = 'Explain the token from memory and list the rules you remember.';
    expect(ohne).not.toMatch(TOKEN_AUFRUF);
    expect(ohne).not.toMatch(NAECHSTER_SCHRITT);
  });
});
