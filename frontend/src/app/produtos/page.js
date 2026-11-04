"use client";

import { useEffect, useState } from "react";
import styles from "./produtos.module.css";

const formInicial = {
  name: "",
  category: "",
  barcode: "",
  salePrice: "",
  minimumStock: "0",
};

function getValidityStatus(lots = []) {
  const expiryDates = lots
    .filter((lot) => lot.expiresAt)
    .map((lot) => String(lot.expiresAt).slice(0, 10));

  if (expiryDates.length === 0) {
    return { label: "Sem validade", className: styles.statusMuted };
  }

  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  const limit = new Date(now);
  limit.setDate(limit.getDate() + 30);
  const thirtyDaysFromNow = [
    limit.getFullYear(),
    String(limit.getMonth() + 1).padStart(2, "0"),
    String(limit.getDate()).padStart(2, "0"),
  ].join("-");

  if (expiryDates.some((date) => date < today)) {
    return { label: "Lote vencido", className: styles.statusDanger };
  }

  if (expiryDates.some((date) => date <= thirtyDaysFromNow)) {
    return { label: "Vence em breve", className: styles.statusWarning };
  }

  return { label: "Em dia", className: styles.statusOk };
}

export default function ProdutosPage() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(formInicial);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/products", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Não foi possível carregar os produtos.");
        }

        setProducts(await response.json());
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

  function atualizarCampo(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function salvarProduto(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          salePrice: Number(form.salePrice),
          minimumStock: Number(form.minimumStock),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Não foi possível cadastrar o produto.",
        );
      }

      setForm(formInicial);
      setSuccess("Produto cadastrado com sucesso.");
      const productsResponse = await fetch("/api/products");

      if (!productsResponse.ok) {
        throw new Error("Produto cadastrado, mas não foi possível atualizar a lista.");
      }

      setProducts(await productsResponse.json());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }


  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredProducts = products.filter((product) =>
    [product.name, product.category, product.barcode].some((value) =>
      String(value || "").toLowerCase().includes(normalizedSearch),
    ),
  );


  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CATÁLOGO</p>
          <h1>Produtos</h1>
          <p className={styles.productsSubtitle}>
            Gerencie o catálogo e acompanhe os níveis de estoque.
          </p>
        </div>

        <div className={styles.userInfo}>
          <span className={styles.userAvatar}>AD</span>
          <div>
            <strong>Administrador</strong>
            <small>Administrador</small>
          </div>
        </div>

      </header>

      <section className={styles.formCard} aria-labelledby="form-title">
        <h2 id="form-title">Cadastrar produto</h2>
        <p className={styles.fefoInfo}>
          Cada produto pode ter vários lotes, com quantidades e validades controladas em
          Estoque. Na venda, o sistema prioriza os lotes válidos que vencem primeiro
          (FEFO).
        </p>

        <form className={styles.form} onSubmit={salvarProduto}>
          <div className={`${styles.field} ${styles.fieldFullWidth}`}>
            <label htmlFor="name">Nome do produto</label>
            <input
              id="name"
              name="name"
              value={form.name}
              onChange={atualizarCampo}
              required
              maxLength={120}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="category">Categoria</label>
            <input
              id="category"
              name="category"
              value={form.category}
              onChange={atualizarCampo}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="barcode">Código de barras</label>
            <input
              id="barcode"
              name="barcode"
              value={form.barcode}
              onChange={atualizarCampo}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="salePrice">Preço de venda (R$)</label>
            <input
              id="salePrice"
              name="salePrice"
              type="number"
              min="0.01"
              step="0.01"
              value={form.salePrice}
              onChange={atualizarCampo}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="minimumStock">Estoque mínimo</label>
            <input
              id="minimumStock"
              name="minimumStock"
              type="number"
              min="0"
              step="1"
              value={form.minimumStock}
              onChange={atualizarCampo}
              required
            />
          </div>

          <button
            className={`${styles.button} ${styles.formSubmit}`}
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? "Salvando..." : "Cadastrar produto"}
          </button>
        </form>

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
      </section>

      <section className={styles.listCard} aria-labelledby="list-title">
        <div className={styles.listHeader}>
          <h2 id="list-title">Produtos cadastrados</h2>

          <input
            className={styles.search}
            type="search"
            aria-label="Buscar produto"
            placeholder="Buscar produto"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        {isLoading ? (
          <p role="status">Carregando produtos...</p>
        ) : products.length === 0 ? (
          <p>Nenhum produto cadastrado.</p>
        ) : filteredProducts.length === 0 ? (
          <p>Nenhum produto encontrado.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table>
              <caption className={styles.srOnly}>
                Produtos, categorias, lotes, preços e situação do estoque
              </caption>
              <thead>
                <tr>
                  <th scope="col">Produto</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Lotes</th>
                  <th scope="col">Estoque</th>
                  <th scope="col">Preço</th>
                  <th scope="col">Código de barras</th>
                  <th scope="col">Validade</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const lots = product.lots || [];
                  const stock = lots.reduce(
                    (total, lot) => total + lot.quantity,
                    0,
                  );

                  const status = !product.isActive
                    ? { label: "Inativo", className: styles.statusMuted }
                    : stock === 0
                      ? { label: "Sem estoque", className: styles.statusDanger }
                      : stock <= product.minimumStock
                        ? { label: "Estoque baixo", className: styles.statusWarning }
                        : { label: "Ativo", className: styles.statusOk };

                  const validity = getValidityStatus(lots);

                  return (
                    <tr key={product.id}>
                      <th scope="row">{product.name}</th>
                      <td>{product.category || "—"}</td>
                      <td>{lots.length}</td>
                      <td>{stock} unidades</td>
                      <td>
                        {Number(product.salePrice).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </td>
                      <td>{product.barcode || "—"}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${validity.className}`}>
                          {validity.label}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}