import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request, context) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      );
    }

    if (currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Somente um administrador pode cancelar vendas." },
        { status: 403 },
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

    const reason =
      typeof body?.reason === "string" ? body.reason.trim() : "";

    if (reason.length < 5 || reason.length > 500) {
      return NextResponse.json(
        { error: "Informe um motivo entre 5 e 500 caracteres." },
        { status: 400 },
      );
    }

    const { saleId } = await context.params;

    const result = await prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.findUnique({
          where: { id: saleId },
          include: {
            items: {
              select: {
                lotId: true,
                quantity: true,
              },
            },
            creditMovement: {
              select: {
                id: true,
                customerId: true,
                amount: true,
                type: true,
              },
            },
          },
        });

        if (!sale) {
          throw Object.assign(new Error("Venda não encontrada."), {
            status: 404,
          });
        }

        if (sale.status !== "COMPLETED") {
          throw Object.assign(
            new Error("Esta venda já foi cancelada."),
            { status: 409 },
          );
        }

        if (sale.isDelivery && sale.deliveryStatus !== "PENDING") {
          throw Object.assign(
            new Error(
              "Só é possível cancelar a venda antes de a entrega sair para rota.",
            ),
            { status: 409 },
          );
        }

        if (
          sale.paymentMethod === "FIADO" &&
          (!sale.creditMovement || sale.creditMovement.type !== "CHARGE")
        ) {
          throw Object.assign(
            new Error("Não foi possível localizar o lançamento do fiado."),
            { status: 409 },
          );
        }

        const updated = await tx.sale.updateMany({
          where: {
            id: sale.id,
            status: "COMPLETED",
          },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelledByUserId: currentUser.id,
            cancellationReason: reason,
          },
        });

        if (updated.count !== 1) {
          throw Object.assign(
            new Error("A venda já foi atualizada. Recarregue a tela."),
            { status: 409 },
          );
        }

        const quantityByLotId = new Map();

        for (const item of sale.items) {
          quantityByLotId.set(
            item.lotId,
            (quantityByLotId.get(item.lotId) || 0) + item.quantity,
          );
        }

        for (const [lotId, quantity] of quantityByLotId) {
          await tx.lot.update({
            where: { id: lotId },
            data: {
              quantity: { increment: quantity },
            },
          });
        }

        if (sale.creditMovement) {
          await tx.creditMovement.create({
            data: {
              customerId: sale.creditMovement.customerId,
              type: "REVERSAL",
              amount: sale.creditMovement.amount,
              notes: `Estorno da venda ${sale.id}: ${reason}`,
              reversalOfId: sale.creditMovement.id,
            },
          });
        }

        return {
          id: sale.id,
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: reason,
        };
      },
      { isolationLevel: "Serializable" },
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error.status) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error.code === "P2034" || error.code === "P2002") {
      return NextResponse.json(
        { error: "A venda foi atualizada. Recarregue a tela e tente novamente." },
        { status: 409 },
      );
    }

    console.error("Erro ao cancelar venda:", error);

    return NextResponse.json(
      { error: "Não foi possível cancelar a venda." },
      { status: 500 },
    );
  }
}