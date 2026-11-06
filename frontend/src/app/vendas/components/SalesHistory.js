import styles from "../../produtos/produtos.module.css";
import { formatCurrency } from "@/lib/formatters";

export default function SalesHistory({
  sales,
  rotulosPagamento,
  cancelarVenda,
  cancellingSaleId,
}) {
  return (
    <section className={styles.listCard} aria-labelledby="sales-title">
      <div className={styles.historyHeader}>
        <p className={styles.eyebrow}>HISTÓRICO</p>
        <h2 id="sales-title">Vendas</h2>
      </div>

      {sales.length === 0 ? (
        <p>Nenhuma venda registrada.</p>
      ) : (
        <div className={styles.salesList}>
          {sales.map((sale) => {
            const isCancelled = sale.status === "CANCELLED";
            const canCancel =
              sale.canCancel &&
              !isCancelled &&
              (!sale.isDelivery || sale.deliveryStatus === "PENDING");
            const saleDescription = sale.lines?.length
              ? sale.lines
                .map((line) => {
                  const label =
                    line.saleMode === "PACK"
                      ? line.quantity === 1
                        ? "fardo"
                        : "fardos"
                      : line.quantity === 1
                        ? "unidade"
                        : "unidades";

                  return `${line.product.name} × ${line.quantity} ${label}`;
                })
                .join(", ")
              : Object.values(
                (sale.items || []).reduce((grouped, item) => {
                  const key = item.productId;

                  if (!grouped[key]) {
                    grouped[key] = {
                      name: item.product.name,
                      quantity: 0,
                    };
                  }

                  grouped[key].quantity += item.quantity;
                  return grouped;
                }, {}),
              )
                .map(
                  (item) =>
                    `${item.name} × ${item.quantity} ${item.quantity === 1 ? "unidade" : "unidades"
                    }`,
                )
                .join(", ");

            return (
              <article key={sale.id} className={styles.saleRow}>
                <div className={styles.saleDetails}>
                  <strong>
                    {new Date(sale.createdAt).toLocaleString("pt-BR")} ·{" "}
                    {formatCurrency(sale.total)}
                  </strong>

                  <span>
                    {saleDescription} ·{" "}
                    {rotulosPagamento[sale.paymentMethod] ||
                      "Pagamento não informado"}
                  </span>

                  {isCancelled && (
                    <span>
                      Cancelada por {sale.cancelledByUser?.name || "Administrador"} · Motivo:{" "}
                      {sale.cancellationReason || "Não informado"}
                    </span>
                  )}
                </div>

                <div className={styles.saleActions}>
                  <span
                    className={`${styles.saleStatus} ${isCancelled ? styles.saleStatusCancelled : ""
                      }`}
                  >
                    {isCancelled ? "Cancelada" : "Registrada"}
                  </span>

                  {canCancel && (
                    <details className={styles.saleCancelDetails}>
                      <summary>Cancelar venda</summary>

                      <form
                        className={styles.saleCancelForm}
                        onSubmit={(event) => cancelarVenda(event, sale)}
                      >
                        <label htmlFor={`cancel-reason-${sale.id}`}>
                          Motivo do cancelamento
                        </label>

                        <textarea
                          id={`cancel-reason-${sale.id}`}
                          name="reason"
                          minLength={5}
                          maxLength={500}
                          required
                          placeholder="Explique por que a venda será cancelada"
                        />

                        <button
                          className={styles.secondaryButton}
                          type="submit"
                          disabled={cancellingSaleId === sale.id}
                        >
                          {cancellingSaleId === sale.id
                            ? "Cancelando..."
                            : "Confirmar cancelamento"}
                        </button>
                      </form>
                    </details>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
