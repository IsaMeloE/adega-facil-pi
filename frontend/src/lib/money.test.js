import { describe, expect, it } from "vitest";
import { toCents } from "./money";

describe("toCents", () => {
  it("converte valores inteiros", () => {
    expect(toCents(10)).toBe(1000);
  });

  it("converte valores com centavos", () => {
    expect(toCents(10.25)).toBe(1025);
  });

  it("converte zero", () => {
    expect(toCents(0)).toBe(0);
  });
});
