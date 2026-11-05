import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
      },
    });

    return NextResponse.json(users, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Erro ao listar usuários para acesso:", error);

    return NextResponse.json(
      { error: "Não foi possível carregar os usuários." },
      { status: 500 },
    );
  }
}