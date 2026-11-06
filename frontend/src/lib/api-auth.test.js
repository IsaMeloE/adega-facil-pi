import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "./auth";
import { requireUser } from "./api-auth";

vi.mock("./auth", () => ({
  getCurrentUser: vi.fn(),
}));

describe("requireUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("fornece o usuário autenticado", async () => {
    const user = { id: "user-1", role: "OPERATOR" };
    getCurrentUser.mockResolvedValue(user);

    await expect(requireUser()).resolves.toEqual({
      user,
      response: null,
    });
  });

  it("fornece resposta 401 quando não há usuário", async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await requireUser();

    expect(result.user).toBeNull();
    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({
      error: "Acesso não autorizado.",
    });
  });
});
