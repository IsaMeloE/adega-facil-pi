"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../produtos/produtos.module.css";
import UserBadge from "../components/UserBadge";
import { formatCurrency } from "@/lib/formatters";

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateRange(period) {
  const today = new Date();
  const end = formatLocalDate(today);
  const startDate = new Date(today);

  if (period === "today") {
    return { from: end, to: end };
  }

  if (period === "week") {
    startDate.setDate(startDate.getDate() - 6);
  } else {
    startDate.setDate(1);
  }

  return { from: formatLocalDate(startDate), to: end };
}

export default function RelatoriosPage() {
  const [period, setPeriod] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = useCallback(async (start, end, signal) => {
    try {
      const params = new URLSearchParams({ from: start, to: end });
      const response = await fetch(`/api/reports?${params}`, { signal });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível carregar o relatório.");
      }

      setReport(result);
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
    const timer = window.setTimeout(() => {
      const range = getDateRange("month");
      setFrom(range.from);
      setTo(range.to);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!from || !to) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      loadReport(from, to, controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [from, to, loadReport]);

  function handlePeriodChange(value) {
    setPeriod(value);

    if (value !== "custom") {
      const range = getDateRange(value);
      setFrom(range.from);
      setTo(range.to);
    }
  }

  return (
    <main className={`${styles.container} ${styles.salesPage}`}>
      <header className={`${styles.header} ${styles.salesHeader}`}>
        <div>
          <h1>Relatórios</h1>
          <p className={styles.salesSubtitle}>
            Indicadores básicos da operação.
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

      <section className={styles.reportFilters} aria-label="Período do relatório">
        <label htmlFor="reportPeriod">Período</label>
        <select
          id="reportPeriod"
          value={period}
          onChange={(event) => handlePeriodChange(event.target.value)}
        >
          <option value="today">Hoje</option>
          <option value="week">Últimos 7 dias</option>
          <option value="month">Este mês</option>
          <option value="custom">Personalizado</option>
        </select>

        {period === "custom" && (
          <div className={styles.reportDateFields}>
            <label>
              De
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>

            <label>
              Até
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>
        )}
      </section>

      <p className={styles.eyebrow}>INDICADORES</p>

      <section className={styles.reportsSummary} aria-label="Resumo do período">
        <article className={styles.reportCard}>
          <span className={styles.reportLabel}>Faturamento no período</span>
          <strong className={styles.reportValue}>
            {isLoading ? "Carregando..." : formatCurrency(report?.revenue)}
          </strong>
        </article>

        <article className={styles.reportCard}>
          <span className={styles.reportLabel}>Vendas registradas</span>
          <strong className={styles.reportValue}>
            {isLoading ? "..." : report?.salesCount ?? 0}
          </strong>
        </article>

        <article className={styles.reportCard}>
          <span className={styles.reportLabel}>Unidades vendidas</span>
          <strong className={styles.reportValue}>
            {isLoading ? "..." : report?.unitsSold ?? 0}
          </strong>
        </article>

        <article className={styles.reportCard}>
          <span className={styles.reportLabel}>Fiados em aberto</span>
          <strong className={styles.reportValue}>
            {isLoading
              ? "Carregando..."
              : formatCurrency(report?.openCreditBalance)}
          </strong>
          <small className={styles.reportNote}>Saldo atual a receber</small>
        </article>
      </section>

      <section className={styles.reportPanels}>
        <article className={`${styles.listCard} ${styles.reportPanel}`}>
          <div className={styles.historyHeader}>
            <p className={styles.eyebrow}>RANKING</p>
            <h2>Mais vendidos</h2>
          </div>

          {isLoading ? (
            <p>Carregando produtos...</p>
          ) : report?.topProducts.length ? (
            <ol className={styles.reportRows}>
              {report.topProducts.map((product, index) => (
                <li className={styles.reportRow} key={product.productId}>
                  <div>
                    <strong>
                      {index + 1}. {product.name}
                    </strong>
                    <span>{product.quantity} un.</span>
                  </div>
                  <strong>{formatCurrency(product.total)}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p>Nenhuma venda registrada nesse período.</p>
          )}
        </article>

        <article className={`${styles.listCard} ${styles.reportPanel}`}>
          <div className={styles.historyHeader}>
            <p className={styles.eyebrow}>PAGAMENTOS</p>
            <h2>Distribuição</h2>
          </div>

          {isLoading ? (
            <p>Carregando pagamentos...</p>
          ) : report?.paymentDistribution.length ? (
            <ul className={styles.reportRows}>
              {report.paymentDistribution
                .slice()
                .sort((a, b) => b.total - a.total)
                .map((payment) => (
                  <li className={styles.reportRow} key={payment.paymentMethod}>
                    <strong>{payment.label}</strong>
                    <strong>{formatCurrency(payment.total)}</strong>
                  </li>
                ))}
            </ul>
          ) : (
            <p>Nenhuma venda registrada nesse período.</p>
          )}
        </article>
      </section>
    </main>
  );
}