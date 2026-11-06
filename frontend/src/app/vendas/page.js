"use client";

import { useEffect, useState } from "react";
import styles from "../produtos/produtos.module.css";
import UserBadge from "../components/UserBadge";

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const rotulosPagamento = {
  FIADO: "Fiado",
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  CARTAO_DEBITO: "Cartão de débito",
  CARTAO_CREDITO: "Cartão de crédito",
};

function loteDentroDaValidade(lot) {
  if (!lot.expiresAt) return true;

  const hoje = new Date();
  const dataHoje = [
    hoje.getFullYear(),
    String(hoje.getMonth() + 1).padStart(2, "0"),
    String(hoje.getDate()).padStart(2, "0"),
  ].join("-");

  return lot.expiresAt.slice(0, 10) >= dataHoje;
}

export default function VendasPage() {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [cart, setCart] = useState([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saleMode, setSaleMode] = useState("UNIT");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDelivery, setIsDelivery] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [cancellingSaleId, setCancellingSaleId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch("/api/products", { signal: controller.signal }),
      fetch("/api/sales", { signal: controller.signal }),
      fetch("/api/customers", { signal: controller.signal }),
    ])
      .then(async ([productsResponse, salesResponse, customersResponse]) => {
        if (
          !productsResponse.ok ||
          !salesResponse.ok ||
          !customersResponse.ok
        ) {
          throw new Error("Não foi possível carregar os dados da tela.");
        }

        const [productsData, salesData, customersData] = await Promise.all([
          productsResponse.json(),
          salesResponse.json(),
          customersResponse.json(),
        ]);

        setProducts(productsData);
        setSales(salesData);
        setCustomers(customersData);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    async function refreshCustomers() {
      try {
        const response = await fetch("/api/customers");

        if (response.ok) {
          setCustomers(await response.json());
        }
      } catch (requestError) {
        console.error("Não foi possível atualizar os clientes:", requestError);
      }
    }

    window.addEventListener("focus", refreshCustomers);

    return () => {
      window.removeEventListener("focus", refreshCustomers);
    };
  }, []);

  function adicionarAoCarrinho(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const product = products.find((item) => item.id === productId);
    const amount = Number(quantity);

    if (!product || !Number.isInteger(amount) || amount < 1) {
      setError("Selecione um produto e informe uma quantidade válida.");
      return;
    }

    if (
      saleMode === "PACK" &&
      (!Number.isInteger(product.unitsPerPack) ||
        product.unitsPerPack < 2 ||
        product.packSalePrice == null)
    ) {
      setError("Esse produto não tem fardo configurado.");
      return;
    }

    const unitsPerSale = saleMode === "PACK" ? product.unitsPerPack : 1;

    const availableStock = (product.lots || [])
      .filter(loteDentroDaValidade)
      .reduce((total, lot) => total + lot.quantity, 0);

    const quantityInCart = cart
      .filter((item) => item.productId === productId)
      .reduce((total, item) => {
        const currentUnitsPerSale =
          item.saleMode === "PACK" ? product.unitsPerPack : 1;

        return total + item.quantity * currentUnitsPerSale;
      }, 0);

    if (quantityInCart + amount * unitsPerSale > availableStock) {
      setError(`Estoque insuficiente para ${product.name}.`);
      return;
    }

    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (item) =>
          item.productId === productId && item.saleMode === saleMode,
      );

      if (existingItem) {
        return currentCart.map((item) =>
          item.productId === productId && item.saleMode === saleMode
            ? { ...item, quantity: item.quantity + amount }
            : item,
        );
      }

      return [...currentCart, { productId, saleMode, quantity: amount }];
    });

    setProductId("");
    setQuantity("1");
  }

  async function atualizarDados() {
    const [productsResponse, salesResponse] = await Promise.all([
      fetch("/api/products"),
      fetch("/api/sales"),
    ]);

    if (!productsResponse.ok || !salesResponse.ok) {
      throw new Error("Venda registrada, mas não foi possível atualizar a tela.");
    }

    const [productsData, salesData] = await Promise.all([
      productsResponse.json(),
      salesResponse.json(),
    ]);

    setProducts(productsData);
    setSales(salesData);
  }

  async function finalizarVenda() {
    setError("");
    setSuccess("");
    if (!paymentMethod) {
      setError("Selecione o método de pagamento.");
      return;
    }

    if (paymentMethod === "FIADO" && !customerId) {
      setError("Selecione um cliente para registrar a venda fiada.");
      return;
    }

    if (isDelivery && !deliveryAddress.trim()) {
      setError("Informe o endereço da entrega.");
      return;
    }

    if (
      isDelivery &&
      (!Number.isFinite(Number(deliveryFee)) || Number(deliveryFee) < 0)
    ) {
      setError("Informe uma taxa de entrega válida.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cart,
          customerId: paymentMethod === "FIADO" ? customerId : null,
          paymentMethod,
          delivery: {
            isDelivery,
            fee: isDelivery ? Number(deliveryFee || 0) : 0,
            address: isDelivery ? deliveryAddress.trim() : "",
            notes: isDelivery ? deliveryNotes.trim() : "",
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível registrar a venda.");
      }

      setCart([]);
      setCustomerId("");
      setPaymentMethod("");
      setIsDelivery(false);
      setDeliveryFee("0");
      setDeliveryAddress("");
      setDeliveryNotes("");
      setSuccess("Venda registrada com sucesso.");
      await atualizarDados();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function cancelarVenda(event, sale) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const formData = new FormData(event.currentTarget);
    const reason = String(formData.get("reason") || "").trim();

    setCancellingSaleId(sale.id);

    try {
      const response = await fetch(`/api/sales/${sale.id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível cancelar a venda.");
      }

      setSuccess("Venda cancelada. O estoque e o fiado foram atualizados.");
      await atualizarDados();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCancellingSaleId("");
    }
  }

  const cartSubtotalCents = cart.reduce((total, item) => {
    const product = products.find(
      (current) => current.id === item.productId,
    );

    const price =
      item.saleMode === "PACK"
        ? product?.packSalePrice
        : product?.salePrice;

    const unitPriceCents = Math.round(Number(price || 0) * 100);

    return total + unitPriceCents * item.quantity;
  }, 0);

  const deliveryFeeCents = isDelivery
    ? Math.round(Number(deliveryFee || 0) * 100)
    : 0;

  const cartTotal = (cartSubtotalCents + deliveryFeeCents) / 100;

  return (
    <main className={`${styles.container} ${styles.salesPage}`}>
      <header className={`${styles.header} ${styles.salesHeader}`}>
        <div>
          <h1>Vendas</h1>
          <p className={styles.salesSubtitle}>
            Registre vendas e acompanhe o histórico.
          </p>
        </div>

        <div className={styles.userInfo}>
          <UserBadge />
        </div>
      </header>

      <div className={styles.salesLayout}>
        <div className={styles.checkoutColumn}>

          <section
            className={`${styles.formCard} ${styles.checkoutPanel}`}
            aria-labelledby="item-title"
          >
            <h2 id="item-title">Nova venda</h2>

            {isLoading ? (
              <p role="status">Carregando produtos...</p>
            ) : (
              <form className={styles.form} onSubmit={adicionarAoCarrinho}>
                <div className={styles.field}>
                  <label htmlFor="productId">Produto</label>
                  <select
                    id="productId"
                    value={productId}
                    onChange={(event) => {
                      const nextProductId = event.target.value;
                      const nextProduct = products.find((item) => item.id === nextProductId);

                      setProductId(nextProductId);

                      if (
                        !Number.isInteger(nextProduct?.unitsPerPack) ||
                        nextProduct.unitsPerPack < 2 ||
                        nextProduct.packSalePrice == null
                      ) {
                        setSaleMode("UNIT");
                      }
                    }}
                    required
                  >
                    <option value="">Selecione um produto</option>

                    {products
                      .filter((product) => product.isActive)
                      .map((product) => {
                        const stock = (product.lots || [])
                          .filter(loteDentroDaValidade)
                          .reduce((total, lot) => total + lot.quantity, 0);

                        return (
                          <option
                            key={product.id}
                            value={product.id}
                            disabled={stock === 0}
                          >
                            {product.name} — {stock} em estoque
                          </option>
                        );
                      })}
                  </select>
                </div>

                <div className={styles.field}>
                  <label htmlFor="saleMode">Modalidade</label>
                  <select
                    id="saleMode"
                    value={saleMode}
                    onChange={(event) => setSaleMode(event.target.value)}
                    disabled={isSaving}
                  >
                    <option value="UNIT">Unidade</option>
                    <option
                      value="PACK"
                      disabled={
                        !products.find((item) => item.id === productId)?.unitsPerPack ||
                        products.find((item) => item.id === productId)?.packSalePrice == null
                      }
                    >
                      Fardo
                    </option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label htmlFor="quantity">Quantidade</label>
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    required
                  />
                </div>

                <button className={styles.button} type="submit">
                  Adicionar ao carrinho
                </button>
              </form>
            )}

            <section className={styles.cartSection} aria-labelledby="cart-title">
              <h2 id="cart-title">Itens da venda</h2>
              {cart.length === 0 ? (
                <p>Nenhum produto adicionado.</p>
              ) : (
                <>

                  <div className={styles.cartItems}>
                    {cart.map((item) => {
                      const product = products.find(
                        (current) => current.id === item.productId,
                      );

                      const isPack = item.saleMode === "PACK";
                      const unitPrice = isPack
                        ? Number(product?.packSalePrice || 0)
                        : Number(product?.salePrice || 0);

                      const quantityLabel = isPack
                        ? item.quantity === 1
                          ? "fardo"
                          : "fardos"
                        : item.quantity === 1
                          ? "unidade"
                          : "unidades";

                      return (
                        <article key={sale.id} className={styles.saleRow}>
                          <div className={styles.saleDetails}>
                            <strong>
                              {new Date(sale.createdAt).toLocaleString("pt-BR")} ·{" "}
                              {formatarMoeda(sale.total)}
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

                  <div className={`${styles.field} ${styles.paymentField}`}>

                    <label htmlFor="paymentMethod">Método de pagamento</label>
                    <select
                      id="paymentMethod"
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                      disabled={isSaving}
                    >
                      <option value="">Selecione uma opção</option>
                      <option value="FIADO">Fiado</option>
                      <option value="PIX">Pix</option>
                      <option value="DINHEIRO">Dinheiro</option>
                      <option value="CARTAO_DEBITO">Cartão de débito</option>
                      <option value="CARTAO_CREDITO">Cartão de crédito</option>
                    </select>
                  </div>

                  {paymentMethod === "FIADO" && (
                    <div className={styles.field}>
                      <label htmlFor="customerId">Cliente</label>
                      <select
                        id="customerId"
                        value={customerId}
                        onChange={(event) => {
                          const selectedCustomerId = event.target.value;

                          if (selectedCustomerId === "__add_customer__") {
                            window.open(
                              "/fiados?novoCliente=1",
                              "_blank",
                              "noopener,noreferrer",
                            );
                            return;
                          }

                          setCustomerId(selectedCustomerId);
                        }}
                        required
                        disabled={isSaving}
                      >
                        <option value="">Selecione um cliente</option>

                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name}
                          </option>
                        ))}

                        <option value="__add_customer__">+ Adicionar cliente</option>
                      </select>
                    </div>
                  )}

                  <label className={styles.deliveryCheckbox}>
                    <input
                      type="checkbox"
                      checked={isDelivery}
                      onChange={(event) => setIsDelivery(event.target.checked)}
                      disabled={isSaving}
                    />
                    <span>Esta venda terá entrega</span>
                  </label>

                  {isDelivery && (
                    <div className={styles.deliveryFields}>
                      <div className={styles.deliveryGrid}>
                        <div className={styles.field}>
                          <label htmlFor="deliveryFee">Taxa de entrega (R$)</label>
                          <input
                            id="deliveryFee"
                            type="number"
                            min="0"
                            step="0.01"
                            value={deliveryFee}
                            onChange={(event) => setDeliveryFee(event.target.value)}
                            disabled={isSaving}
                          />
                        </div>

                        <div className={styles.field}>
                          <label htmlFor="deliveryAddress">Endereço e referência</label>
                          <input
                            id="deliveryAddress"
                            type="text"
                            value={deliveryAddress}
                            onChange={(event) => setDeliveryAddress(event.target.value)}
                            placeholder="Rua, número e referência"
                            maxLength={255}
                            required
                            disabled={isSaving}
                          />
                        </div>
                      </div>

                      <div className={styles.field}>
                        <label htmlFor="deliveryNotes">Observação</label>
                        <textarea
                          id="deliveryNotes"
                          value={deliveryNotes}
                          onChange={(event) => setDeliveryNotes(event.target.value)}
                          placeholder="Instruções para a entrega (opcional)"
                          maxLength={500}
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                  )}

                  <div className={styles.checkoutSummary}>
                    <span>Total da venda</span>
                    <strong>{formatarMoeda(cartTotal)}</strong>
                    <small>{cart.length} item(ns) no carrinho</small>
                  </div>

                  <button
                    className={styles.button}
                    type="button"
                    onClick={finalizarVenda}
                    disabled={isSaving}
                  >
                    {isSaving ? "Registrando venda..." : "Finalizar venda"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCart([])}
                    disabled={isSaving}
                    className={styles.secondaryButton}
                  >
                    Limpar venda
                  </button>
                </>
              )}
            </section>
          </section>

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

        </div>

        <section
          className={`${styles.listCard} ${styles.salesHistory}`}
          aria-labelledby="sales-title"
        >

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
                          {formatarMoeda(sale.total)}
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
        </section>
      </div>
    </main>
  );
}