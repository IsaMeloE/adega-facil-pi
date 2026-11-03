"use client";

import { useState } from "react";

const modules = [
  { id: "painel", label: "Painel" },
  { id: "produtos", label: "Produtos" },
  { id: "vendas", label: "Vendas" },
  { id: "estoque", label: "Estoque" },
  { id: "fiados", label: "Fiados" },
  { id: "entregas", label: "Entregas" },
  { id: "relatorios", label: "Relatórios" },
];

export default function Home() {
  const [activePage, setActivePage] = useState("painel");
  const activeModule = modules.find((module) => module.id === activePage);

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
          {modules.map((module) => (
            <button
              key={module.id}
              type="button"
              className={`nav-item ${activePage === module.id ? "active" : ""}`}
              aria-current={activePage === module.id ? "page" : undefined}
              onClick={() => setActivePage(module.id)}
            >
              {module.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">GESTÃO DE BEBIDAS</p>
            <h1>{activeModule.label}</h1>
          </div>
          <span className="user-badge">Administrador</span>
        </header>

        {activePage === "painel" ? (
          <>
            <section className="summary-grid" aria-label="Resumo da operação">
              <article className="summary-card">
                <span>Vendas hoje</span>
                <strong>R$ 0,00</strong>
              </article>
              <article className="summary-card">
                <span>Estoque baixo</span>
                <strong>0 itens</strong>
              </article>
              <article className="summary-card">
                <span>Fiados em aberto</span>
                <strong>R$ 0,00</strong>
              </article>
              <article className="summary-card">
                <span>Entregas pendentes</span>
                <strong>0</strong>
              </article>
            </section>

            <section className="panel-grid">
              <article className="panel">
                <h2>Validade e estoque</h2>
                <p>Os alertas de produtos aparecerão aqui.</p>
              </article>
              <article className="panel">
                <h2>Últimas vendas</h2>
                <p>As vendas recentes aparecerão aqui.</p>
              </article>
            </section>
          </>
        ) : (
          <section className="panel" aria-labelledby="module-title">
            <h2 id="module-title">{activeModule.label}</h2>
            <p>
              Esta tela será migrada do protótipo do AdegaFácil nesta etapa.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}