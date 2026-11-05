"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../produtos/produtos.module.css";
import UserBadge from "../components/UserBadge";

const paymentLabels = {
    PIX: "Pix",
    DINHEIRO: "Dinheiro",
    CARTAO_DEBITO: "Cartão de débito",
    CARTAO_CREDITO: "Cartão de crédito",
};

function formatCurrency(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function formatDate(value) {
    if (!value) return "Data não informada";

    return new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function FiadosPage() {
    const [accounts, setAccounts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [totalOpenBalance, setTotalOpenBalance] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [isSavingCustomer, setIsSavingCustomer] = useState(false);

    const [paymentCustomerId, setPaymentCustomerId] = useState("");
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("");
    const [paymentNotes, setPaymentNotes] = useState("");
    const [isSavingPayment, setIsSavingPayment] = useState(false);

    const loadData = useCallback(async (signal) => {
        try {
            const options = signal ? { signal } : undefined;

            const [creditsResponse, customersResponse] = await Promise.all([
                fetch("/api/credits", options),
                fetch("/api/customers", options),
            ]);

            if (!creditsResponse.ok || !customersResponse.ok) {
                throw new Error("Não foi possível carregar os dados dos fiados.");
            }

            const [creditsData, customersData] = await Promise.all([
                creditsResponse.json(),
                customersResponse.json(),
            ]);

            setAccounts(creditsData.accounts);
            setTotalOpenBalance(creditsData.totalOpenBalance);
            setCustomers(customersData);
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

        const loadTimer = window.setTimeout(() => {
            loadData(controller.signal);
        }, 0);

        const shouldOpenCustomerForm =
            new URLSearchParams(window.location.search).get("novoCliente") === "1";

        const formTimer = shouldOpenCustomerForm
            ? window.setTimeout(() => {
                setIsCustomerFormOpen(true);
            }, 0)
            : null;

        return () => {
            controller.abort();
            window.clearTimeout(loadTimer);

            if (formTimer !== null) {
                window.clearTimeout(formTimer);
            }
        };
    }, [loadData]);

    async function registerCustomer(event) {
        event.preventDefault();
        setError("");
        setSuccess("");
        setIsSavingCustomer(true);

        try {
            const response = await fetch("/api/customers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: customerName,
                    phone: customerPhone,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Não foi possível cadastrar o cliente.");
            }

            setCustomerName("");
            setCustomerPhone("");
            setIsCustomerFormOpen(false);
            setSuccess("Cliente cadastrado. Volte à venda para selecioná-lo.");
            await loadData();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setIsSavingCustomer(false);
        }
    }

    async function registerPayment(event) {
        event.preventDefault();
        setError("");
        setSuccess("");
        setIsSavingPayment(true);

        try {
            const response = await fetch("/api/credits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerId: paymentCustomerId,
                    amount: Number(paymentAmount),
                    paymentMethod,
                    notes: paymentNotes,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Não foi possível registrar o pagamento.");
            }

            setPaymentCustomerId("");
            setPaymentAmount("");
            setPaymentMethod("");
            setPaymentNotes("");
            setSuccess("Pagamento registrado.");
            await loadData();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setIsSavingPayment(false);
        }
    }

    const selectedAccount = accounts.find(
        (account) => account.id === paymentCustomerId,
    );

    return (
        <main className={styles.container}>
            <header className={styles.header}>
                <div>
                    <p className={styles.eyebrow}>RECEBIMENTOS</p>
                    <h1>Fiados</h1>
                    <p>Acompanhe os saldos e pagamentos dos clientes.</p>
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

            {success && (
                <p className={styles.success} role="status">
                    {success}
                </p>
            )}

            <section className={styles.formCard} aria-label="Resumo dos fiados">
                <p className={styles.eyebrow}>SALDO EM ABERTO</p>
                <h2>{formatCurrency(totalOpenBalance)}</h2>
            </section>

            <section className={styles.formCard} aria-labelledby="customer-form-title">
                <div className={styles.listHeader}>
                    <h2 id="customer-form-title">Clientes</h2>
                    <button
                        className={styles.button}
                        type="button"
                        onClick={() => setIsCustomerFormOpen((isOpen) => !isOpen)}
                    >
                        {isCustomerFormOpen ? "Fechar cadastro" : "Adicionar cliente"}
                    </button>
                </div>

                {isCustomerFormOpen && (
                    <form className={styles.form} onSubmit={registerCustomer}>
                        <div className={styles.field}>
                            <label htmlFor="customerName">Nome do cliente</label>
                            <input
                                id="customerName"
                                value={customerName}
                                onChange={(event) => setCustomerName(event.target.value)}
                                required
                                disabled={isSavingCustomer}
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="customerPhone">Telefone (opcional)</label>
                            <input
                                id="customerPhone"
                                type="tel"
                                value={customerPhone}
                                onChange={(event) => setCustomerPhone(event.target.value)}
                                disabled={isSavingCustomer}
                            />
                        </div>

                        <button
                            className={styles.button}
                            type="submit"
                            disabled={isSavingCustomer}
                        >
                            {isSavingCustomer ? "Salvando..." : "Salvar cliente"}
                        </button>
                    </form>
                )}

                {customers.length === 0 && !isLoading && (
                    <p>Nenhum cliente cadastrado.</p>
                )}
            </section>

            {selectedAccount && (
                <section className={styles.formCard} aria-labelledby="payment-title">
                    <h2 id="payment-title">
                        Receber pagamento de {selectedAccount.name}
                    </h2>
                    <p>Saldo em aberto: {formatCurrency(selectedAccount.balance)}</p>

                    <form className={styles.form} onSubmit={registerPayment}>
                        <div className={styles.field}>
                            <label htmlFor="paymentAmount">Valor recebido (R$)</label>
                            <input
                                id="paymentAmount"
                                type="number"
                                min="0.01"
                                max={selectedAccount.balance}
                                step="0.01"
                                value={paymentAmount}
                                onChange={(event) => setPaymentAmount(event.target.value)}
                                required
                                disabled={isSavingPayment}
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="paymentMethod">Forma de recebimento</label>
                            <select
                                id="paymentMethod"
                                value={paymentMethod}
                                onChange={(event) => setPaymentMethod(event.target.value)}
                                required
                                disabled={isSavingPayment}
                            >
                                <option value="">Selecione uma forma</option>
                                {Object.entries(paymentLabels).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="paymentNotes">Observação (opcional)</label>
                            <input
                                id="paymentNotes"
                                value={paymentNotes}
                                onChange={(event) => setPaymentNotes(event.target.value)}
                                disabled={isSavingPayment}
                            />
                        </div>

                        <button
                            className={styles.button}
                            type="submit"
                            disabled={isSavingPayment}
                        >
                            {isSavingPayment ? "Registrando..." : "Registrar recebimento"}
                        </button>

                        <button
                            className={styles.secondaryButton}
                            type="button"
                            onClick={() => setPaymentCustomerId("")}
                            disabled={isSavingPayment}
                        >
                            Cancelar
                        </button>
                    </form>
                </section>
            )}

            <section className={styles.listCard} aria-labelledby="accounts-title">
                <h2 id="accounts-title">Contas de clientes</h2>

                {isLoading ? (
                    <p role="status">Carregando fiados...</p>
                ) : accounts.length === 0 ? (
                    <p>Nenhum fiado registrado.</p>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table>
                            <caption className={styles.srOnly}>
                                Contas de clientes, saldos e movimentações
                            </caption>
                            <thead>
                                <tr>
                                    <th scope="col">Cliente</th>
                                    <th scope="col">Saldo</th>
                                    <th scope="col">Situação</th>
                                    <th scope="col">Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accounts.map((account) => {
                                    const isOpen = Number(account.balance) > 0;
                                    const hasCreditHistory = account.movements.some(
                                        (movement) => movement.type === "CHARGE",
                                    );

                                    const statusLabel = isOpen
                                        ? "Em aberto"
                                        : hasCreditHistory
                                            ? "Quitado"
                                            : "Sem fiado";

                                    const statusClass = isOpen
                                        ? styles.statusWarning
                                        : hasCreditHistory
                                            ? styles.statusOk
                                            : styles.statusMuted;

                                    return (
                                        <tr key={account.id}>
                                            <th scope="row">
                                                {account.name}
                                                {account.phone && (
                                                    <>
                                                        <br />
                                                        <small>{account.phone}</small>
                                                    </>
                                                )}
                                            </th>
                                            <td>{formatCurrency(account.balance)}</td>
                                            <td>
                                                <span className={`${styles.statusBadge} ${statusClass}`}>
                                                    {statusLabel}
                                                </span>
                                            </td>
                                            <td>
                                                {isOpen ? (
                                                    <button
                                                        className={styles.secondaryButton}
                                                        type="button"
                                                        onClick={() => {
                                                            setPaymentCustomerId(account.id);
                                                            setPaymentAmount("");
                                                            setPaymentMethod("");
                                                            setPaymentNotes("");
                                                        }}
                                                    >
                                                        Receber
                                                    </button>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

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
                                        const saleProducts = (movement.sale?.items || [])
                                            .map(
                                                (item) =>
                                                    `${item.product.name} × ${item.quantity}`,
                                            )
                                            .join(", ");

                                        return (
                                            <tr key={movement.id}>
                                                <td>{formatDate(movement.createdAt)}</td>
                                                <td>{isCharge ? "Fiado" : "Pagamento"}</td>
                                                <td>
                                                    {isCharge
                                                        ? saleProducts || "Venda"
                                                        : paymentLabels[movement.paymentMethod] ||
                                                        movement.paymentMethod ||
                                                        "Recebimento"}
                                                    {movement.notes ? ` · ${movement.notes}` : ""}
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
        </main>
    );
}