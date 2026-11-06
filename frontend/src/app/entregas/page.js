"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../produtos/produtos.module.css";
import UserBadge from "../components/UserBadge";
import { formatCurrency } from "@/lib/formatters";

const statusLabels = {
  PENDING: "Pendente",
  IN_ROUTE: "Em rota",
  DELIVERED: "Entregue",
};

function formatDate(value) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EntregasPage() {
  const [deliveries, setDeliveries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingSaleId, setUpdatingSaleId] = useState("");
  const [error, setError] = useState("");

  const loadDeliveries = useCallback(async (signal) => {
    try {
      const response = await fetch("/api/sales", signal ? { signal } : undefined);

      if (!response.ok) {
        throw new Error("Não foi possível carregar as entregas.");
      }

      const sales = await response.json();
      setDeliveries(
        sales.filter(
          (sale) => sale.isDelivery && sale.status !== "CANCELLED",
        ),
      );
      setError("");
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(requestError.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      loadDeliveries(controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [loadDeliveries]);

  async function advanceDelivery(saleId) {
    setError("");
    setUpdatingSaleId(saleId);

    try {
      const response = await fetch(`/api/deliveries/${saleId}`, {
        method: "PATCH",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível atualizar a entrega.");
      }

      setDeliveries((current) =>
        current.map((sale) =>
          sale.id === saleId
            ? { ...sale, deliveryStatus: result.deliveryStatus }
            : sale,
        ),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingSaleId("");
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className={`${styles.container} ${styles.salesPage}`}>
      <header className={`${styles.header} ${styles.salesHeader}`}>
        <div>
          <h1>Entregas</h1>
          <p className={styles.salesSubtitle}>
            Atualize o andamento das entregas.
          </p>
        </div>

        <div className={styles.userInfo}>
          <UserBadge />
        </div>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <section className={styles.listCard} aria-labelledby="deliveries-title">
        <div className={styles.historyHeader}>
          <p className={styles.eyebrow}>ACOMPANHAMENTO</p>
          <h2 id="deliveries-title">Entregas vinculadas às vendas</h2>
        </div>

        {isLoading ? (
          <p role="status">Carregando entregas...</p>
        ) : deliveries.length === 0 ? (
          <p>Nenhuma entrega registrada.</p>
        ) : (
          <ul className={styles.salesList}>
            {deliveries.map((sale) => {
              const status = sale.deliveryStatus || "PENDING";
              const statusClass =
                status === "DELIVERED"
                  ? styles.statusOk
                  : status === "IN_ROUTE"
                    ? styles.statusWarning
                    : styles.statusMuted;

              return (
                <li className={styles.saleRow} key={sale.id}>
                  <div className={styles.saleDetails}>
                    <strong>
                      {sale.deliveryAddress} · {formatCurrency(sale.deliveryFee)}
                    </strong>
                    <span>
                      {sale.deliveryNotes || "Sem observação"} · venda{" "}
                      {sale.id.slice(-6)} · {formatDate(sale.createdAt)}
                    </span>
                  </div>

                  <div className={styles.deliveryActions}>
                    <span className={`${styles.statusBadge} ${statusClass}`}>
                      {statusLabels[status] || "Pendente"}
                    </span>

                    {status !== "DELIVERED" && (
                      <button
                        className={styles.deliveryButton}
                        type="button"
                        onClick={() => advanceDelivery(sale.id)}
                        disabled={updatingSaleId === sale.id}
                      >
                        {updatingSaleId === sale.id ? "Atualizando..." : "Avançar"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}