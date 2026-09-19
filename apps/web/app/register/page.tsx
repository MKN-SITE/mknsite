"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const today = new Date().toISOString().split("T")[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);

    const kpcId = String(form.get("kpcId") ?? "").trim();
    const name = String(form.get("name") ?? "").trim();
    const username = String(form.get("username") ?? "").trim().toLowerCase();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const phone = String(form.get("phone") ?? "").trim();
    const startDate = String(form.get("startDate") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    // Client-side validations
    if (password.length < 12) {
      setError("Kata sandi minimal harus 12 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9._]{2,31}$/.test(username)) {
      setError("Username harus diawali huruf dan berukuran 3-32 karakter (hanya huruf, angka, titik, garis bawah).");
      return;
    }
    if (startDate > today) {
      setError("Tanggal mulai bekerja tidak boleh di masa depan.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          kpcId,
          name,
          username,
          email,
          phone,
          startDate,
          password,
          confirmPassword
        })
      });

      setRegisteredEmail(email);
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pendaftaran gagal. Silakan periksa kembali data Anda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Pendaftaran Karyawan"
      subtitle="Daftarkan akun kerja Anda untuk mengakses portal MKN Site."
      wide
      backHref="/login"
      backLabel="← Kembali ke Halaman Login"
      hideSeparation
    >
      {success ? (
        <div>
          <div className="alert-box alert-success" role="status">
            <strong>Pendaftaran Berhasil!</strong>
            <p style={{ margin: "6px 0 0" }}>
              Akun Anda telah berhasil didaftarkan. Tautan verifikasi telah dikirimkan ke <strong>{registeredEmail}</strong>.
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "13px" }}>
              Silakan periksa kotak masuk atau spam email Anda. Anda sudah dapat login sekarang untuk membuat draf, namun pengajuan resmi memerlukan email terverifikasi.
            </p>
          </div>
          <Link href="/login" className="button button-primary" style={{ width: "100%", marginTop: "12px" }}>
            Masuk ke Portal Karyawan
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="auth-grid-2col">
            <div className="field">
              <label htmlFor="kpcId">ID KPC</label>
              <input
                id="kpcId"
                name="kpcId"
                type="text"
                placeholder="Contoh: KPC12345"
                required
                autoCapitalize="characters"
              />
              <span className="field-hint">2–32 karakter alfanumerik (uppercase otomatis)</span>
            </div>

            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                placeholder="username_kerja"
                autoComplete="username"
                required
              />
              <span className="field-hint">Diawali huruf, huruf kecil, angka, titik/garis bawah</span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="name">Nama Lengkap</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Nama lengkap sesuai data karyawan"
              required
            />
          </div>

          <div className="auth-grid-2col">
            <div className="field">
              <label htmlFor="email">Email Kerja / Pribadi</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="nama@mknsite.online atau email aktif"
                required
              />
              <span className="field-hint">Digunakan untuk verifikasi dan reset kata sandi</span>
            </div>

            <div className="field">
              <label htmlFor="phone">Nomor HP / WhatsApp</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="081234567890"
                required
              />
              <span className="field-hint">Format Indonesia (otomatis dinormalisasi ke +62)</span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="startDate">Tanggal Mulai Bekerja</label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              max={today}
              required
            />
          </div>

          <div className="auth-grid-2col">
            <div className="field">
              <label htmlFor="password">Kata Sandi</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Minimal 12 karakter"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="confirmPassword">Konfirmasi Kata Sandi</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Ulangi kata sandi"
                required
              />
            </div>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="button button-primary" type="submit" disabled={loading}>
            {loading ? "Mendaftarkan Akun..." : "Daftar Akun Karyawan"}
          </button>

          <div className="auth-switch-prompt">
            Sudah memiliki akun karyawan?{" "}
            <Link href="/login" className="auth-inline-link">
              Masuk ke Portal
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
