"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../produtos/produtos.module.css";

const formInicial = {
  productId: "",
  lotCode: "",
  quantity: "1",
  unitCost: "",
  expiresAt: "",
};

export default function EstoquePage() {
  const [products, setProducts] = useState([]);
  const [lots, setLots] = useState([]);
  const [form, setForm] = useState(formInicial);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch("/api/products", { signal: controller.signal }),
      fetch("/api/lots", { signal: controller.signal }),
    ])
      .then(async ([productsResponse, lotsResponse]) => {
        if (!productsResponse.ok || !lotsResponse.ok) {
          throw new Error("Não foi possível carregar os dados do estoque.");
        }

        const [productsData, lotsData] = await Promise.all([
          productsResponse.json(),
          lotsResponse.json(),
        ]);

        setProducts(productsData);
        setLots(lotsData);
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

  async function salvarLote(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          unitCost: Number(form.unitCost),
          expiresAt: form.expiresAt || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível cadastrar o lote.");
      }

      const lotsResponse = await fetch("/api/lots");

      if (!lotsResponse.ok) {
        throw new Error("Lote cadastrado, mas não foi possível atualizar a lista.");
      }

      setLots(await lotsResponse.json());
      setForm(formInicial);
      setSuccess("Lote cadastrado com sucesso.");
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
          <h1>Estoque</h1>
        </div>

        <Link className={styles.backLink} href="/">
          Voltar ao painel
        </Link>
      </header>

      <section className={styles.formCard} aria-labelledby="form-title">
        <h2 id="form-title">Adicionar lote ao estoque</h2>

        <form className={styles.form} onSubmit={salvarLote}>
          <div className={styles.field}>
            <label htmlFor="productId">Produto</label>
            <select
              id="productId"
              name="productId"
              value={form.productId}
              onChange={atualizarCampo}
              required
            >
              <option value="">Selecione um produto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="lotCode">Código do lote</label>
            <input
              id="lotCode"
              name="lotCode"
              value={form.lotCode}
              onChange={atualizarCampo}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="quantity">Quantidade recebida</label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              step="1"
              value={form.quantity}
              onChange={atualizarCampo}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="unitCost">Custo por unidade (R$)</label>
            <input
              id="unitCost"
              name="unitCost"
              type="number"
              min="0"
              step="0.01"
              value={form.unitCost}
              onChange={atualizarCampo}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="expiresAt">Data de validade</label>
            <input
              id="expiresAt"
              name="expiresAt"
              type="date"
              value={form.expiresAt}
              onChange={atualizarCampo}
            />
          </div>

          <button className={styles.button} type="submit" disabled={isSaving}>
            {isSaving ? "Salvando..." : "Adicionar lote"}
          </button>
        </form>

        {error && <p className={styles.error} role="alert">{error}</p>}
        {success && <p className={styles.success} role="status">{success}</p>}
      </section>

      <section className={styles.listCard} aria-labelledby="list-title">
        <h2 id="list-title">Lotes cadastrados</h2>

        {isLoading ? (
          <p role="status">Carregando estoque...</p>
        ) : lots.length === 0 ? (
          <p>Nenhum lote cadastrado.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table>
              <caption className={styles.srOnly}>
                Lotes, produtos, quantidades, custos e validades
              </caption>
              <thead>
                <tr>
                  <th scope="col">Produto</th>
                  <th scope="col">Lote</th>
                  <th scope="col">Quantidade</th>
                  <th scope="col">Custo unitário</th>
                  <th scope="col">Validade</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => (
                  <tr key={lot.id}>
                    <th scope="row">{lot.product.name}</th>
                    <td>{lot.lotCode || "—"}</td>
                    <td>{lot.quantity}</td>
                    <td>
                      {Number(lot.unitCost).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td>
                      {lot.expiresAt
                        ? lot.expiresAt.slice(0, 10).split("-").reverse().join("/")
                        : "Sem validade"}
                    </td>
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