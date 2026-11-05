import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    return NextResponse.json(customers);
  } catch (error) {
    console.error("Erro ao listar clientes:", error);

    return NextResponse.json(
      { error: "Não foi possível listar os clientes." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
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
      { error: "Informe os dados do cliente." },
      { status: 400 },
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!name) {
    return NextResponse.json(
      { error: "Informe o nome do cliente." },
      { status: 400 },
    );
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        name,
        phone: phone || null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("Erro ao cadastrar cliente:", error);

    return NextResponse.json(
      { error: "Não foi possível cadastrar o cliente." },
      { status: 500 },
    );
  }
}