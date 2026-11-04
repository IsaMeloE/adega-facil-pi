export default function Home() {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">GESTÃO DE BEBIDAS</p>
          <h1>Painel</h1>
        </div>
        <span className="user-badge">Administrador</span>
      </header>

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
  );
}