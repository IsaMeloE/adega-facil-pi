"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../produtos/produtos.module.css";
import UserBadge from "../components/UserBadge";

function getErrorMessage(result, fallback) {
    return result.error || fallback;
}

export default function UsuariosPage() {
    const [users, setUsers] = useState([]);
    const [currentUserId, setCurrentUserId] = useState("");
    const [name, setName] = useState("");
    const [pin, setPin] = useState("");
    const [role, setRole] = useState("OPERATOR");
    const [resetPins, setResetPins] = useState({});
    const [resetPinErrors, setResetPinErrors] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [updatingUserId, setUpdatingUserId] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const loadData = useCallback(async (signal) => {
        try {
            const options = signal ? { signal, cache: "no-store" } : { cache: "no-store" };
            const [usersResponse, sessionResponse] = await Promise.all([
                fetch("/api/users", options),
                fetch("/api/auth/session", options),
            ]);

            const [usersData, sessionData] = await Promise.all([
                usersResponse.json(),
                sessionResponse.json(),
            ]);

            if (!usersResponse.ok) {
                throw new Error(getErrorMessage(usersData, "Não foi possível carregar os usuários."));
            }

            if (!sessionResponse.ok) {
                throw new Error("Não foi possível identificar a sessão atual.");
            }

            setUsers(usersData);
            setCurrentUserId(sessionData.user.id);
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
        const timer = window.setTimeout(() => {
            loadData(controller.signal);
        }, 0);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [loadData]);

    async function createUser(event) {
        event.preventDefault();
        setError("");
        setSuccess("");
        setIsSaving(true);

        try {
            const response = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, pin, role }),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(getErrorMessage(result, "Não foi possível cadastrar o usuário."));
            }

            setName("");
            setPin("");
            setRole("OPERATOR");
            setSuccess(`Usuário ${result.name} cadastrado.`);
            await loadData();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setIsSaving(false);
        }
    }

    function handleResetPinChange(userId, value) {
        setResetPinErrors((current) => ({ ...current, [userId]: false }));
        setResetPins((current) => ({
            ...current,
            [userId]: value.replace(/\D/g, "").slice(0, 6),
        }));
    }

    async function updateUser(user, changes) {
        setError("");
        setSuccess("");
        setUpdatingUserId(user.id);
        setResetPinErrors((current) => ({ ...current, [user.id]: false }));

        try {
            const response = await fetch(`/api/users/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(changes),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(getErrorMessage(result, "Não foi possível atualizar o usuário."));
            }

            if (Object.hasOwn(changes, "pin")) {
                setResetPins((current) => ({ ...current, [user.id]: "" }));
                setSuccess(`PIN de ${user.name} redefinido.`);

                if (user.id === currentUserId) {
                    window.location.replace("/login");
                    return;
                }
            } else {
                setSuccess(
                    result.isActive
                        ? `${result.name} foi reativado.`
                        : `${result.name} foi desativado.`,
                );
            }

            await loadData();
        } catch (requestError) {
            setError(requestError.message);
            if (
                Object.hasOwn(changes, "pin") &&
                requestError.message === "O novo PIN deve ter exatamente 6 dígitos."
            ) {
                setResetPinErrors((current) => ({ ...current, [user.id]: true }));
            }
        } finally {
            setUpdatingUserId("");
        }
    }

    return (
        <main id="main-content" tabIndex={-1} className={`${styles.container} ${styles.salesPage}`}>
            <header className={`${styles.header} ${styles.salesHeader}`}>
                <div>
                    <h1>Usuários</h1>
                    <p className={styles.salesSubtitle}>
                        Cadastre pessoas e gerencie seus acessos por PIN.
                    </p>
                </div>

                <div className={styles.userInfo}>
                    <UserBadge />
                </div>
            </header>

            {error && <p id="users-error" className={styles.error} role="alert">{error}</p>}
            {success && <p className={styles.success} role="status">{success}</p>}

            <section className={styles.formCard} aria-labelledby="new-user-title">
                <h2 id="new-user-title">Cadastrar usuário</h2>

                <form className={styles.form} onSubmit={createUser}>
                    <div className={styles.field}>
                        <label htmlFor="userName">Nome</label>
                        <input
                            id="userName"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            required
                            disabled={isSaving}
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="userRole">Perfil</label>
                        <select
                            id="userRole"
                            value={role}
                            onChange={(event) => setRole(event.target.value)}
                            disabled={isSaving}
                        >
                            <option value="OPERATOR">Operador</option>
                            <option value="ADMIN">Administrador</option>
                        </select>
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="userPin">PIN inicial (6 dígitos)</label>
                        <input
                            id="userPin"
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            value={pin}
                            onChange={(event) =>
                                setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                            }
                            required
                            disabled={isSaving}
                        />
                    </div>

                    <button
                        className={`${styles.button} ${styles.userSubmit}`}
                        type="submit"
                        disabled={isSaving || pin.length !== 6}
                    >
                        {isSaving ? "Salvando..." : "Cadastrar usuário"}
                    </button>
                </form>
            </section>

            <section className={styles.listCard} aria-labelledby="users-title">
                <h2 id="users-title">Usuários cadastrados</h2>

                {isLoading ? (
                    <p role="status">Carregando usuários...</p>
                ) : users.length === 0 ? (
                    <p>Nenhum usuário cadastrado.</p>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table>
                            <caption className={styles.srOnly}>
                                Usuários cadastrados, perfis, situações e ações disponíveis
                            </caption>
                            <thead>
                                <tr>
                                    <th scope="col">Nome</th>
                                    <th scope="col">Perfil</th>
                                    <th scope="col">Situação</th>
                                    <th scope="col">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <th scope="row">{user.name}</th>
                                        <td>
                                            {user.role === "ADMIN" ? "Administrador" : "Operador"}
                                        </td>
                                        <td>
                                            <span
                                                className={`${styles.statusBadge} ${user.isActive ? styles.statusOk : styles.statusMuted
                                                    }`}
                                            >
                                                {user.isActive ? "Ativo" : "Inativo"}
                                            </span>
                                        </td>

                                        <td>
                                            <div className={styles.userActions}>
                                                <details>
                                                    <summary>Redefinir PIN</summary>
                                                    <form
                                                        className={styles.pinResetForm}
                                                        onSubmit={(event) => {
                                                            event.preventDefault();
                                                            updateUser(user, { pin: resetPins[user.id] || "" });
                                                        }}
                                                    >
                                                        <label htmlFor={`reset-pin-${user.id}`}>
                                                            Novo PIN de {user.name}
                                                        </label>
                                                        <input
                                                            id={`reset-pin-${user.id}`}
                                                            type="password"
                                                            inputMode="numeric"
                                                            pattern="[0-9]{6}"
                                                            maxLength={6}
                                                            placeholder="Novo PIN"
                                                            value={resetPins[user.id] || ""                                                            }
                                                            onChange={(event) =>
                                                                handleResetPinChange(user.id, event.target.value)
                                                            }
                                                            aria-describedby={
                                                                resetPinErrors[user.id]
                                                                    ? "users-error"
                                                                    : undefined
                                                            }
                                                            aria-invalid={resetPinErrors[user.id] || undefined}
                                                            required
                                                        />
                                                        <button
                                                            className={styles.userActionButton}
                                                            type="submit"
                                                            disabled={
                                                                updatingUserId === user.id ||
                                                                (resetPins[user.id] || "").length !== 6
                                                            }
                                                        >
                                                            Salvar PIN
                                                        </button>
                                                    </form>
                                                </details>

                                                {user.id !== currentUserId && (
                                                    <button
                                                        className={styles.userActionButton}
                                                        type="button"
                                                        onClick={() => updateUser(user, { isActive: !user.isActive })}
                                                        disabled={updatingUserId === user.id}
                                                    >
                                                        {user.isActive ? "Desativar" : "Reativar"}
                                                    </button>
                                                )}
                                            </div>
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