import { describe, expect, it } from "vitest";
import { formatCurrency } from "./formatters";

describe("formatCurrency", () => {
  it("formata valores inteiros em reais", () => {
    expect(formatCurrency(10)).toBe("R$\u00a010,00");
  });

  it("formata valores com centavos em reais", () => {
    expect(formatCurrency(10.25)).toBe("R$\u00a010,25");
  });

  it("formata zero em reais", () => {
    expect(formatCurrency(0)).toBe("R$\u00a00,00");
  });
});
