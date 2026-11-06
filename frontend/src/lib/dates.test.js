import { describe, expect, it } from "vitest";
import { formatLocalDate } from "./dates";

describe("formatLocalDate", () => {
  it("formata o início do mês", () => {
    expect(formatLocalDate(new Date(2026, 10, 1, 0, 30))).toBe("2026-11-01");
  });

  it("formata o fim do mês", () => {
    expect(formatLocalDate(new Date(2026, 10, 30, 23, 30))).toBe("2026-11-30");
  });

  it("formata a virada de ano", () => {
    expect(formatLocalDate(new Date(2026, 11, 31, 23, 30))).toBe("2026-12-31");
    expect(formatLocalDate(new Date(2027, 0, 1, 0, 30))).toBe("2027-01-01");
  });

  it("mantém a data local em horário próximo da meia-noite", () => {
    expect(formatLocalDate(new Date(2026, 10, 6, 0, 30))).toBe("2026-11-06");
    expect(formatLocalDate(new Date(2026, 10, 6, 23, 30))).toBe("2026-11-06");
  });
});
