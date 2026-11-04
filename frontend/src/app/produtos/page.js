"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./produtos.module.css";

const formInicial = {
  name: "",
  category: "",
  barcode: "",
  salePrice: "",
  minimumStock: "0",
};

export default function ProdutosPage() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(formInicial);
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

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>GESTÃO DE BEBIDAS</p>
          <h1>Produtos</h1>
        </div>

        <Link className={styles.backLink} href="/">
          Voltar ao painel
        </Link>
      </header>

      <section className={styles.formCard} aria-labelledby="form-title">
        <h2 id="form-title">Cadastrar produto</h2>

        <form className={styles.form} onSubmit={salvarProduto}>
          <div className={styles.field}>
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
            className={styles.button}
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
        <h2 id="list-title">Produtos cadastrados</h2>

        {isLoading ? (
          <p role="status">Carregando produtos...</p>
        ) : products.length === 0 ? (
          <p>Nenhum produto cadastrado.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table>
              <caption className={styles.srOnly}>
                Produtos, preço de venda e quantidade em estoque
              </caption>

              <thead>
                <tr>
                  <th scope="col">Produto</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Preço</th>
                  <th scope="col">Estoque</th>
                  <th scope="col">Código de barras</th>
                </tr>
              </thead>

              <tbody>
                {products.map((product) => {
                  const stock = product.lots.reduce(
                    (total, lot) => total + lot.quantity,
                    0,
                  );

                  return (
                    <tr key={product.id}>
                      <th scope="row">{product.name}</th>
                      <td>{product.category || "—"}</td>
                      <td>
                        {Number(product.salePrice).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </td>
                      <td>{stock} unidades</td>
                      <td>{product.barcode || "—"}</td>
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