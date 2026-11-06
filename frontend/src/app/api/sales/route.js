import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { allocateLotsFefo } from "@/lib/sales/fefo";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      );
    }

    const sales = await prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
            lot: { select: { lotCode: true, expiresAt: true } },
          },
        },
        lines: {
          include: {
            product: { select: { id: true, name: true } },
            allocations: {
              include: {
                lot: { select: { lotCode: true, expiresAt: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      sales.map((sale) => ({
        ...sale,
        canCancel: currentUser.role === "ADMIN",
      })),
    );
  } catch (error) {
    console.error("Erro ao carregar vendas:", error);

    return NextResponse.json(
      { error: "Não foi possível carregar as vendas." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "O corpo da requisição deve ser JSON." },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Informe os dados da venda." },
        { status: 400 },
      );
    }

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

    const itemKeys = new Set();

    for (const item of items) {
      if (
        typeof item.productId !== "string" ||
        !item.productId.trim() ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        !["UNIT", "PACK"].includes(item.saleMode)
      ) {
        return NextResponse.json(
          { error: "Produto, modalidade ou quantidade inválidos." },
          { status: 400 },
        );
      }

      const key = `${item.productId}:${item.saleMode}`;

      if (itemKeys.has(key)) {
        return NextResponse.json(
          { error: "Não repita o mesmo produto na mesma modalidade." },
          { status: 400 },
        );
      }

      itemKeys.add(key);
    }

    const inicioDoDia = new Date();
    inicioDoDia.setHours(0, 0, 0, 0);

    const toCents = (value) => Math.round(Number(value || 0) * 100);

    const sale = await prisma.$transaction(
      async (tx) => {
        let totalCents = deliveryFeeCents;
        const productsById = new Map();
        const remainingByLotId = new Map();
        const preparedLines = [];
        const deductionsByLotId = new Map();

        if (body.paymentMethod === "FIADO") {
          const customer = await tx.customer.findUnique({
            where: { id: customerId },
            select: { id: true, isActive: true },
          });

          if (!customer || !customer.isActive) {
            throw Object.assign(
              new Error("Cliente não encontrado ou inativo."),
              { status: 404 },
            );
          }
        }

        for (const item of items) {
          const productId = item.productId.trim();
          let product = productsById.get(productId);

          if (!product) {
            product = await tx.product.findUnique({
              where: { id: productId },
              include: {
                lots: {
                  orderBy: { createdAt: "asc" },
                },
              },
            });

            if (!product || !product.isActive) {
              throw Object.assign(
                new Error("Produto não encontrado ou inativo."),
                { status: 404 },
              );
            }

            productsById.set(productId, product);

            for (const lot of product.lots) {
              remainingByLotId.set(lot.id, lot.quantity);
            }
          }

          let baseQuantity;
          let unitPriceCents;

          if (item.saleMode === "PACK") {
            if (
              !Number.isInteger(product.unitsPerPack) ||
              product.unitsPerPack < 2 ||
              product.packSalePrice == null ||
              toCents(product.packSalePrice) <= 0
            ) {
              throw Object.assign(
                new Error(`O produto ${product.name} não tem fardo configurado.`),
                { status: 400 },
              );
            }

            baseQuantity = item.quantity * product.unitsPerPack;
            unitPriceCents = toCents(product.packSalePrice);
          } else {
            baseQuantity = item.quantity;
            unitPriceCents = toCents(product.salePrice);
          }

          if (!Number.isSafeInteger(baseQuantity) || baseQuantity < 1) {
            throw Object.assign(
              new Error(`Quantidade inválida para ${product.name}.`),
              { status: 400 },
            );
          }

          const fefoResult = allocateLotsFefo({
            lots: product.lots,
            quantity: baseQuantity,
            remainingByLotId,
            startOfDay: inicioDoDia,
            productName: product.name,
          });

          for (const [lotId, quantity] of fefoResult.deductionsByLotId) {
            deductionsByLotId.set(
              lotId,
              (deductionsByLotId.get(lotId) || 0) + quantity,
            );
          }

          for (const [lotId, quantity] of fefoResult.remainingByLotId) {
            remainingByLotId.set(lotId, quantity);
          }

          totalCents += unitPriceCents * item.quantity;

          preparedLines.push({
            product,
            saleMode: item.saleMode,
            quantity: item.quantity,
            baseQuantity,
            unitPriceCents,
            allocations: fefoResult.allocations,
          });
        }

        for (const [lotId, quantity] of deductionsByLotId) {
          const result = await tx.lot.updateMany({
            where: {
              id: lotId,
              quantity: { gte: quantity },
            },
            data: {
              quantity: { decrement: quantity },
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
            createdByUserId: currentUser.id,
          },
        });

        for (const line of preparedLines) {
          const createdLine = await tx.saleLine.create({
            data: {
              saleId: createdSale.id,
              productId: line.product.id,
              saleMode: line.saleMode,
              quantity: line.quantity,
              baseQuantity: line.baseQuantity,
              unitPrice: line.unitPriceCents / 100,
            },
          });

          await tx.saleItem.createMany({
            data: line.allocations.map(({ lot, quantity }) => ({
              saleId: createdSale.id,
              productId: line.product.id,
              saleLineId: createdLine.id,
              lotId: lot.id,
              quantity,
              unitPrice: null,
              unitCost: lot.unitCost,
            })),
          });
        }

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
            lines: {
              include: {
                product: { select: { id: true, name: true } },
                allocations: {
                  include: {
                    lot: { select: { lotCode: true, expiresAt: true } },
                  },
                },
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

    if (error.code === "P2034") {
      return NextResponse.json(
        { error: "O estoque mudou. Atualize a tela e tente novamente." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Não foi possível registrar a venda." },
      { status: 500 },
    );
  }
}