"use client";

import { useAuthUser } from "./AppShell";
import styles from "../produtos/produtos.module.css";

export default function UserBadge() {
  const user = useAuthUser();

  if (!user) return null;

  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const roleLabel =
    user.role === "ADMIN" ? "Administrador" : "Operador";

  return (
    <div className={styles.userInfo}>
      <span className={styles.userAvatar}>{initials}</span>
      <div>
        <strong>{user.name}</strong>
        <small>{roleLabel}</small>
      </div>
    </div>
  );
}
