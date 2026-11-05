import { NextResponse } from "next/server";
import {
  deleteCurrentUserSession,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/auth";

export async function POST() {
  try {
    await deleteCurrentUserSession();

    const response = NextResponse.json({ message: "Sessão encerrada." });
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      ...sessionCookieOptions,
      expires: new Date(0),
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Erro ao encerrar sessão:", error);

    return NextResponse.json(
      { error: "Não foi possível encerrar a sessão." },
      { status: 500 },
    );
  }
}