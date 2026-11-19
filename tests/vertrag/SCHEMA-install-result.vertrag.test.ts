// erzeugt aus dem Modell (graphanalyze/werkzeuge/vertragstest) — SCHEMA-install-result → src/surface/scaffold.ts#InstallResultSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { InstallResultSchema as S } from '../../src/surface/scaffold.js';

describe('Vertrag SCHEMA-install-result', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]})).toEqual({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]});
  });
  it("lehnt ab ohne action", () => {
    expect(S.safeParse({"repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: action mit falschem Typ", () => {
    expect(S.safeParse({"action":12345,"repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: action außerhalb des Enums", () => {
    expect(S.safeParse({"action":"__ausserhalb__","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab ohne repoRoot", () => {
    expect(S.safeParse({"action":"init","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: repoRoot mit falschem Typ", () => {
    expect(S.safeParse({"action":"init","repoRoot":12345,"created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab ohne created", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: created mit falschem Typ", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":"__falsch__","updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab ohne updated", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: updated mit falschem Typ", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":"__falsch__","removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab ohne removed", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: removed mit falschem Typ", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":"__falsch__","preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab ohne preserved", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: preserved mit falschem Typ", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":"__falsch__"}).success).toBe(false);
  });
});
