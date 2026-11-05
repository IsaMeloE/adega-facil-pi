import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, hashPin } from "@/lib/auth";

export async function PATCH(request, context) {
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

    const { userId } = await context.params;

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
        { error: "Informe a alteração desejada." },
        { status: 400 },
      );
    }

    const hasActiveStatus = Object.hasOwn(body, "isActive");
    const hasPin = Object.hasOwn(body, "pin");

    if (!hasActiveStatus && !hasPin) {
      return NextResponse.json(
        { error: "Informe se deseja alterar o status ou redefinir o PIN." },
        { status: 400 },
      );
    }

    if (hasActiveStatus && typeof body.isActive !== "boolean") {
      return NextResponse.json(
        { error: "O status do usuário é inválido." },
        { status: 400 },
      );
    }

    if (hasPin && (typeof body.pin !== "string" || !/^\d{6}$/.test(body.pin))) {
      return NextResponse.json(
        { error: "O novo PIN deve ter exatamente 6 dígitos." },
        { status: 400 },
      );
    }

    if (userId === currentUser.id && body.isActive === false) {
      return NextResponse.json(
        { error: "Você não pode desativar seu próprio usuário." },
        { status: 400 },
      );
    }

    const updatedUser = await prisma.$transaction(
      async (tx) => {
        const targetUser = await tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            role: true,
            isActive: true,
          },
        });

        if (!targetUser) {
          throw Object.assign(new Error("Usuário não encontrado."), {
            status: 404,
          });
        }

        if (
          targetUser.role === "ADMIN" &&
          targetUser.isActive &&
          body.isActive === false
        ) {
          const activeAdminCount = await tx.user.count({
            where: { role: "ADMIN", isActive: true },
          });

          if (activeAdminCount <= 1) {
            throw Object.assign(
              new Error("Não é possível desativar o último administrador ativo."),
              { status: 409 },
            );
          }
        }

        const data = {};

        if (hasActiveStatus) {
          data.isActive = body.isActive;
        }

        if (hasPin) {
          data.pinHash = hashPin(body.pin);
          data.failedPinAttempts = 0;
          data.lockedUntil = null;
        }

        if (body.isActive === true) {
          data.failedPinAttempts = 0;
          data.lockedUntil = null;
        }

        const user = await tx.user.update({
          where: { id: userId },
          data,
          select: {
            id: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
            lockedUntil: true,
          },
        });

        if (body.isActive === false || hasPin) {
          await tx.userSession.deleteMany({
            where: { userId },
          });
        }

        return user;
      },
      { isolationLevel: "Serializable" },
    );

    return NextResponse.json(updatedUser);
  } catch (error) {
    if (error.status) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error.code === "P2034") {
      return NextResponse.json(
        { error: "Os dados foram alterados. Atualize a tela e tente novamente." },
        { status: 409 },
      );
    }

    console.error("Erro ao atualizar usuário:", error);

    return NextResponse.json(
      { error: "Não foi possível atualizar o usuário." },
      { status: 500 },
    );
  }
}