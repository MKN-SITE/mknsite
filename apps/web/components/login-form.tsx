"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function LoginForm({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const rawIdentifier = String(form.get("identifier") ?? form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      if (admin) {
        await api("/auth/admin/login", {
          method: "POST",
          body: JSON.stringify({ email: rawIdentifier, password })
        });
        router.replace("/admin");
      } else {
        await api("/auth/login", {
          method: "POST",
          body: JSON.stringify({ identifier: rawIdentifier, password })
        });
        router.replace("/portal");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="identifier">{admin ? "Email Administrator" : "Email / ID KPC / Username"}</label>
        <input
          id="identifier"
          name="identifier"
          type={admin ? "email" : "text"}
          autoComplete="username"
          placeholder={admin ? "nama@mknsite.online" : "Email, ID KPC, atau Username"}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="password">Kata sandi</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Masukkan kata sandi"
          required
        />
      </div>

      {!admin && (
        <div className="field-meta">
          <Link href="/forgot-password" className="auth-inline-link">
            Lupa kata sandi?
          </Link>
        </div>
      )}

      <p className="form-error" role="alert">{error}</p>

      <button className="button button-primary" type="submit" disabled={loading}>
        {loading ? "Memeriksa..." : admin ? "Masuk ke Admin" : "Masuk"}
      </button>

      {!admin && (
        <div className="auth-switch-prompt">
          Belum memiliki akun karyawan?{" "}
          <Link href="/register" className="auth-inline-link">
            Daftar Akun Baru
          </Link>
        </div>
      )}
    </form>
  );
}
