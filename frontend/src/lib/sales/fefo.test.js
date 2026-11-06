import { describe, expect, it } from "vitest";
import { allocateLotsFefo } from "./fefo";

const startOfDay = new Date("2026-11-06T00:00:00");

function lot(id, quantity, expiresAt, createdAt) {
  return {
    id,
    quantity,
    expiresAt,
    createdAt,
  };
}

describe("allocateLotsFefo", () => {
  it("consome primeiro o lote válido com vencimento mais próximo", () => {
    const lots = [
      lot("later", 10, "2026-12-10", "2026-11-01"),
      lot("nearer", 10, "2026-11-20", "2026-11-02"),
    ];

    const result = allocateLotsFefo({
      lots,
      quantity: 3,
      startOfDay,
      productName: "Produto",
    });

    expect(result.allocations).toEqual([{ lot: lots[1], quantity: 3 }]);
  });

  it("desempata a validade pela data de criação", () => {
    const lots = [
      lot("newer", 10, "2026-11-20", "2026-11-05"),
      lot("older", 10, "2026-11-20", "2026-11-01"),
    ];

    const result = allocateLotsFefo({
      lots,
      quantity: 3,
      startOfDay,
      productName: "Produto",
    });

    expect(result.allocations).toEqual([{ lot: lots[1], quantity: 3 }]);
  });

  it("consome lotes sem validade depois dos lotes com validade", () => {
    const lots = [
      lot("without-expiry", 10, null, "2026-11-01"),
      lot("with-expiry", 10, "2026-12-10", "2026-11-02"),
    ];

    const result = allocateLotsFefo({
      lots,
      quantity: 3,
      startOfDay,
      productName: "Produto",
    });

    expect(result.allocations).toEqual([{ lot: lots[1], quantity: 3 }]);
  });

  it("divide a quantidade entre lotes quando necessário", () => {
    const lots = [
      lot("first", 2, "2026-11-10", "2026-11-01"),
      lot("second", 5, "2026-11-20", "2026-11-02"),
    ];

    const result = allocateLotsFefo({
      lots,
      quantity: 5,
      startOfDay,
      productName: "Produto",
    });

    expect(result.allocations).toEqual([
      { lot: lots[0], quantity: 2 },
      { lot: lots[1], quantity: 3 },
    ]);
  });

  it("lança conflito quando o estoque válido é insuficiente", () => {
    const lots = [lot("available", 2, "2026-11-10", "2026-11-01")];

    expect(() =>
      allocateLotsFefo({
        lots,
        quantity: 3,
        startOfDay,
        productName: "Produto",
      }),
    ).toThrow("Estoque válido insuficiente para Produto.");
  });

  it("ignora lotes vencidos e sem quantidade", () => {
    const lots = [
      lot("expired", 10, "2026-11-05", "2026-11-01"),
      lot("empty", 0, "2026-11-07", "2026-11-02"),
      lot("valid", 4, "2026-11-07", "2026-11-03"),
    ];

    const result = allocateLotsFefo({
      lots,
      quantity: 3,
      startOfDay,
      productName: "Produto",
    });

    expect(result.allocations).toEqual([{ lot: lots[2], quantity: 3 }]);
  });
});
