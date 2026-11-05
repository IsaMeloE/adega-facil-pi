import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return Response.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      );
    }

    const products = await prisma.product.findMany({
      orderBy: { name: "asc" },
      include: { lots: true },
    });

    return Response.json(products);
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    return Response.json(
      { error: "Não foi possível listar os produtos." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "O corpo da requisição deve ser JSON." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const salePrice = Number(body.salePrice);
  const minimumStock = Number(body.minimumStock ?? 0);

  if (!name || !Number.isFinite(salePrice) || salePrice <= 0) {
    return Response.json(
      { error: "Informe o nome do produto e um preço maior que zero." },
      { status: 400 },
    );
  }

  if (!Number.isInteger(minimumStock) || minimumStock < 0) {
    return Response.json(
      { error: "O estoque mínimo deve ser um número inteiro igual ou maior que zero." },
      { status: 400 },
    );
  }

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return Response.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      );
    }

    const product = await prisma.product.create({
      data: {
        name,
        salePrice,
        minimumStock,
        category:
          typeof body.category === "string" && body.category.trim()
            ? body.category.trim()
            : null,
        barcode:
          typeof body.barcode === "string" && body.barcode.trim()
            ? body.barcode.trim()
            : null,
      },
    });

    return Response.json(product, { status: 201 });
  } catch (error) {
    if (error.code === "P2002") {
      return Response.json(
        { error: "Já existe um produto com esse código de barras." },
        { status: 409 },
      );
    }

    console.error("Erro ao criar produto:", error);
    return Response.json(
      { error: "Não foi possível criar o produto." },
      { status: 500 },
    );
  }
}