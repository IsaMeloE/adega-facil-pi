"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";

export const AuthUserContext = createContext(null);

export function useAuthUser() {
  return useContext(AuthUserContext);
}

const modules = [
  { id: "painel", label: "Painel", href: "/" },
  { id: "produtos", label: "Produtos", href: "/produtos" },
  { id: "vendas", label: "Vendas", href: "/vendas" },
  { id: "estoque", label: "Estoque", href: "/estoque" },
  { id: "fiados", label: "Fiados", href: "/fiados" },
  { id: "entregas", label: "Entregas", href: "/entregas" },
  { id: "relatorios", label: "Relatórios", href: "/relatorios" },
  { id: "usuarios", label: "Usuários", href: "/usuarios" },
];

export default function AppShell({ children }) {
  const pathname = usePathname();

  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (pathname === "/login") return;

    let isActive = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });

        if (!response.ok) {
          router.replace("/login");
          return;
        }

        const result = await response.json();

        if (isActive) {
          setUser(result.user);
          setIsAuthorized(true);
        }
      } catch {
        router.replace("/login");
      }
    }

    checkSession();

    return () => {
      isActive = false;
    };
  }, [pathname, router]);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.replace("/login");
    }
  }

  function focusMainContent(event) {
    const mainContent = document.getElementById("main-content");

    if (!mainContent) return;

    event.preventDefault();
    mainContent.focus();
  }

  if (pathname === "/login") {
    return children;
  }

  if (!isAuthorized) {
    return (
      <div className="content">
        <p role="status">Verificando acesso...</p>
      </div>
    );
  }

  const visibleModules = modules.filter(
    (module) => module.id !== "usuarios" || user?.role === "ADMIN",
  );

  return (
    <AuthUserContext.Provider value={user}>

      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <Image
              src="/logo-adega-facil.png"
              alt="AdegaFácil"
              width={52}
              height={52}
              className="brand-mark"
            />
            <div>
              <strong>AdegaFácil</strong>
              <span>Gestão de bebidas</span>
            </div>
          </div>

          <nav aria-label="Navegação principal" className="nav-list">
            <Link
              className="skip-link"
              href="#main-content"
              onClick={focusMainContent}
            >
              Pular para o conteúdo
            </Link>
            {visibleModules.map((module) => {
              const isActive = pathname === module.href;

              return (
                <Link
                  key={module.id}
                  className={`nav-item ${isActive ? "active" : ""}`}
                  href={module.href}
                  aria-current={isActive ? "page" : undefined}
                >
                  {module.label}
                </Link>
              );
            })}
          </nav>

          <button
            className="nav-item sidebar-logout"
            type="button"
            onClick={logout}
            aria-label={`Sair da conta de ${user?.name || "usuário"}`}
          >
            Sair
          </button>
        </aside>

        <div className="content">{children}</div>
      </div>
    </AuthUserContext.Provider>
  );
}