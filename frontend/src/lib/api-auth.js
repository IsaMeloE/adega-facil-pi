import { getCurrentUser } from "./auth";

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      response: Response.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      ),
    };
  }

  return { user, response: null };
}
