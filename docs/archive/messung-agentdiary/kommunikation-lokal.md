# Kommunikation im lokalen Arm (Zielkette D2)

Stand: graphcode `da289e2` (CR-GC-721..725), Aufbau von `agentdiary-local-3`.

| Rolle | Was es ist | Spricht mit |
|---|---|---|
| **Coder** | OpenCode mit qwen3-coder — der Client | Nutzer, Executor (nur über `graph_delegate` und drei Leser) |
| **Executor** | Code im graphcode-Host, kein Modell — die Rundenschleife | Coder, Regel-/Skill-Engine, Denker |
| **Denker** | qwen3.8 mit `reasoningEffort: medium`, über das sigllm-Gateway | nur Executor |
| **Regel-/Skill-Engine** | Code im selben Host: Regelkatalog, Auftragsklauseln mit Vorbild, Gate, Store | nur Executor |

Coder und Denker sprechen nie miteinander. Der Denker sieht weder Werkzeuge noch den Nutzer; er bekommt
je Runde einen Text und gibt einen Text zurück.

```mermaid
sequenceDiagram
    autonumber
    actor N as Nutzer
    participant C as Coder<br/>OpenCode, qwen3-coder
    participant E as Executor<br/>Code im Host
    participant R as Regel-/Skill-Engine<br/>Regeln, Klauseln, Gate, Store
    participant D as Denker<br/>qwen3.8 medium

    N->>C: Auftrag in Prosa
    C->>E: graph_delegate mit auftrag oder task

    loop je Runde, höchstens maxRounds
        E->>R: graph_generate — was fehlt als Nächstes?
        R-->>E: ein Fund, dazu Auftragsklausel mit Vorbild,<br/>Grammatik und Bestand der betroffenen Typen
        E->>D: Rundenprompt: Auftrag, Klausel, Vorbild, Material
        D-->>E: Batch in Format-E oder Fragezeile

        alt Fragezeile
            E-->>C: status frage
            C->>N: Rückfrage, falls der Coder sie nicht selbst beantwortet
            N-->>C: Antwort
            C->>E: graph_delegate mit antwort
        else Batch
            E->>E: Vorprüfung: Vorbild-Reste und<br/>Stempelzeilen des Modells entfernen
            E->>R: graph_mutate — durch das Gate
            R-->>E: angewandt oder abgelehnt mit Verstößen
            Note over E,D: Bei Ablehnung trägt der nächste<br/>Rundenprompt den übersetzten Verstoß
        end

        opt Analyse-Task
            E->>R: graph_elements, graph_get_edges — steht das Artefakt?
            R-->>E: Einheiten und Rest
            E->>R: graph_mutate — Stempel, nur wenn das Artefakt steht
        end
    end

    E-->>C: status fertig: Runden, angewandt, abgelehnt,<br/>bei Task durchgefuehrt und artefakt
    C->>R: graph_elements, graph_get_node, graph_context — nur lesen
    R-->>C: Bestand
    C->>N: Bericht
```

## Was das Diagramm zeigt

- **Ein Schreibweg.** Nur der Executor ruft `graph_mutate`. Der Coder hat das Werkzeug nicht, der Denker
  hat gar keine Werkzeuge.
- **Skills als Text, nicht als Werkzeug.** Der Client-Weg (Frontier) lädt einen Skill und arbeitet ihn ab.
  Hier liefert die Engine je Runde eine Klausel mit einem Format-E-Vorbild; der Executor legt sie dem
  Denker in den Prompt.
- **Der Stempel ist Code.** Den Abschluss einer Analyse schreibt der Executor, wenn das Artefakt im
  Graphen steht. Eine Stempelzeile des Denkers wird vor dem Gate verworfen.
- **Rückfragen laufen über den Coder.** Der Denker stellt sie als Fragezeile; der Executor meldet
  `status: frage`; der Coder beantwortet sie aus Material oder fragt den Nutzer.
- **Warten.** Läuft eine Delegation länger als das Warte-Budget, kommt `status: laeuft`; der Coder
  ruft `graph_delegate({})` erneut auf (im Diagramm weggelassen).
