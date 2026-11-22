# Mutanten-Messung CR-GC-1000

Der Erzeuger liest `refine` in drei Formen (Vergleich zweier Zahlfelder, mindestens eines von N optionalen Feldern, Text ohne Muster). Je Mutante eine Änderung am Quell-Schema; die erzeugten Fälle des Originals laufen gegen die Mutante. Zahl = rote Fälle (Urteil der Mutante weicht vom erwarteten Urteil ab). Die Mutanten stehen als Tests in `tests/vertrag-ausdruck.test.ts`.

| Form | Schema (Original) | Fälle | Mutante | rot |
|---|---|---|---|---|
| Vergleich | `{von, bis}` ganze Zahlen ≥ 0, `von <= bis` | 15 | Operator `<=` wird `<` | 4 |
| Vergleich | | | Operator `<=` wird `>=` | 1 |
| Vergleich | | | Check entfernt | 1 |
| Mindestens eines | `{a, b, c}` optionale Texte, `a`, `b` oder `c` gesetzt | 16 | Feld `a` aus der Oder-Kette | 1 |
| Mindestens eines | | | Feld `c` aus der Oder-Kette | 1 |
| Mindestens eines | | | Check entfernt | 1 |
| Text ohne Muster | Text ab 1 Zeichen, nicht `^[/~]` | 5 | Check entfernt | 1 |
| Text ohne Muster | | | Negation entfernt | 3 |
| Text ohne Muster | | | Muster verengt auf `^~` | 1 |

Je Original: 0 rote Fälle. Alle 9 Mutanten sind rot.

## Beispielbildung für die fünf Muster der Pfadprüfung

Gemessen mit `beispiel(z.string().regex(muster))`, also mit `ausRegex` unverändert:

| Muster | gebildet | trifft das Muster |
|---|---|---|
| `\\` (ein Backslash) | `\` | ja |
| `^[/~]` | `/` | ja |
| `^[A-Za-z]:` | `A:` | ja |
| `(^|/)\.\.(/|$)` | `../` | ja |
| `^[A-Z]+-.{61,}$` | `A-` und 61 mal `a` (63 Zeichen) | ja |

`ausRegex` wurde nicht erweitert.
