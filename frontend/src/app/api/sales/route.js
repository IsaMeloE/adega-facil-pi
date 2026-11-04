import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const sales = await prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
            lot: { select: { lotCode: true, expiresAt: true } },
          },
        },
      },
    });

    return NextResponse.json(sales);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar as vendas." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const items = body.items;
    const paymentMethods = [
  "PIX",
  "DINHEIRO",
  "CARTAO_DEBITO",
  "CARTAO_CREDITO",
];

if (!paymentMethods.includes(body.paymentMethod)) {
  return NextResponse.json(
    { error: "Selecione um método de pagamento válido." },
    { status: 400 },
  );
}

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Informe pelo menos um produto para a venda." },
        { status: 400 },
      );
    }

    const productIds = new Set();

    for (const item of items) {
      if (
        typeof item.productId !== "string" ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        return NextResponse.json(
          { error: "Produto ou quantidade inválidos." },
          { status: 400 },
        );
      }

      if (productIds.has(item.productId)) {
        return NextResponse.json(
          { error: "Informe cada produto uma única vez na venda." },
          { status: 400 },
        );
      }

      productIds.add(item.productId);
    }

    const sale = await prisma.$transaction(
      async (tx) => {
        let totalCents = 0;
        const deductions = [];
        const saleItems = [];

        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: {
              lots: {
                where: { quantity: { gt: 0 } },
                orderBy: [
                  { expiresAt: { sort: "asc", nulls: "last" } },
                  { createdAt: "asc" },
                ],
              },
            },
          });

          if (!product || !product.isActive) {
            throw Object.assign(new Error("Produto não encontrado ou inativo."), {
              status: 404,
            });
          }

          const availableQuantity = product.lots.reduce(
            (total, lot) => total + lot.quantity,
            0,
          );

          if (availableQuantity < item.quantity) {
            throw Object.assign(
              new Error(`Estoque insuficiente para ${product.name}.`),
              { status: 409 },
            );
          }

          const unitPriceCents = Math.round(
            product.salePrice.toNumber() * 100,
          );

          totalCents += unitPriceCents * item.quantity;

          let remainingQuantity = item.quantity;

          for (const lot of product.lots) {
            if (remainingQuantity === 0) break;

            const quantityFromLot = Math.min(
              remainingQuantity,
              lot.quantity,
            );

            deductions.push({
              lotId: lot.id,
              quantity: quantityFromLot,
            });

            saleItems.push({
              productId: product.id,
              lotId: lot.id,
              quantity: quantityFromLot,
              unitPrice: product.salePrice.toNumber(),
              unitCost: lot.unitCost.toNumber(),
            });

            remainingQuantity -= quantityFromLot;
          }
        }

        for (const deduction of deductions) {
          const result = await tx.lot.updateMany({
            where: {
              id: deduction.lotId,
              quantity: { gte: deduction.quantity },
            },
            data: {
              quantity: { decrement: deduction.quantity },
            },
          });

          if (result.count !== 1) {
            throw Object.assign(
              new Error("O estoque mudou. Atualize a tela e tente novamente."),
              { status: 409 },
            );
          }
        }

        const createdSale = await tx.sale.create({
  data: {
    total: totalCents / 100,
    paymentMethod: body.paymentMethod,
  },
});

        await tx.saleItem.createMany({
          data: saleItems.map((item) => ({
            ...item,
            saleId: createdSale.id,
          })),
        });

        return tx.sale.findUnique({
          where: { id: createdSale.id },
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true } },
                lot: { select: { lotCode: true, expiresAt: true } },
              },
            },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    return NextResponse.json(sale, { status: 201 });
} catch (error) {
  console.error("Erro ao registrar venda:", error);

  if (error.status) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  return NextResponse.json(
    { error: "Não foi possível registrar a venda." },
    { status: 500 },
  );
}
}