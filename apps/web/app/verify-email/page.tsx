"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { api } from "@/lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [verifying, setVerifying] = useState(Boolean(token));
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(token ? "" : "Tautan verifikasi tidak memiliki token yang valid.");

  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState("");

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    api("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token })
    })
      .then(() => {
        if (mounted) {
          setSuccess(true);
          setVerifying(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Verifikasi email gagal atau token telah kedaluwarsa.");
          setVerifying(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResendError("");
    setResendSuccess(false);

    if (!resendEmail.trim()) {
      setResendError("Masukkan alamat email terdaftar Anda.");
      return;
    }

    setResendLoading(true);
    try {
      await api("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: resendEmail.trim() })
      });
      setResendSuccess(true);
    } catch (reason) {
      setResendError(reason instanceof Error ? reason.message : "Gagal mengirim ulang email verifikasi.");
    } finally {
      setResendLoading(false);
    }
  }

  if (verifying) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div className="loading-block" style={{ margin: "0 auto 16px" }} />
        <p style={{ color: "var(--ink-soft)" }}>Sedang memverifikasi alamat email Anda...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div>
        <div className="alert-box alert-success" role="status">
          <strong>Email Berhasil Diverifikasi!</strong>
          <p style={{ margin: "6px 0 0" }}>
            Terima kasih! Akun Anda telah terverifikasi secara resmi. Anda kini memiliki hak penuh untuk mengajukan formulir (Oncall, Overtime, Cuti) dan mengunduh berkas PDF resmi perusahaan.
          </p>
        </div>
        <Link href="/portal" className="button button-primary" style={{ width: "100%", marginTop: "14px" }}>
          Buka Portal Karyawan
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="alert-box alert-error" role="alert">
        <strong>Verifikasi Belum Berhasil</strong>
        <p style={{ margin: "6px 0 0" }}>{error}</p>
      </div>

      <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--line)" }}>
        <h3 style={{ fontSize: "16px", margin: "0 0 8px" }}>Kirim Ulang Email Verifikasi</h3>
        <p style={{ fontSize: "13px", color: "var(--ink-soft)", margin: "0 0 16px" }}>
          Masukkan email Anda untuk menerima tautan verifikasi baru.
        </p>

        {resendSuccess ? (
          <div className="alert-box alert-success" style={{ fontSize: "13px" }}>
            Tautan verifikasi baru telah dikirimkan ke email Anda jika terdaftar.
          </div>
        ) : (
          <form onSubmit={handleResend} noValidate>
            <div className="field">
              <label htmlFor="resendEmail">Email Terdaftar</label>
              <input
                id="resendEmail"
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="nama@mknsite.online"
                required
              />
            </div>
            {resendError && <p className="form-error" role="alert">{resendError}</p>}
            <button className="button button-secondary" type="submit" disabled={resendLoading} style={{ width: "100%" }}>
              {resendLoading ? "Mengirim..." : "Kirim Ulang Tautan Verifikasi"}
            </button>
          </form>
        )}
      </div>

      <div className="auth-switch-prompt">
        <Link href="/login" className="auth-inline-link">
          ← Kembali ke Halaman Login
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout
      title="Verifikasi Email"
      subtitle="Konfirmasi kepemilikan email untuk membuka seluruh fitur portal."
      backHref="/login"
      backLabel="← Kembali ke Halaman Login"
      hideSeparation
    >
      <Suspense fallback={<div className="loading-block short" />}>
        <VerifyEmailContent />
      </Suspense>
    </AuthLayout>
  );
}
