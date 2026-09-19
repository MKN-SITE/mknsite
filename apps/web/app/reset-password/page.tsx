"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { api } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div>
        <div className="alert-box alert-error" role="alert">
          <strong>Tautan Tidak Lengkap</strong>
          <p style={{ margin: "6px 0 0" }}>
            Token pemulihan kata sandi tidak ditemukan pada tautan ini.
          </p>
        </div>
        <Link href="/forgot-password" className="button button-primary" style={{ width: "100%" }}>
          Minta Tautan Pemulihan Baru
        </Link>
      </div>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password.length < 12) {
      setError("Kata sandi baru minimal harus 12 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password, confirmPassword })
      });
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal mengatur ulang kata sandi. Token mungkin sudah kedaluwarsa atau pernah digunakan.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div>
        <div className="alert-box alert-success" role="status">
          <strong>Kata Sandi Berhasil Diperbarui!</strong>
          <p style={{ margin: "6px 0 0" }}>
            Kata sandi baru Anda telah aktif dan seluruh sesi aktif di perangkat lain telah dicabut demi keamanan.
          </p>
        </div>
        <Link href="/login" className="button button-primary" style={{ width: "100%", marginTop: "12px" }}>
          Masuk dengan Kata Sandi Baru
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="password">Kata Sandi Baru</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Minimal 12 karakter"
          required
        />
        <span className="field-hint">Gunakan kombinasi huruf besar, kecil, angka, dan simbol.</span>
      </div>

      <div className="field">
        <label htmlFor="confirmPassword">Konfirmasi Kata Sandi Baru</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Ketik ulang kata sandi baru"
          required
        />
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button className="button button-primary" type="submit" disabled={loading}>
        {loading ? "Memperbarui Kata Sandi..." : "Simpan Kata Sandi Baru"}
      </button>

      <div className="auth-switch-prompt">
        Kembali ke{" "}
        <Link href="/login" className="auth-inline-link">
          Halaman Login
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Atur Ulang Kata Sandi"
      subtitle="Buat kata sandi baru yang kuat dan aman untuk akun MKN Anda."
      backHref="/login"
      backLabel="← Kembali ke Halaman Login"
      hideSeparation
    >
      <Suspense fallback={<div className="loading-block short" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
