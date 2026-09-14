"use client";

import { FormEvent, useState } from "react";
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
    try {
      await api(admin ? "/auth/admin/login" : "/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
      });
      router.replace(admin ? "/admin" : "/portal");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" placeholder="nama@mknsite.online" required /></div>
      <div className="field"><label htmlFor="password">Kata sandi</label><input id="password" name="password" type="password" autoComplete="current-password" placeholder="Masukkan kata sandi" required /></div>
      <p className="form-error" role="alert">{error}</p>
      <button className="button button-primary" type="submit" disabled={loading}>{loading ? "Memeriksa..." : admin ? "Masuk ke Admin" : "Masuk"}</button>
    </form>
  );
}
