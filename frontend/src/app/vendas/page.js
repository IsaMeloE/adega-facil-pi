"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../produtos/produtos.module.css";

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const rotulosPagamento = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  CARTAO_DEBITO: "Cartão de débito",
  CARTAO_CREDITO: "Cartão de crédito",
};

export default function VendasPage() {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [cart, setCart] = useState([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch("/api/products", { signal: controller.signal }),
      fetch("/api/sales", { signal: controller.signal }),
    ])
      .then(async ([productsResponse, salesResponse]) => {
        if (!productsResponse.ok || !salesResponse.ok) {
          throw new Error("Não foi possível carregar os dados da tela.");
        }

        const [productsData, salesData] = await Promise.all([
          productsResponse.json(),
          salesResponse.json(),
        ]);

        setProducts(productsData);
        setSales(salesData);
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

    const availableStock = (product.lots || []).reduce(
      (total, lot) => total + lot.quantity,
      0,
    );
    const quantityInCart =
      cart.find((item) => item.productId === productId)?.quantity || 0;

    if (quantityInCart + amount > availableStock) {
      setError(`Estoque insuficiente para ${product.name}.`);
      return;
    }

    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (item) => item.productId === productId,
      );

      if (existingItem) {
        return currentCart.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + amount }
            : item,
        );
      }

      return [...currentCart, { productId, quantity: amount }];
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
    setIsSaving(true);

    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: cart, paymentMethod }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível registrar a venda.");
      }

      setCart([]);
      setSuccess("Venda registrada com sucesso.");
      await atualizarDados();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  const cartTotal = cart.reduce((total, item) => {
    const product = products.find((current) => current.id === item.productId);
    return total + Number(product?.salePrice || 0) * item.quantity;
  }, 0);

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>GESTÃO DE BEBIDAS</p>
          <h1>Vendas</h1>
        </div>

        <Link className={styles.backLink} href="/">
          Voltar ao painel
        </Link>
      </header>

      <section className={styles.formCard} aria-labelledby="item-title">
        <h2 id="item-title">Adicionar produto à venda</h2>

        {isLoading ? (
          <p role="status">Carregando produtos...</p>
        ) : (
          <form className={styles.form} onSubmit={adicionarAoCarrinho}>
            <div className={styles.field}>
              <label htmlFor="productId">Produto</label>
              <select
                id="productId"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                required
              >
                <option value="">Selecione um produto</option>
                {products
                  .filter((product) => product.isActive)
                  .map((product) => {
                    const stock = (product.lots || []).reduce(
                      (total, lot) => total + lot.quantity,
                      0,
                    );

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
      </section>

      <section className={styles.listCard} aria-labelledby="cart-title">
        <h2 id="cart-title">Itens da venda</h2>

        {cart.length === 0 ? (
          <p>Nenhum produto adicionado.</p>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              <table>
                <caption className={styles.srOnly}>
                  Produtos, quantidades e valores desta venda
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Produto</th>
                    <th scope="col">Quantidade</th>
                    <th scope="col">Preço unitário</th>
                    <th scope="col">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => {
                    const product = products.find(
                      (current) => current.id === item.productId,
                    );
                    const unitPrice = Number(product?.salePrice || 0);

                    return (
                      <tr key={item.productId}>
                        <th scope="row">{product?.name}</th>
                        <td>{item.quantity}</td>
                        <td>{formatarMoeda(unitPrice)}</td>
                        <td>{formatarMoeda(unitPrice * item.quantity)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p>
              <strong>Total: {formatarMoeda(cartTotal)}</strong>
            </p>

            <div className={styles.field}>

  <label htmlFor="paymentMethod">Método de pagamento</label>
  <select
    id="paymentMethod"
    value={paymentMethod}
    onChange={(event) => setPaymentMethod(event.target.value)}
    disabled={isSaving}
  >
    <option value="">Selecione uma opção</option>
    <option value="PIX">Pix</option>
    <option value="DINHEIRO">Dinheiro</option>
    <option value="CARTAO_DEBITO">Cartão de débito</option>
    <option value="CARTAO_CREDITO">Cartão de crédito</option>
  </select>
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
            >
              Limpar venda
            </button>
          </>
        )}
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

      <section className={styles.listCard} aria-labelledby="sales-title">
        <h2 id="sales-title">Vendas recentes</h2>

        {sales.length === 0 ? (
          <p>Nenhuma venda registrada.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table>
              <caption className={styles.srOnly}>
                Vendas recentes, datas, itens e totais
              </caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Itens</th>
                  <th scope="col">Pagamento</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{new Date(sale.createdAt).toLocaleString("pt-BR")}</td>
                    <td>
                      {sale.items
                        .map(
                          (item) =>
                            `${item.product.name} × ${item.quantity}`,
                        )
                        .join(", ")}
                    </td>
                    <td>{rotulosPagamento[sale.paymentMethod] || "Não informado"}</td>
                    <td>{formatarMoeda(sale.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}