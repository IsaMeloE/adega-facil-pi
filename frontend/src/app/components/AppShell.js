"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const modules = [
  { id: "painel", label: "Painel", href: "/" },
  { id: "produtos", label: "Produtos", href: "/produtos" },
  { id: "vendas", label: "Vendas", href: "/vendas" },
  { id: "estoque", label: "Estoque", href: "/estoque" },
  { id: "fiados", label: "Fiados", href: "/fiados" },
];

export default function AppShell({ children }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">AF</span>
          <div>
            <strong>AdegaFácil</strong>
            <span>Gestão de bebidas</span>
          </div>
        </div>

        <nav aria-label="Navegação principal" className="nav-list">
          {modules.map((module) => {
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
      </aside>

      <div className="content">{children}</div>
    </div>
  );
}