import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  createUserSession,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifyPin,
} from "@/lib/auth";

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Informe o usuário e o PIN." },
      { status: 400 },
    );
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  const pin = typeof body.pin === "string" ? body.pin : "";

  if (!userId || !/^\d{6}$/.test(pin)) {
    return NextResponse.json(
      { error: "Selecione o usuário e informe um PIN de 6 dígitos." },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        pinHash: true,
        isActive: true,
        failedPinAttempts: true,
        lockedUntil: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Usuário ou PIN inválido." },
        { status: 401 },
      );
    }

    const now = new Date();

    if (user.lockedUntil && user.lockedUntil > now) {
      return NextResponse.json(
        { error: "Acesso temporariamente bloqueado. Tente novamente mais tarde." },
        { status: 429 },
      );
    }

    const isPinValid = verifyPin(pin, user.pinHash);

    if (!isPinValid) {
      const previousAttempts =
        user.lockedUntil && user.lockedUntil <= now
          ? 0
          : user.failedPinAttempts;
      const failedAttempts = previousAttempts + 1;
      const shouldLock = failedAttempts >= 5;
      const lockedUntil = shouldLock
        ? new Date(now.getTime() + 15 * 60 * 1000)
        : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedPinAttempts: shouldLock ? 0 : failedAttempts,
          lockedUntil,
        },
      });

      return NextResponse.json(
        {
          error: shouldLock
            ? "Acesso bloqueado por 15 minutos após cinco tentativas incorretas."
            : "Usuário ou PIN inválido.",
        },
        { status: shouldLock ? 429 : 401 },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedPinAttempts: 0,
        lockedUntil: null,
      },
    });

    const { token } = await createUserSession(user.id);
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions);

    return response;
  } catch (error) {
    console.error("Erro ao autenticar usuário:", error);

    return NextResponse.json(
      { error: "Não foi possível realizar o acesso." },
      { status: 500 },
    );
  }
}