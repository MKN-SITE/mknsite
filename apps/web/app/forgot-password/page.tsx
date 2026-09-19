"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier") ?? "").trim();

    if (!identifier) {
      setError("Silakan masukkan Email, ID KPC, atau Username Anda.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ identifier })
      });
      setSubmitted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Terjadi kesalahan saat memproses permintaan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Lupa Kata Sandi"
      subtitle="Masukkan salah satu identitas akun Anda (Email, ID KPC, atau Username) untuk menerima tautan pemulihan."
      backHref="/login"
      backLabel="← Kembali ke Halaman Login"
      hideSeparation
    >
      {submitted ? (
        <div>
          <div className="alert-box alert-success" role="status">
            <strong>Permintaan Terkirim!</strong>
            <p style={{ margin: "6px 0 0" }}>
              Jika akun tersebut terdaftar di sistem kami, instruksi dan tautan untuk mengatur ulang kata sandi telah dikirim ke alamat email terkait.
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "13px" }}>
              Demi keamanan, tautan tersebut hanya berlaku selama 15 menit dan hanya dapat digunakan 1 kali.
            </p>
          </div>
          <Link href="/login" className="button button-primary" style={{ width: "100%", marginTop: "12px" }}>
            Kembali ke Halaman Login
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="identifier">Email / ID KPC / Username</label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              placeholder="nama@mknsite.online, ID KPC, atau Username"
              autoComplete="username"
              required
            />
            <span className="field-hint">
              Sistem akan secara otomatis menemukan alamat email resmi akun Anda.
            </span>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="button button-primary" type="submit" disabled={loading}>
            {loading ? "Mengirim Permintaan..." : "Kirim Tautan Reset Kata Sandi"}
          </button>

          <div className="auth-switch-prompt">
            Ingat kata sandi Anda?{" "}
            <Link href="/login" className="auth-inline-link">
              Masuk Sekarang
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
