import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export async function GET() {
  try {
    const { response } = await requireUser();

    if (response) {
      return response;
    }

    const lots = await prisma.lot.findMany({
      include: {
        product: {
          select: { id: true, name: true, category: true, barcode: true },
        },
      },
      orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
    });

    return Response.json(lots);
  } catch (error) {
    console.error("Erro ao listar lotes:", error);
    return Response.json(
      { error: "Não foi possível listar os lotes." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  let body;

  try {
    const { response } = await requireUser();

    if (response) {
      return response;
    }

    body = await request.json();
  } catch {
    return Response.json(
      { error: "O corpo da requisição deve ser JSON." },
      { status: 400 },
    );
  }

  const productId =
    typeof body.productId === "string" ? body.productId.trim() : "";
  const quantity = Number(body.quantity);
  const unitCost = Number(body.unitCost);

  if (
    !productId ||
    !Number.isInteger(quantity) ||
    quantity <= 0 ||
    body.unitCost === undefined ||
    body.unitCost === "" ||
    !Number.isFinite(unitCost) ||
    unitCost < 0
  ) {
    return Response.json(
      { error: "Informe produto, quantidade inteira positiva e custo válido." },
      { status: 400 },
    );
  }

  let expiresAt = null;

  if (body.expiresAt) {
    expiresAt = new Date(body.expiresAt);

    if (Number.isNaN(expiresAt.getTime())) {
      return Response.json(
        { error: "A validade deve ser uma data válida." },
        { status: 400 },
      );
    }
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return Response.json(
        { error: "Produto não encontrado." },
        { status: 404 },
      );
    }

    const lot = await prisma.lot.create({
      data: {
        productId,
        quantity,
        unitCost,
        expiresAt,
        lotCode:
          typeof body.lotCode === "string" && body.lotCode.trim()
            ? body.lotCode.trim()
            : null,
      },
      include: {
        product: { select: { id: true, name: true } },
      },
    });

    return Response.json(lot, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar lote:", error);
    return Response.json(
      { error: "Não foi possível criar o lote." },
      { status: 500 },
    );
  }
}