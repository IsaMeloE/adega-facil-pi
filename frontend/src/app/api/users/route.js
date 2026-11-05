import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, hashPin } from "@/lib/auth";

export async function GET() {
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
        { error: "Somente administradores podem gerenciar usuários." },
        { status: 403 },
      );
    }

    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        lockedUntil: true,
      },
    });

    return NextResponse.json(users, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);

    return NextResponse.json(
      { error: "Não foi possível listar os usuários." },
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

    if (currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Somente administradores podem cadastrar usuários." },
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

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Informe os dados do usuário." },
        { status: 400 },
      );
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const pin = typeof body.pin === "string" ? body.pin : "";
    const role = body.role || "OPERATOR";

    if (!name) {
      return NextResponse.json(
        { error: "Informe o nome do usuário." },
        { status: 400 },
      );
    }

    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: "O PIN deve ter exatamente 6 dígitos." },
        { status: 400 },
      );
    }

    if (!["ADMIN", "OPERATOR"].includes(role)) {
      return NextResponse.json(
        { error: "Selecione um perfil válido." },
        { status: 400 },
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        pinHash: hashPin(pin),
        role,
      },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("Erro ao cadastrar usuário:", error);

    return NextResponse.json(
      { error: "Não foi possível cadastrar o usuário." },
      { status: 500 },
    );
  }
}