# CR-GC-935: init und upgrade binden einen Wissensindex in den Kontext des Agenten ein

**Typ:** aus Item ITEM-2026-1361 (idea)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1361.json (Lane: code)

---

## Anlass

Ein Verweis auf eine Wissensdatei genügt nicht. Gemessen am 2026-11-15 mit acht Fragen (CR-AB-010, aise-bok):
Mit einem Verweis in den Anweisungen lasen 3 von 8 Agenten die Datei. Mit einem Index im Kontext lasen 8 von 8.
Ein Hersteller eines Web-Frameworks misst dasselbe: Nachschlagen bei Bedarf 53 %, Index im Kontext 100 %
(https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals).

Vorgabe des Autors vom 2026-11-15: Der Index liegt nur dort im Kontext, wo graphcode installiert ist, und zwar
für Claude Code und für OpenCode. Nicht in jeder Sitzung des Rechners.

## Auftrag

`init` und `upgrade` binden eine Wissensdatei in den Kontext des Agenten ein, wenn das Repo eine nennt.
Die Datei gehört nicht zu graphcode; graphcode kennt nur ihren Pfad.

1. **Quelle des Pfads:** ein Schlüssel in `graphcode.config.jsonc` des Repos (Pfad, `~` erlaubt). Fehlt der
   Schlüssel, schreibt graphcode nichts und entfernt eine frühere Einbindung.
2. **Claude Code:** ein Hook, den graphcode mitliefert und in `.claude/settings.json` einträgt, wie die
   `deny-*.sh`-Hooks. Er gibt die Datei beim Start der Sitzung in den Kontext, ebenso beim Start eines Unteragenten.
   Kein Import in `CLAUDE.md`: Ein Import von außerhalb des Repos verlangt je Projekt eine Zustimmung im Dialog,
   und `CLAUDE.md` gehört dem Nutzer.
3. **OpenCode:** der Pfad in `instructions` der `opencode.json`, die graphcode schon schreibt.
4. **Grenze:** Ein Hook gibt höchstens 10 000 Zeichen in den Kontext. Ist die Datei größer oder fehlt sie,
   meldet der Hook das in einem Satz und gibt nichts Abgeschnittenes aus.
5. **Deinstallation** entfernt Hook, Eintrag und `instructions`-Zeile wieder; fremde Einträge bleiben.

## Vor dem Bau zu prüfen

- Liegt das Schema von `graphcode.config.jsonc` in graphcode oder in `@sigloch/contracts`? Liegt es in
  contracts, ist der Schlüssel Familie-Sache: anhalten und melden.
- Nimmt OpenCode in `instructions` einen absoluten Pfad außerhalb des Repos an? Am echten OpenCode-Lauf prüfen.
- Kommt der Text beim Unteragenten von Claude Code an? An einer echten Sitzung prüfen.

## Abnahme

- [ ] Test zuerst rot: `init` mit Schlüssel schreibt Hook, Eintrag und `instructions`; ohne Schlüssel nichts.
- [ ] `upgrade` nach Entfernen des Schlüssels entfernt die Einbindung; fremde Hooks und Einstellungen bleiben.
- [ ] Hook mit zu großer und mit fehlender Datei: ein Satz, kein abgeschnittener Text.
- [ ] Probe an einer echten Sitzung von Claude Code (Hauptsitzung und Unteragent) und von OpenCode: Der Agent
      nennt ohne Werkzeugaufruf eine Zeile der Datei.
- [ ] `npm run verify:full CR-GC-935` grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
