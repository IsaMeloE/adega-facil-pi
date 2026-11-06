import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export async function PATCH(_request, context) {
  try {
    const { response } = await requireUser();

    if (response) {
      return response;
    }

    const { saleId } = await context.params;

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: {
        id: true,
        status: true,
        isDelivery: true,
        deliveryStatus: true,
      },
    });

    if (!sale) {
      return NextResponse.json(
        { error: "Venda não encontrada." },
        { status: 404 },
      );
    }

    if (sale.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Esta venda foi cancelada e não pode avançar na entrega." },
        { status: 409 },
      );
    }

    if (!sale.isDelivery) {
      return NextResponse.json(
        { error: "Esta venda não possui entrega." },
        { status: 400 },
      );
    }

    const currentStatus = sale.deliveryStatus ?? "PENDING";
    const nextStatus = {
      PENDING: "IN_ROUTE",
      IN_ROUTE: "DELIVERED",
    }[currentStatus];

    if (!nextStatus) {
      return NextResponse.json(
        { error: "Esta entrega já foi concluída." },
        { status: 409 },
      );
    }

    const updated = await prisma.sale.updateMany({
      where: {
        id: sale.id,
        deliveryStatus: sale.deliveryStatus,
      },
      data: { deliveryStatus: nextStatus },
    });

    if (updated.count !== 1) {
      return NextResponse.json(
        { error: "A entrega foi atualizada. Recarregue a tela." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      id: sale.id,
      deliveryStatus: nextStatus,
    });
  } catch (error) {
    console.error("Erro ao atualizar entrega:", error);

    return NextResponse.json(
      { error: "Não foi possível atualizar a entrega." },
      { status: 500 },
    );
  }
}