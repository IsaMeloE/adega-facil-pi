"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadUsers() {
      try {
        const response = await fetch("/api/auth/users", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Não foi possível carregar os usuários.");
        }

        if (isActive) {
          setUsers(result);

          if (result.length === 1) {
            setUserId(result[0].id);
          }
        }
      } catch (requestError) {
        if (isActive) setError(requestError.message);
      } finally {
        if (isActive) setIsLoadingUsers(false);
      }
    }

    loadUsers();

    return () => {
      isActive = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, pin }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível entrar.");
      }

      router.replace("/");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
      setPin("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brandMark}>AF</div>
        <p className={styles.eyebrow}>ADEGAFÁCIL</p>
        <h1 id="login-title">Acesse sua conta</h1>
        <p className={styles.description}>
          Selecione seu usuário e informe seu PIN.
        </p>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {isLoadingUsers ? (
          <p role="status">Carregando usuários...</p>
        ) : users.length === 0 ? (
          <p role="alert">Nenhum usuário ativo foi encontrado.</p>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="userId">Usuário</label>
              <select
                id="userId"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                required
                disabled={isSubmitting}
              >
                <option value="">Selecione seu usuário</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="pin">PIN de 6 dígitos</label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="current-password"
                value={pin}
                onChange={(event) =>
                  setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
                disabled={isSubmitting}
              />
            </div>

            <button
              className={styles.button}
              type="submit"
              disabled={isSubmitting || !userId || pin.length !== 6}
            >
              {isSubmitting ? "Verificando..." : "Entrar"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}