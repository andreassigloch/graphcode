# SIG Local — was ich bauen will

Stand 2026-09-17. Aufgeschrieben als Auftrag, nicht als Spezifikation: ich beschreibe, was das
Ding können muss und woran es scheitern kann. Die Struktur ist Teil der Aufgabe.

## Worum es geht

Ich möchte eine eigene LLM-Rechenkapazität im internen Netz, vollständig lokal. Nichts davon
darf den Rechner verlassen, kein Cloud-Rückfall, auch nicht im Fehlerfall. Zwei Dinge soll sie
leisten, und sie teilen sich dieselbe Inferenz.

**Tagsüber bediene ich und andere im Haus sie interaktiv.** Wir hängen unsere Werkzeuge daran —
alles, was sonst gegen eine Cloud-API spricht. Das heißt: eine API, die sich wie die üblichen
verhält, damit bestehende Clients ohne Umbau funktionieren. Jeder Nutzer und jedes Gerät bekommt
einen eigenen Zugang, den ich einzeln zurückziehen kann. Ich will sehen, wer wie viel verbraucht
und wie lange jemand warten musste.

**Nachts soll sie selbständig arbeiten.** Wiederkehrende Aufgaben, die niemand anstößt: Daten
holen, das Modell etwas daraus machen lassen, Ergebnis ablegen oder verschicken. Mehrstufig,
mit Werkzeugaufrufen, mit einer Grenze, wann Schluss ist. Diese Aufgaben sollen deklariert
werden, nicht programmiert — ein neuer Auftrag darf keine Codeänderung kosten.

**Und unterwegs will ich weiterarbeiten.** Wenn mein Rechner nicht im Netz ist, soll er die
lokale Instanz benutzen, ohne dass ich etwas umstelle. Kommt er zurück ins Netz, nutzt er wieder
die große Maschine.

## Woran es scheitern wird, wenn ich nicht aufpasse

Das ist mir wichtiger als die Funktionsliste, weil es die Punkte sind, an denen so etwas
üblicherweise stirbt.

**Es läuft nicht, wenn ich nicht davorsitze.** Nach einem Neustart muss alles von selbst wieder
da sein, ohne dass sich jemand anmeldet. Ein Auftrag darf nicht daran scheitern, dass das Modell
gerade nicht geladen war.

**Der Rechner schläft.** Er wird zugeklappt, er geht aus, der Strom fällt aus. Nichts davon darf
Zustand verlieren, und was in dieser Zeit fällig gewesen wäre, muss nachgeholt werden — aber
kontrolliert. Für manche Aufgaben will ich jeden ausgefallenen Termin nachholen, für andere nur
den letzten, für wieder andere gar keinen. Und nie darf derselbe Termin zweimal laufen.

**Die beiden Nutzungen behindern sich.** Wenn nachts ein langer Lauf beschäftigt ist und ich
morgens etwas frage, will ich nicht warten. Umgekehrt soll der Nachtlauf nicht abgewürgt werden,
sondern an einer sauberen Stelle zurückstecken.

**Das Modell antwortet Unsinn oder gar nicht.** Ausgaben, auf die etwas aufbaut, müssen gegen
eine vereinbarte Form geprüft werden. Scheitert das, noch einmal versuchen, und wenn es dabei
bleibt, beiseitelegen und mir Bescheid geben. Ebenso bei Fehlern und bei Ergebnissen, die
auffällig sind.

**Ich weiß später nicht mehr, wie ein Ergebnis zustande kam.** Zu jedem Ergebnis muss
nachvollziehbar sein, welche Aufgabe, welche Fassung der Anweisung und welches Modell dahinter
standen.

**Der Speicher reicht nicht.** Die Maschine hat 64 GB, die sich alles teilt. Ich will zwei
Modellprofile: eines, das nachdenkt, und ein schnelles ohne Nachdenken. Beim schnellen darf
nachweislich kein Nachdenken durchrutschen — das ist mir schon in fertigen Werkzeugen passiert.

**Es hängt an dieser einen Maschine.** Später soll das Ganze auf einen anderen Rechner umziehen,
ohne Codeänderung: Konfiguration, Aufgabenliste und Verlauf kopieren, fertig.

**Geheimnisse landen im Klartext.** Zugangsdaten gehören in den Schlüsselbund des Betriebssystems,
nicht in Aufgabenbeschreibungen und nicht in Protokolle.

## Zwei Aufgaben, die es von Anfang an können muss

Beide laufen heute woanders und laufen dort unzuverlässig. Sie sind mein Abnahmefall.

1. **Ein Arbeitstagebuch.** Jede Nacht zusammenfassen, was ich am Vortag an Code getan habe,
   und daraus einen lesbaren Eintrag machen. Die Daten holt Code, das Modell fasst nur zusammen.
   Hier zählt jeder Tag — ein ausgefallener Termin muss nachgeholt werden.
2. **Eine Erreichbarkeitsprüfung.** Regelmäßig prüfen, ob meine Websites und Server laufen,
   und bei einem Befund Bescheid geben. Das ergibt nur Sinn, solange der Rechner am Netz hängt;
   sobald er wieder dran ist, soll die Prüfung sofort laufen statt auf den nächsten Termin zu
   warten.

Was deterministisch geht, soll Code machen. Das Modell bewertet und formuliert.

## Was ausdrücklich nicht dazugehört

Keine Weboberfläche zur Aufgabenverwaltung, kein Zugriff von außerhalb des Hauses, kein
Ausweichen in die Cloud.

## Was ich noch nicht weiß

Über welchen Kanal ich benachrichtigt werden will. Wohin die Ergebnisse gehen — Datei, Mail,
Datenbank. Wie schnell eine Antwort tagsüber anfangen muss, damit es sich gut anfühlt. Ob der
Nachtbetrieb unterwegs pausiert oder mitläuft. Und welche Laufzeitumgebung für die Modelle die
richtige ist; das will ich messen, nicht glauben.
