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
    const customerId =
      typeof body.customerId === "string" ? body.customerId.trim() : "";
    const paymentMethods = [
      "FIADO",
      "PIX",
      "DINHEIRO",
      "CARTAO_DEBITO",
      "CARTAO_CREDITO",
    ];

    const delivery = body.delivery ?? {};

    if (typeof delivery !== "object" || Array.isArray(delivery)) {
      return NextResponse.json(
        { error: "Dados de entrega inválidos." },
        { status: 400 },
      );
    }

    const isDelivery = delivery.isDelivery ?? false;

    if (typeof isDelivery !== "boolean") {
      return NextResponse.json(
        { error: "Informe se a venda terá entrega." },
        { status: 400 },
      );
    }

    let deliveryFeeCents = 0;
    let deliveryAddress = null;
    let deliveryNotes = null;

    if (isDelivery) {
      const fee = Number(delivery.fee);
      const address =
        typeof delivery.address === "string" ? delivery.address.trim() : "";
      const notes =
        typeof delivery.notes === "string" ? delivery.notes.trim() : "";

      if (!Number.isFinite(fee) || fee < 0 || !address) {
        return NextResponse.json(
          { error: "Informe um endereço e uma taxa de entrega válida." },
          { status: 400 },
        );
      }

      deliveryFeeCents = Math.round(fee * 100);
      deliveryAddress = address;
      deliveryNotes = notes || null;
    }

    if (!paymentMethods.includes(body.paymentMethod)) {
      return NextResponse.json(
        { error: "Selecione um método de pagamento válido." },
        { status: 400 },
      );
    }

    if (body.paymentMethod === "FIADO" && !customerId) {
      return NextResponse.json(
        { error: "Selecione um cliente para registrar a venda fiada." },
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

    const inicioDoDia = new Date();
    inicioDoDia.setHours(0, 0, 0, 0);

    const sale = await prisma.$transaction(
      async (tx) => {
        let totalCents = deliveryFeeCents;
        const deductions = [];
        const saleItems = [];

        if (body.paymentMethod === "FIADO") {
          const customer = await tx.customer.findUnique({
            where: { id: customerId },
          });

          if (!customer || !customer.isActive) {
            throw Object.assign(new Error("Cliente não encontrado ou inativo."), {
              status: 404,
            });
          }
        }

        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: {
              lots: {
                where: {
                  quantity: { gt: 0 },
                  OR: [
                    { expiresAt: null },
                    { expiresAt: { gte: inicioDoDia } },
                  ],
                },
                orderBy: [
                  { expiresAt: { sort: "asc", nulls: "last"} },
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
              new Error(`Estoque válido insuficiente para ${product.name}.`),
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
            isDelivery,
            deliveryStatus: isDelivery ? "PENDING" : null,
            deliveryFee: deliveryFeeCents / 100,
            deliveryAddress,
            deliveryNotes,
            customerId: body.paymentMethod === "FIADO" ? customerId : null,
          },
        });

        await tx.saleItem.createMany({
          data: saleItems.map((item) => ({
            ...item,
            saleId: createdSale.id,
          })),
        });

        if (body.paymentMethod === "FIADO") {
          await tx.creditMovement.create({
            data: {
              customerId,
              saleId: createdSale.id,
              type: "CHARGE",
              amount: totalCents / 100,
            },
          });
        }

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