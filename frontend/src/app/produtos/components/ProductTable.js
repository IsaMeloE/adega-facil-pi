import styles from "../produtos.module.css";

export default function ProductTable({ filteredProducts, getValidityStatus }) {
  return (
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
            <th scope="col">Fardo</th>
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

                <td>
                  {product.unitsPerPack && product.packSalePrice != null
                    ? `${product.unitsPerPack} un. · ${Number(
                      product.packSalePrice,
                    ).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}`
                    : "—"}
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
  );
}
