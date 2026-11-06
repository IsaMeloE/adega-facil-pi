"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../app/produtos/produtos.module.css";
import UserBadge from "./components/UserBadge";
import { formatCurrency } from "@/lib/formatters";
import { formatLocalDate } from "@/lib/dates";

function validityStatus(expiresAt, today, limit) {
  if (!expiresAt) return null;

  const expiryDate = String(expiresAt).slice(0, 10);

  if (expiryDate < today) return "Vencido";
  if (expiryDate <= limit) return "Vence em breve";

  return null;
}

export default function Home() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [creditBalance, setCreditBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        const [salesResponse, productsResponse, creditsResponse] =
          await Promise.all([
            fetch("/api/sales", { signal: controller.signal }),
            fetch("/api/products", { signal: controller.signal }),
            fetch("/api/credits", { signal: controller.signal }),
          ]);

        if (
          !salesResponse.ok ||
          !productsResponse.ok ||
          !creditsResponse.ok
        ) {
          throw new Error("Não foi possível carregar os dados do painel.");
        }

        const [salesData, productsData, creditsData] = await Promise.all([
          salesResponse.json(),
          productsResponse.json(),
          creditsResponse.json(),
        ]);

        setSales(salesData);
        setProducts(productsData);
        setCreditBalance(Number(creditsData.totalOpenBalance || 0));

      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => controller.abort();
  }, []);

  const today = formatLocalDate(new Date());
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + 30);
  const limit = formatLocalDate(limitDate);

  const todaySales = useMemo(
    () =>
      sales.filter(
        (sale) =>
          sale.status !== "CANCELLED" &&
          sale.createdAt &&
          formatLocalDate(new Date(sale.createdAt)) === today,
      ),
    [sales, today],
  );

  const todayRevenue = todaySales.reduce(
    (total, sale) => total + Number(sale.total || 0),
    0,
  );

  const stockByProduct = products
    .filter((product) => product.isActive !== false)
    .map((product) => {
      const validQuantity = (product.lots || [])
        .filter(
          (lot) =>
            !lot.expiresAt || String(lot.expiresAt).slice(0, 10) >= today,
        )
        .reduce((total, lot) => total + Number(lot.quantity || 0), 0);

      return {
        ...product,
        validQuantity,
        minimumStock: Number(product.minimumStock || 0),
      };
    });

  const lowStockProducts = stockByProduct.filter(
    (product) =>
      product.minimumStock > 0 &&
      product.validQuantity <= product.minimumStock,
  );

  const expiryAlerts = products.flatMap((product) =>
    (product.lots || [])
      .filter((lot) => Number(lot.quantity || 0) > 0)
      .map((lot) => ({
        product,
        lot,
        status: validityStatus(lot.expiresAt, today, limit),
      }))
      .filter((alert) => alert.status),
  );

  const alerts = [
    ...expiryAlerts.map(({ product, lot, status }) => ({
      id: `lot-${lot.id}`,
      title: product.name,
      detail: [
        lot.lotCode ? `Lote ${lot.lotCode}` : null,
        `${lot.quantity} un.`,
        lot.expiresAt
          ? `Validade ${String(lot.expiresAt)
            .slice(0, 10)
            .split("-")
            .reverse()
            .join("/")}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      status,
    })),
    ...lowStockProducts.map((product) => ({
      id: `product-${product.id}`,
      title: product.name,
      detail: `${product.validQuantity} un. disponíveis · mínimo ${product.minimumStock}`,
      status: "Estoque baixo",
    })),
  ].slice(0, 6);

  const latestSales = sales.slice(0, 3);

  const pendingDeliveries = sales.filter(
    (sale) =>
      sale.status !== "CANCELLED" &&
      sale.isDelivery &&
      sale.deliveryStatus !== "DELIVERED",
  ).length;

  return (
    <main id="main-content" tabIndex={-1}>
      <header className="topbar">
        <div>
          <p className="eyebrow">GESTÃO DE BEBIDAS</p>
          <h1>Painel</h1>
        </div>

        <div className={styles.userInfo}>
          <UserBadge />
        </div>
      </header>

      {error && (
        <p className="dashboard-error" role="alert">
          {error}
        </p>
      )}

      <section className="summary-grid" aria-label="Resumo da operação">
        <article className="summary-card">
          <span>Vendas hoje</span>
          <strong>{isLoading ? "—" : formatCurrency(todayRevenue)}</strong>
          <small>
            {isLoading
              ? "Carregando..."
              : `${todaySales.length} ${todaySales.length === 1 ? "venda" : "vendas"
              }`}
          </small>
        </article>

        <article className="summary-card">
          <span>Estoque baixo</span>
          <strong>{isLoading ? "—" : `${lowStockProducts.length} itens`}</strong>
          <small>Produtos no mínimo ou abaixo dele</small>
        </article>

        <article className="summary-card">
          <span>Fiados em aberto</span>
          <strong>
            {isLoading ? "—" : formatCurrency(creditBalance)}
          </strong>
          <small>Saldo total a receber</small>
        </article>

        <article className="summary-card">
          <span>Entregas pendentes</span>
          <strong>{isLoading ? "—" : pendingDeliveries}</strong>
          <small>Aguardando conclusão</small>
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">

          <h2>Validade e estoque</h2>

          {isLoading ? (
            <p>Carregando alertas...</p>
          ) : alerts.length === 0 ? (
            <p>Nenhum alerta de validade ou estoque baixo.</p>
          ) : (
            <ul className="dashboard-list">
              {alerts.map((alert) => (
                <li className="dashboard-row" key={alert.id}>
                  <div className="dashboard-row-content">
                    <strong>{alert.title}</strong>
                    <span>{alert.detail}</span>
                  </div>
                  <span className="dashboard-status">{alert.status}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel">
          <h2>Últimas vendas</h2>

          {isLoading ? (
            <p>Carregando vendas...</p>
          ) : latestSales.length === 0 ? (
            <p>Nenhuma venda registrada.</p>
          ) : (
            <ul className="dashboard-list">
              {latestSales.map((sale) => {
                const productNames = [
                  ...new Set(
                    (sale.items || [])
                      .map((item) => item.product?.name)
                      .filter(Boolean),
                  ),
                ];

                const saleDate = sale.createdAt
                  ? new Date(sale.createdAt).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : "";

                return (
                  <li className="dashboard-row" key={sale.id}>
                    <div className="dashboard-row-content">
                      <strong>{formatCurrency(sale.total)}</strong>
                      <span>
                        {productNames.slice(0, 2).join(", ") ||
                          "Produtos da venda"}
                        {productNames.length > 2
                          ? ` e mais ${productNames.length - 2}`
                          : ""}
                        {saleDate ? ` · ${saleDate}` : ""}
                      </span>
                    </div>
                    <span
                      className={`dashboard-status ${sale.status === "CANCELLED"
                          ? "dashboard-status-cancelled"
                          : "dashboard-status-paid"
                        }`}
                    >
                      {sale.status === "CANCELLED"
                        ? "Cancelada"
                        : String(sale.paymentMethod || "")
                          .replaceAll("_", " ")
                          .toLowerCase()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}