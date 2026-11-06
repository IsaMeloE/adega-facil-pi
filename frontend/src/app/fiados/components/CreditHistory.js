import styles from "../../produtos/produtos.module.css";
import { formatCurrency } from "@/lib/formatters";

export default function CreditHistory({
    accounts,
    formatDate,
    paymentLabels,
}) {
    return (
        <>
            {accounts.map((account) => (
                <section
                    className={styles.listCard}
                    key={`history-${account.id}`}
                    aria-label={`Movimentações de ${account.name}`}
                >
                    <details>
                        <summary>
                            Histórico de {account.name} ({account.movements.length})
                        </summary>

                        <div className={styles.tableWrapper}>
                            <table>
                                <caption className={styles.srOnly}>
                                    Movimentações de crédito de {account.name}
                                </caption>
                                <thead>
                                    <tr>
                                        <th scope="col">Data</th>
                                        <th scope="col">Movimentação</th>
                                        <th scope="col">Detalhe</th>
                                        <th scope="col">Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {account.movements.map((movement) => {
                                        const isCharge = movement.type === "CHARGE";
                                        const isReversal = movement.type === "REVERSAL";

                                        const saleProducts = (movement.sale?.items || [])
                                            .map((item) => `${item.product.name} × ${item.quantity}`)
                                            .join(", ");

                                        return (
                                            <tr key={movement.id}>
                                                <td>{formatDate(movement.createdAt)}</td>
                                                <td>
                                                    {isCharge ? "Fiado" : isReversal ? "Estorno de venda" : "Pagamento"}
                                                </td>
                                                <td>
                                                    {isCharge
                                                        ? saleProducts || "Venda"
                                                        : isReversal
                                                            ? movement.notes || "Venda cancelada"
                                                            : paymentLabels[movement.paymentMethod] ||
                                                            movement.paymentMethod ||
                                                            "Recebimento"}
                                                    {movement.notes && isCharge ? ` · ${movement.notes}` : ""}
                                                </td>
                                                <td>
                                                    {isCharge ? "+" : "−"}
                                                    {formatCurrency(movement.amount)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </details>
                </section>
            ))}
        </>
    );
}
