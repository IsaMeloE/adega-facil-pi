import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const SESSION_COOKIE_NAME = "adega_session";
export const SESSION_DURATION_SECONDS = 8 * 60 * 60;

export function verifyPin(pin, storedHash) {
  const [algorithm, salt, hashHex] = storedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !hashHex) {
    return false;
  }

  const expectedHash = Buffer.from(hashHex, "hex");

  if (expectedHash.length !== 64) {
    return false;
  }

  const actualHash = scryptSync(pin, salt, expectedHash.length);

  return timingSafeEqual(actualHash, expectedHash);
}

export function hashPin(pin) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");

  return `scrypt$${salt}$${hash}`;
}

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createUserSession(userId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_SECONDS * 1000,
  );

  await prisma.userSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date() || !session.user.isActive) {
    await prisma.userSession.deleteMany({
      where: { id: session.id },
    });
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    role: session.user.role,
  };
}

export async function deleteCurrentUserSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.userSession.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};